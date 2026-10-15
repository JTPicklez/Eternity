/**
 * Makes the sample family feel alive: teammates pick up work, finish it and
 * check in with you while you look around. Only runs on the sample day.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { toast } from '@/components/Toast';
import { useFamily } from './store';

const woken = new Set<string>();

const OPENING: Record<string, { state: 'idle' | 'working' | 'waiting' | 'done'; status: string }> = {
  sage: { state: 'working', status: 'Building your Calc deck' },
  bolt: { state: 'waiting', status: 'PR #42 is ready to merge' },
  pace: { state: 'done', status: 'Planned an easy 5 km' },
  ledger: { state: 'working', status: 'Reading this week’s numbers' },
  echo: { state: 'working', status: 'Drafting show notes' },
  quill: { state: 'idle', status: 'Ready for your next draft' },
};

export function useAliveFamily() {
  const sample = useFamily((s) => s.sample);
  const onboarded = useFamily((s) => s.onboarded);
  const ids = useFamily((s) => s.members.map((m) => m.id).join(','));

  useEffect(() => {
    if (!sample || !onboarded) return;
    const st = useFamily.getState();

    st.members.forEach((m) => {
      if (woken.has(m.id)) return;
      woken.add(m.id);
      if (m.id === st.headId) {
        st.setMemberState(m.id, 'idle', 'Watching the week');
        return;
      }
      const open = OPENING[m.kind];
      if (open) st.setMemberState(m.id, open.state, open.status);
    });

    if (!woken.has('__finish')) {
      woken.add('__finish');
      const hasSage = st.members.some((m) => m.id === 'sage');
      // Not cleared on re-render: it checks that the sample is still on before acting.
      setTimeout(() => {
          const s = useFamily.getState();
          if (!s.sample) return;
          if (hasSage && s.members.some((m) => m.id === 'sage')) {
            s.setMemberState('sage', 'done', '24 Calc cards are ready');
            toast('Sage finished your Calc deck. 24 cards.', { label: 'Study', onPress: () => router.push('/flashcards') }, '#C3A3F7');
          } else {
            s.setMemberState(s.headId, 'working', 'Checking tomorrow');
            setTimeout(() => {
              const now = useFamily.getState();
              now.setMemberState(now.headId, 'idle', 'Tomorrow looks good');
            }, 6000);
          }
        }, 25_000);
    }
  }, [sample, onboarded, ids]);
}
