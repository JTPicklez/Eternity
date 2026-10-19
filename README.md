# Eternity

A Crew of AI teammates that make the work lighter, not smaller.
An Eternity Works app. Expo SDK 54, Expo Router, TypeScript, Firebase, Claude.

---

## Run it

```bash
npm install
npx expo start --web          # quickest look: runs in the browser
```

For the phone you need a development build (AdMob, RevenueCat, Face ID, the WebViews, Calendar,
Contacts and Messages are native):

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
npx expo start --dev-client
```

Tap **Look around first** on the sign-in screen to explore without an account. Teammates answer with
labelled preview replies until you sign in. In development builds, `/dev` shows a pebble gallery and a
shortcut into the app with a sample Crew.

---

## One-time setup

Every public key and ID the app needs lives in **`lib/config.ts`**. Anything left empty just stays off.
Secrets never go in the app; they are Firebase secrets on the server.

Eternity shares the Firebase project with Aibram (`aibram-9c44f`), so sign-in, the Anthropic key and
Aibram's `getETA` / `getMorningNews` functions are already there.

### 1. Server secrets and deploy (codebase `eternity`)
```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..

firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH   # any long random string; paste the same in RevenueCat
firebase functions:secrets:set CONNECTOR_KEY             # paste the output of: openssl rand -base64 32
cp functions/connector-apps.example.json functions/connector-apps.json   # fill in what you have (can stay mostly empty)
firebase functions:secrets:set CONNECTOR_APPS --data-file functions/connector-apps.json

firebase deploy --only functions:eternity
firebase deploy --only firestore:rules
```
- `ANTHROPIC_API_KEY` is already a secret in this project. It never goes in the app.
- `--only functions:eternity` deploys just Eternity's functions and never touches Aibram's.
- `functions/connector-apps.json` is git-ignored. Every time you add a developer app's client ID and
  secret to it, run the `secrets:set CONNECTOR_APPS` line again and redeploy.
- `firestore.rules` keeps Aibram's rules and adds Eternity's server-only collections.

### 2. Connections
Follow "Eternity connectors: tonight's build list". Every OAuth app uses one redirect address:
`https://us-central1-aibram-9c44f.cloudfunctions.net/eternityOAuthCallback`.
Client IDs and secrets go in `functions/connector-apps.json` (not separate secrets). Pasted keys (Canvas,
Linear, Sentry and the rest) are entered in the app and stored encrypted on the server.

### 3. RevenueCat (iPhone and web)
1. App Store products: `eternity_plus_monthly` ($6.99), `eternity_pro_monthly` ($14.99),
   `eternity_founding_monthly` ($4.99, Founding Crews). Entitlements `plus` (Plus and Founding) and `pro`.
2. Put the Apple public key in `CONFIG.revenuecat.ios`.
3. For the website, connect Stripe in RevenueCat, set up Web Billing products with the same entitlements,
   and put the `rcb_` key in `CONFIG.revenuecat.web`.
4. Webhook: `https://us-central1-aibram-9c44f.cloudfunctions.net/eternityRevenueCat`, Authorization header =
   your `REVENUECAT_WEBHOOK_AUTH`. The server reads the plan from Firestore, so limits can't be faked.

### 4. Ads
- iPhone: the AdMob app ID goes in `app.json` (the `react-native-google-mobile-ads` plugin), the banner and
  rewarded unit IDs in `CONFIG.admob`.
- Website: AdSense publisher ID and slot in `CONFIG.adsense`.
- Ads are always requested non-personalized.

### 5. Google sign-in on iPhone
Create an iOS OAuth client for `com.joshuat8808.Eternity`, put it in `CONFIG.google.iosClientId`, and add
its reversed client ID (`com.googleusercontent.apps.…`) to `scheme` in `app.json`.

### 6. Passkeys on the website
Add your site's address to `webOrigins` in `functions/connector-apps.json` (the first one sets the passkey
domain). Then give the functions' service account the **Service Account Token Creator** role in Google
Cloud IAM, so it can mint sign-in tokens.

### 7. App Store notes
- `ITSAppUsesNonExemptEncryption` is `false`. The Vault uses standard encryption only to protect the
  user's own data on their phone; double-check the export compliance questions in App Store Connect.
- Calendar, Contacts and Location each explain themselves in `app.json`.
- Account deletion is in Me, Trust & privacy, Forget everything.

---

## What's in the box

| Area | What it is |
|---|---|
| Crew | The loop with 10 seats, the Crew lead in the center, teammate pages, Crew Table, Meetup |
| Pebble Studio | Write each teammate's job (starter ideas optional), then shape, color, material, face, extras. Stones wear smooth with time together; some extras are earned, some are Plus |
| Crew Room | A room where teammates work at stations that match their job, wait for you up front, and relax on the rug. Real time of day, decorating |
| Talk | Real Claude, approvals, undo, memory suggestions, private sessions, math typeset in chat |
| Memory | Saved facts, learning on or off, and importing memory from another AI one item at a time |
| Flashcards | Typeset math, hints, worked steps, spaced repetition |
| Messages | Teammates draft texts and emails; your phone's composer opens and you tap Send. Slack posts with your OK |
| Connections | Real sign-ins and keys through the server, live reads by teammates, Apple Calendar and weather on the phone |
| Browser | Tabs, ask across tabs, explain a selection, research boards, "Do it for me" with approved steps, the Guard |
| Artifacts | Small apps teammates build: preview and code side by side, point to change, self-repair, every version kept |
| Website | The same app on the web with web billing, passkeys and AdSense |

## How the AI works
- `lib/ai.ts` sends the chat, the teammate's job in your words, your Charter, saved memory and phone context
  to `callFamily` (the endpoint kept its name).
- `functions/index.js` checks your Firebase token, reads your plan, enforces the daily cap, picks the
  model, lets teammates read connected apps (reads only) and returns proposals for everything else.
- Sending, spending, merging and deleting always ask. Conversation content is never stored or logged.

## Project map
```
app/            screens (Expo Router)
components/     Pebble, CrewLoop, CrewRoom, MathText, ArtifactFrame, TabBar, ui kit
lib/            store (encrypted), ai, actions, connectors, phone, artifacts, srs, cosmetics, guard, config
theme/          design tokens and the theme provider
firebase/       config + auth helpers
functions/      callFamily, connectors, passkeys, RevenueCat webhook (codebase "eternity")
extension/      Chrome side panel
native-extras/  Apple Watch app + Flow Live Activity (SwiftUI)
```
