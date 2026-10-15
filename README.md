# Eternity

A family of AI teammates that make the work lighter, not smaller.
An Eternity Works app. Expo SDK 54, Expo Router, TypeScript, Firebase, Claude.

---

## Run it

```bash
npm install
npx expo start --web          # quickest look: runs in the browser (no ads, no purchases, no in-app browser)
```

For the phone you need a development build (AdMob, RevenueCat, Face ID and the WebView are native):

```bash
npm install -g eas-cli
eas login
eas init                      # creates the Eternity project and writes its projectId into app.json
eas build --profile development --platform ios
npx expo start --dev-client
```

Tap **Look around first** on the sign-in screen to explore without an account. Teammates answer with
labelled preview replies until you sign in.

---

## One-time setup

Eternity shares the Firebase project with Aibram (`aibram-9c44f`), so sign-in, the Anthropic key
and Aibram's `getETA` / `getMorningNews` functions are already there.

### 1. Cloud Functions (codebase `eternity`)
```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH   # any long random string; paste the same in RevenueCat
firebase deploy --only functions:eternity
```
- `ANTHROPIC_API_KEY` is already a secret in this project (Aibram set it). It never goes in the app.
- `--only functions:eternity` deploys just Eternity's two functions and never touches Aibram's.
- Deploy the merged rules once: `firebase deploy --only firestore:rules`
  (`firestore.rules` keeps Aibram's rules and adds Eternity's server-only `entitlements` and `usage`).

### 2. RevenueCat
1. New app in RevenueCat for bundle id `com.joshuat8808.Eternity`.
2. App Store Connect products: `eternity_plus_monthly` ($6.99), `eternity_pro_monthly` ($14.99),
   `eternity_founding_monthly` ($4.99, Founding Families).
3. Entitlements: `plus` (attach Plus and Founding), `pro` (attach Pro). Put all three in the default offering.
4. Paste the iOS public SDK key into `IOS_KEY` in `lib/purchases.native.ts`.
5. Webhook: `https://us-central1-aibram-9c44f.cloudfunctions.net/eternityRevenueCat`, Authorization header =
   your `REVENUECAT_WEBHOOK_AUTH` value. The server reads the plan from Firestore, so limits can't be faked from a phone.

Until the key is set, development builds unlock plans locally from Settings → Developer so you can test every screen.

### 3. AdMob
Create an Eternity app in AdMob. Put its app ID in `app.json` (the `react-native-google-mobile-ads` plugin,
currently Google's test IDs) and the banner + rewarded unit IDs in `lib/ads.native.tsx`.
Ads are always requested non-personalized.

### 4. Google sign-in (optional)
In Google Cloud (project `aibram-9c44f`) create an **iOS OAuth client** for `com.joshuat8808.Eternity`,
paste it into `GOOGLE_IOS_CLIENT_ID` in `app/login.tsx`, and add its reversed client ID
(`com.googleusercontent.apps.…`) to `scheme` in `app.json`. The Google button appears once it's set.

### 5. App Store notes
- `ITSAppUsesNonExemptEncryption` is `false`. The Vault uses standard XSalsa20-Poly1305 only to protect
  the user's own data on their phone; double-check the export compliance questions in App Store Connect.
- Account deletion is in Me → Trust & privacy → Forget everything.

---

## What's in the box

| Area | Screens | Status |
|---|---|---|
| Sign-in & onboarding | `login`, `onboarding/*` (welcome, what you're chasing, the Charter with hold-to-sign, connect, meet & name your family) | Real |
| Today | huddle line, family status, Heads up conflicts, timeline, ask bar, banner ad on Free | Real (sample day optional) |
| Talk | `chat/[id]` with approvals, undo, memory suggestions, private sessions, daily limits, rewarded ad | **Real Claude** |
| Family Table | `table`: teammates work out conflicts, you pick A or B, drafts you send yourself | **Real Claude** |
| Family | loop with 10 seats, change head, teammate pages, the Riverbed (shape, color, face, mark, finish, motion), renaming | Real |
| Planning | `planner` (week strip, conflict fixes, triage + Aibram's take), `flow` (sprints, rain/forest, shield), `review` (grade + one decision), `rings` (your year) | Real |
| Eternity Browser | read-along, ask the page, summarize, flashcards, due dates, Trails, Watches, Teach it once, the Guard | **Real Claude** (WebView on phone) |
| Workbench | each teammate's computer, live view, Take the wheel, Stop, Your turn sign-in | Scripted preview |
| Errands | request → steps → cart → plain-code check → Face ID → receipt + undo window | Real flow, simulated sites |
| Trust | Vault encryption, recovery key, receipts, memory with learning off, forget everything, Guard log | Real |
| Connections | packs, catalog, per-connector permissions, reading receipts | Sample data until integrations land |
| Plus | Free / Plus $6.99 / Pro $14.99 / Founding $4.99 via RevenueCat | Real once keys are set |
| Confluence | two families' heads find a time, share free windows only | Simulated friends |
| Extras | `extension/` Chrome side panel (real), `native-extras/` Apple Watch + Flow Live Activity (SwiftUI scaffolds) | See their READMEs |

## How the AI works
- `lib/ai.ts` sends the chat, the teammate's persona, your Charter and saved memory to `callFamily`.
- `functions/index.js` checks your Firebase token, reads your plan from Firestore, enforces the daily cap
  (Free 20, Plus 300, Pro 1,000), picks the model (Haiku 5.5 first; Sonnet 5.5 for the Table, planning and
  reviews on paid plans; Opus 5.5 for deep plans on Pro), caches the rules and persona, and calls Claude.
- Tools are proposals only. Nothing happens until you tap Approve, and sending, spending, merging and
  deleting always ask. Conversation content is never stored or logged on the server.

## Project map
```
app/            screens (Expo Router)
components/     Pebble, FamilyLoop, TabBar, ui kit, Toast, cards
lib/            store (encrypted), ai, actions, errands, guard, huddle, catalog, demo, purchases, ads
theme/          Ink & Water tokens and the theme provider
firebase/       config + auth helpers
functions/      callFamily + eternityRevenueCat (codebase "eternity")
extension/      Chrome MV3 side panel
native-extras/  Apple Watch app + Flow Live Activity (SwiftUI)
```
