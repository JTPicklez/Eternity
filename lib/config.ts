/**
 * Every key and ID the app needs, in one place. All of these are public
 * identifiers (safe to ship in the app); secrets never go here. They live on
 * the server as Firebase secrets.
 *
 * Fill these in as you set each service up. Anything left empty simply stays
 * off: no purchases, no real ads, no Google button on iPhone.
 */
export const CONFIG = {
  revenuecat: {
    /** RevenueCat, Eternity app, API keys, Apple App Store public key (appl_...). */
    ios: '',
    /** Google Play public key (goog_...), when there's an Android app. */
    android: '',
    /** Web Billing public key (rcb_...). Connect Stripe in RevenueCat first. */
    web: '',
  },
  admob: {
    /**
     * Ad unit IDs from AdMob, Apps, Eternity, Ad units. Until these are set (and
     * always in development) Google's test ads show. The AdMob *app* ID goes in
     * app.json under the react-native-google-mobile-ads plugin.
     */
    banner: '',
    rewarded: '',
  },
  adsense: {
    /** For the website: AdSense publisher ID (ca-pub-...) and a display ad slot. */
    client: '',
    slot: '',
  },
  google: {
    /** Google Cloud, Credentials, iOS client ID, for Sign in with Google on iPhone. */
    iosClientId: '',
    /** Already set: the web client shared with Aibram's Firebase project. */
    webClientId: '430696585996-5bOh23vec5ps7dpve7c62q50csu21hc2.apps.googleusercontent.com',
  },
} as const;
