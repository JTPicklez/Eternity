/**
 * One artifact: see it running, read or edit its code, scroll back through
 * every version, point at anything to change it, and let a teammate fix it
 * when it breaks. On wide screens the preview and the code sit side by side.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Share, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { answerGet, changeArtifact, DATA_LABELS, editPicked, repairArtifact, withBridge, type Artifact } from '@/lib/artifacts';
import { timeAgo } from '@/lib/dates';
import { memberOrTemplate, useCrew } from '@/lib/store';
import { ArtifactFrame, type ArtifactFrameHandle } from '@/components/ArtifactFrame';
import { MemberPebble } from '@/components/Pebble';
import { ThinkingDots } from '@/components/Thinking';
import { Badge, Btn, Card, Empty, haptic, IconBtn, PressScale, Row, Segmented, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

type Pane = 'preview' | 'code' | 'versions';

export default function ArtifactScreen() {
  const p = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useCrew((s) => s.artifacts.find((x) => x.id === id));
  const members = useCrew((s) => s.members);
  const addArtifactVersion = useCrew((s) => s.addArtifactVersion);
  const setArtifactCurrent = useCrew((s) => s.setArtifactCurrent);
  const removeArtifact = useCrew((s) => s.removeArtifact);
  const addReceipt = useCrew((s) => s.addReceipt);
  const frame = useRef<ArtifactFrameHandle>(null);
  const [pane, setPane] = useState<Pane>(wide ? 'code' : 'preview');
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ path: string; html: string; text: string } | null>(null);
  const [pickRequest, setPickRequest] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [menu, setMenu] = useState(false);

  const version = a ? a.versions[a.current] : undefined;
  const html = useMemo(() => (a && version ? withBridge(version.html, a.uses) : ''), [a, version]);

  if (!a || !version) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
        <Empty title="That artifact is gone" action={<Btn title="All artifacts" small onPress={() => router.replace('/artifacts')} />} />
      </SafeAreaView>
    );
  }
  const builder = memberOrTemplate(a.memberId, members);
  const latest = a.current === a.versions.length - 1;

  const onMessage = (msg: { type: string; [k: string]: unknown }) => {
    if (msg.type === 'get') {
      const r = answerGet(a.uses, String(msg.key));
      frame.current?.reply(Number(msg.id), r.ok, r.data);
    } else if (msg.type === 'error') {
      const line = `${String(msg.message).slice(0, 200)}${msg.line ? ` (line ${msg.line})` : ''}`;
      setErrors((e) => (e.includes(line) ? e : [...e, line].slice(-5)));
    } else if (msg.type === 'pick') {
      setPicked({ path: String(msg.path), html: String(msg.html), text: String(msg.text) });
      setPickRequest('');
      setPicking(false);
      frame.current?.setPicking(false);
      haptic('select');
    }
  };

  const apply = async (label: string, run: () => Promise<{ html: string; note: string; title?: string; uses?: Artifact['uses'] } | null>) => {
    setBusy(label);
    try {
      const out = await run();
      if (!out) {
        toast(`${builder.name} couldn't do that one. Try saying it another way.`);
        return;
      }
      addArtifactVersion(a.id, { html: out.html, note: out.note || label, title: out.title, uses: out.uses });
      addReceipt({ memberId: builder.id, text: `${label}: "${a.title}"`, connector: 'Artifacts', kind: 'did', undoable: false });
      setErrors([]);
      haptic('success');
    } finally {
      setBusy(null);
    }
  };

  const change = () => {
    const r = request.trim();
    if (!r) return;
    setRequest('');
    apply('Changed it', () => changeArtifact(builder, a, r));
  };

  const fix = () => apply('Fixed it', () => repairArtifact(builder, a, errors));

  const changePicked = () => {
    if (!picked || !pickRequest.trim()) return;
    const req = pickRequest.trim();
    const target = picked;
    setPicked(null);
    apply('Changed the part you pointed at', () => editPicked(builder, a, target, req));
  };

  const togglePicking = () => {
    const next = !picking;
    setPicking(next);
    frame.current?.setPicking(next);
    if (next) {
      if (!wide) setPane('preview');
      toast('Tap the part you want to change.');
    }
  };

  const download = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([version.html], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${a.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'artifact'}.html`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      return;
    }
    await Share.share({ title: a.title, message: version.html }).catch(() => {});
  };

  const handToBolt = () => {
    const bolt = members.find((m) => m.kind === 'bolt') ?? members.find((m) => /code|dev|build/i.test(`${m.role} ${m.blurb}`)) ?? builder;
    setMenu(false);
    router.push({
      pathname: '/chat/[id]',
      params: { id: bolt.id, q: `I have an artifact called "${a.title}" (a single HTML file, ${Math.round(version.html.length / 1000)} KB). Help me turn it into a real project: the stack you'd pick, the files, and the first three steps.` },
    });
  };

  // ── panes ──────────────────────────────────────────────────────────────────
  const preview = (
    <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: p.card, borderWidth: picking ? 2.5 : 1.5, borderColor: picking ? p.signal : p.line }}>
      <ArtifactFrame key={version.id} ref={frame} html={html} onMessage={onMessage} />
      {!latest ? (
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'center' }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: p.stone, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Txt variant="smallStrong" color={p.onStone}>
              Version {a.current + 1} of {a.versions.length}
            </Txt>
            <Btn title="Go to latest" small variant="onStone" onPress={() => setArtifactCurrent(a.id, a.versions.length - 1)} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const code = (
    <View style={{ flex: 1 }}>
      <Row gap={8} style={{ marginBottom: 8 }}>
        <Txt variant="label" style={{ flex: 1 }}>
          {Math.round(version.html.length / 100) / 10} KB · HTML
        </Txt>
        {editing ? (
          <>
            <Btn title="Cancel" small variant="quiet" onPress={() => setEditing(false)} />
            <Btn
              title="Save as new version"
              small
              onPress={() => {
                addArtifactVersion(a.id, { html: draftCode, note: 'Edited by you' });
                setEditing(false);
                toast('Saved as a new version.');
              }}
            />
          </>
        ) : (
          <>
            <Btn
              title="Copy"
              small
              variant="ghost"
              icon="copy-outline"
              onPress={async () => {
                await Clipboard.setStringAsync(version.html).catch(() => {});
                toast('Code copied.');
              }}
            />
            <Btn
              title="Edit"
              small
              variant="ghost"
              icon="create-outline"
              onPress={() => {
                setDraftCode(version.html);
                setEditing(true);
              }}
            />
          </>
        )}
      </Row>
      <View style={{ flex: 1, borderRadius: 16, backgroundColor: p.mode === 'ink' ? '#0F1215' : '#1E2023', padding: 12 }}>
        {editing ? (
          <TextInput
            value={draftCode}
            onChangeText={setDraftCode}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={{ flex: 1, color: '#E6E1D6', fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, textAlignVertical: 'top' }}
          />
        ) : (
          <ScrollView>
            <ScrollView horizontal>
              <Txt variant="mono" selectable style={{ color: '#E6E1D6', fontSize: 12, lineHeight: 17 }}>
                {version.html}
              </Txt>
            </ScrollView>
          </ScrollView>
        )}
      </View>
    </View>
  );

  const versions = (
    <ScrollView style={{ flex: 1 }}>
      {[...a.versions].reverse().map((v, ri) => {
        const i = a.versions.length - 1 - ri;
        const on = i === a.current;
        return (
          <PressScale key={v.id} onPress={() => setArtifactCurrent(a.id, i)} accessibilityLabel={`Version ${i + 1}`}>
            <Row gap={12} align="flex-start" style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
              <View style={{ alignItems: 'center', width: 18 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? p.signal : p.lineStrong, marginTop: 4 }} />
                {ri < a.versions.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: p.line, marginTop: 4 }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Row gap={8}>
                  <Txt variant="bodyStrong">Version {i + 1}</Txt>
                  {on ? <Badge text="Showing" /> : null}
                </Row>
                <Txt variant="small">{v.note}</Txt>
                <Txt variant="tiny">{timeAgo(v.at)}</Txt>
              </View>
              {!on && i !== a.versions.length - 1 ? (
                <Btn
                  title="Restore"
                  small
                  variant="ghost"
                  onPress={() => {
                    addArtifactVersion(a.id, { html: v.html, note: `Restored version ${i + 1}` });
                    toast(`Version ${i + 1} is back on top.`);
                  }}
                />
              ) : null}
            </Row>
          </PressScale>
        );
      })}
    </ScrollView>
  );

  const changeBar = (
    <Row gap={8} style={{ paddingTop: 10 }}>
      <IconBtn icon={picking ? 'close' : 'locate-outline'} label={picking ? 'Stop pointing' : 'Point to change'} tone={picking ? 'ink' : 'outline'} onPress={togglePicking} />
      <TextInput
        value={request}
        onChangeText={setRequest}
        onSubmitEditing={change}
        placeholder={picking ? 'Tap the part to change…' : `Ask ${builder.name} to change something`}
        placeholderTextColor={p.muted}
        editable={!busy}
        style={{ flex: 1, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: p.lineStrong, backgroundColor: p.card, paddingHorizontal: 12, color: p.text, fontFamily: fonts.body, fontSize: 15 }}
        returnKeyType="send"
      />
      <IconBtn icon="arrow-up" label="Send change" tone="ink" onPress={change} />
    </Row>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 14 }}>
        <Row gap={6} style={{ height: 52 }}>
          <IconBtn icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/artifacts'))} />
          <View style={{ flex: 1 }}>
            <Txt variant="label" numberOfLines={1}>
              Artifact · by {builder.name}
            </Txt>
            <Txt variant="h3" numberOfLines={1}>
              {a.title}
            </Txt>
          </View>
          <IconBtn icon="ellipsis-horizontal" label="More" onPress={() => setMenu(true)} />
        </Row>

        {a.uses.length ? (
          <Row gap={6} wrap style={{ marginBottom: 8 }}>
            <Ionicons name="eye-outline" size={14} color={p.muted} />
            <Txt variant="tiny">Reads live: {a.uses.map((u) => DATA_LABELS[u]).join(', ')}. Nothing leaves your phone.</Txt>
          </Row>
        ) : null}

        {errors.length ? (
          <Animated.View entering={FadeInDown} exiting={FadeOut}>
            <Card tone="soft" carve={1} padding={12} style={{ marginBottom: 10 }}>
              <Row gap={10}>
                <Ionicons name="bandage-outline" size={18} color={p.danger} />
                <Txt variant="small" style={{ flex: 1 }} numberOfLines={2}>
                  It hit {errors.length === 1 ? 'an error' : `${errors.length} errors`}: {errors[errors.length - 1]}
                </Txt>
                <Btn title="Fix it" small variant="signal" disabled={!!busy} onPress={fix} />
              </Row>
            </Card>
          </Animated.View>
        ) : null}

        {wide ? (
          <Row gap={14} align="stretch" style={{ flex: 1 }}>
            <View style={{ flex: 1.3 }}>{preview}</View>
            <View style={{ width: 440 }}>
              <Segmented<Pane>
                options={[
                  { id: 'code', label: 'Code' },
                  { id: 'versions', label: `Versions (${a.versions.length})` },
                ]}
                value={pane === 'preview' ? 'code' : pane}
                onChange={setPane}
              />
              <View style={{ flex: 1, marginTop: 10 }}>{pane === 'versions' ? versions : code}</View>
            </View>
          </Row>
        ) : (
          <View style={{ flex: 1 }}>
            <Segmented<Pane>
              options={[
                { id: 'preview', label: 'Preview' },
                { id: 'code', label: 'Code' },
                { id: 'versions', label: `Versions (${a.versions.length})` },
              ]}
              value={pane}
              onChange={setPane}
            />
            <View style={{ flex: 1, marginTop: 10 }}>
              {/* The preview stays mounted so it keeps its state while you read the code. */}
              <View style={{ flex: 1, display: pane === 'preview' ? 'flex' : 'none' }}>{preview}</View>
              {pane === 'code' ? code : pane === 'versions' ? versions : null}
            </View>
          </View>
        )}

        {busy ? (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Row gap={10} style={{ paddingTop: 12 }}>
              <MemberPebble member={builder} size={32} state="working" />
              <Txt variant="smallStrong" style={{ flex: 1 }}>
                {builder.name} is on it
              </Txt>
              <ThinkingDots color={builder.color} />
            </Row>
          </Animated.View>
        ) : (
          changeBar
        )}
      </View>

      <Sheet visible={!!picked} onClose={() => setPicked(null)} title="Change this part">
        <View style={{ backgroundColor: p.card2, borderRadius: 14, padding: 12, marginBottom: 12 }}>
          <Txt variant="mono" numberOfLines={3}>
            {picked?.text?.trim() || picked?.path}
          </Txt>
        </View>
        <TextInput
          value={pickRequest}
          onChangeText={setPickRequest}
          placeholder="What should change? Like: make it bigger and green"
          placeholderTextColor={p.muted}
          autoFocus
          multiline
          style={{ minHeight: 80, borderRadius: 14, borderWidth: 1.5, borderColor: p.lineStrong, backgroundColor: p.card, padding: 12, color: p.text, fontFamily: fonts.body, fontSize: 15, textAlignVertical: 'top' }}
        />
        <Btn title="Change it" variant="signal" full style={{ marginTop: 12 }} disabled={!pickRequest.trim()} onPress={changePicked} />
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={a.title}>
        <Btn title="Hand it to a code teammate" variant="ghost" full icon="code-slash-outline" onPress={handToBolt} />
        <Btn title={Platform.OS === 'web' ? 'Download the .html file' : 'Share the code'} variant="ghost" full icon="download-outline" style={{ marginTop: 10 }} onPress={download} />
        <Btn
          title="Delete artifact"
          variant="danger"
          full
          style={{ marginTop: 10 }}
          onPress={() => {
            setMenu(false);
            removeArtifact(a.id);
            toast(`Deleted "${a.title}".`);
            router.back();
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}
