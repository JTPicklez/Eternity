/**
 * Passkeys for the website: sign in with Face ID, Touch ID or a security key
 * instead of a password. Firebase Auth doesn't do passkeys itself, so these
 * functions check the passkey and then hand the browser a Firebase custom
 * token for that account.
 *
 *   passkeyRegisterStart / passkeyRegisterFinish   add a passkey (signed in)
 *   passkeyLoginStart / passkeyLoginFinish         sign in with one
 *
 * Setup: the site's address goes in CONNECTOR_APPS as "webOrigins" (the first
 * one decides the passkey domain), or set "passkeyRpId" to choose it. The
 * functions' service account also needs the "Service Account Token Creator"
 * role so it can mint sign-in tokens.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } = require('@simplewebauthn/server');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const CONNECTOR_APPS = defineSecret('CONNECTOR_APPS');
const FIVE_MIN = 5 * 60_000;

function site() {
  let cfg = {};
  try {
    cfg = JSON.parse(CONNECTOR_APPS.value() || '{}') || {};
  } catch {
    cfg = {};
  }
  const origins = (Array.isArray(cfg.webOrigins) ? cfg.webOrigins : []).filter((o) => /^https?:\/\//.test(o));
  const rpID = cfg.passkeyRpId || (origins[0] ? new URL(origins[0]).hostname : 'localhost');
  // Local testing works on localhost with any port.
  const allowed = rpID === 'localhost' ? [...origins, 'http://localhost:8081', 'http://localhost:19006'] : origins;
  return { rpID, origins: allowed };
}

async function verifyUser(req) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const unb64url = (s) => new Uint8Array(Buffer.from(String(s), 'base64url'));
const keys = () => db.collection('passkeys');
const challenges = () => db.collection('passkeyChallenges');

function bad(res, status, error) {
  res.status(status).json({ error });
}

exports.passkeyRegisterStart = onRequest({ secrets: [CONNECTOR_APPS], cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    const user = await verifyUser(req);
    if (!user) return bad(res, 401, 'Sign in first, then add a passkey.');
    const { rpID } = site();
    const mine = await keys().where('uid', '==', user.uid).get();
    const options = await generateRegistrationOptions({
      rpName: 'Eternity',
      rpID,
      userName: user.email || user.uid,
      userDisplayName: user.name || user.email || 'Eternity',
      userID: new Uint8Array(Buffer.from(user.uid)),
      attestationType: 'none',
      excludeCredentials: mine.docs.map((d) => ({ id: d.id, transports: d.data().transports || [] })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    await challenges().doc(`reg_${user.uid}`).set({ challenge: options.challenge, at: Date.now() });
    res.status(200).json({ options });
  } catch (e) {
    console.error('passkeyRegisterStart', e && e.name);
    bad(res, 500, "Couldn't start that. Try again.");
  }
});

exports.passkeyRegisterFinish = onRequest({ secrets: [CONNECTOR_APPS], cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    const user = await verifyUser(req);
    if (!user) return bad(res, 401, 'Sign in again.');
    const ref = challenges().doc(`reg_${user.uid}`);
    const snap = await ref.get();
    await ref.delete();
    if (!snap.exists || Date.now() - snap.data().at > FIVE_MIN) return bad(res, 400, 'That took too long. Try again.');
    const { rpID, origins } = site();
    const v = await verifyRegistrationResponse({
      response: (req.body || {}).response,
      expectedChallenge: snap.data().challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
    });
    if (!v.verified) return bad(res, 400, "That passkey didn't check out.");
    const c = v.registrationInfo.credential;
    await keys()
      .doc(c.id)
      .set({
        uid: user.uid,
        publicKey: b64url(c.publicKey),
        counter: c.counter,
        transports: c.transports || [],
        backedUp: !!v.registrationInfo.credentialBackedUp,
        name: String((req.body || {}).name || 'Passkey').slice(0, 60),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('passkeyRegisterFinish', e && e.name);
    bad(res, 400, "That passkey didn't check out.");
  }
});

exports.passkeyLoginStart = onRequest({ secrets: [CONNECTOR_APPS], cors: true, memory: '256MiB' }, async (_req, res) => {
  try {
    const { rpID } = site();
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
    const ticket = crypto.randomBytes(18).toString('base64url');
    await challenges().doc(`auth_${ticket}`).set({ challenge: options.challenge, at: Date.now() });
    res.status(200).json({ options, ticket });
  } catch (e) {
    console.error('passkeyLoginStart', e && e.name);
    bad(res, 500, "Couldn't start that. Try again.");
  }
});

exports.passkeyLoginFinish = onRequest({ secrets: [CONNECTOR_APPS], cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    const { ticket, response } = req.body || {};
    const ref = challenges().doc(`auth_${String(ticket || '').replace(/[^\w-]/g, '')}`);
    const snap = await ref.get();
    await ref.delete().catch(() => {});
    if (!snap.exists || Date.now() - snap.data().at > FIVE_MIN) return bad(res, 400, 'That took too long. Try again.');
    const credId = String((response && response.id) || '');
    const keySnap = credId ? await keys().doc(credId).get() : null;
    if (!keySnap || !keySnap.exists) return bad(res, 400, "That passkey isn't linked to an Eternity account.");
    const k = keySnap.data();
    const { rpID, origins } = site();
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: snap.data().challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: { id: credId, publicKey: unb64url(k.publicKey), counter: k.counter || 0, transports: k.transports || [] },
    });
    if (!v.verified) return bad(res, 400, "That passkey didn't check out.");
    await keySnap.ref.update({ counter: v.authenticationInfo.newCounter, lastUsedAt: admin.firestore.FieldValue.serverTimestamp() });
    const token = await admin.auth().createCustomToken(k.uid, { passkey: true });
    res.status(200).json({ token });
  } catch (e) {
    console.error('passkeyLoginFinish', e && e.name);
    bad(res, 400, "That passkey didn't check out.");
  }
});
