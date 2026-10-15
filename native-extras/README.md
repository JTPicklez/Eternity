# Native extras: Apple Watch and Live Activities

These are ready-to-wire SwiftUI targets. They're kept out of the main build
so the app keeps building with plain `eas build` until you're ready.

## What's here
- `targets/watch`: the Apple Watch companion. Your head teammate (breathing
  pebble), the huddle line, what's next, and a one-tap **Start Flow**. The
  phone sends it a tiny snapshot over WatchConnectivity.
- `targets/flow-activity`: Flow on the Lock Screen and in the Dynamic Island,
  with a countdown that runs even when the app is closed.

## Turning them on
1. `npx expo install @bacons/apple-targets`
2. Move `native-extras/targets` to the project root (`./targets`).
3. In `app.json`, add `"@bacons/apple-targets"` to `plugins`, and under
   `ios.infoPlist` add `"NSSupportsLiveActivities": true`.
4. Give the app and the targets an App Group (for example
   `group.com.joshuat8808.Eternity`) in the Apple Developer portal.
5. `npx expo prebuild -p ios --clean`, then build with EAS.

## Talking to them from the app
- **Watch**: send `updateApplicationContext` with the `Snapshot` fields
  (`headName`, `headColor`, `nextTitle`, `nextTime`, `huddle`, `flowEndsAt`).
  A small library like `react-native-watch-connectivity` does this from JS.
- **Live Activity**: start `FlowAttributes` when Flow begins and update it at
  each sprint or break. A library such as `expo-live-activity`, or a 30-line
  Expo module calling `Activity<FlowAttributes>.request(...)`, does the job.
  Call it from `app/flow.tsx` where the phase changes.
