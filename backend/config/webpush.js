// ─────────────────────────────────────────────────────────────────────────────
// VAPID Configuration — Web Push Initialisation
// ─────────────────────────────────────────────────────────────────────────────
// VAPID (Voluntary Application Server Identification) keys identify this server
// to browser push services (e.g. FCM, Mozilla). They are an asymmetric key pair:
// the public key is shared with the browser at subscription time; the private key
// signs push requests server-side and never leaves this environment.
// Keys are generated once and stored as environment variables — never committed
// to the repository. setVapidDetails is called in sendPushNotification.js at
// call time rather than module load time so that importing this module does not
// throw when VAPID env vars are absent (e.g. in non-push test suites).
// ─────────────────────────────────────────────────────────────────────────────

import webpush from 'web-push';

export default webpush;
