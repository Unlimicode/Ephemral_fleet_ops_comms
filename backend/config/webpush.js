// ─────────────────────────────────────────────────────────────────────────────
// VAPID Configuration — Web Push Initialisation
// ─────────────────────────────────────────────────────────────────────────────
// VAPID (Voluntary Application Server Identification) keys identify this server
// to browser push services (e.g. FCM, Mozilla). They are an asymmetric key pair:
// the public key is shared with the browser at subscription time; the private key
// signs push requests server-side and never leaves this environment.
// Keys are generated once (node -e "import('web-push').then(m => console.log(m.default.generateVAPIDKeys()))")
// and stored as environment variables — never committed to the repository.
// ─────────────────────────────────────────────────────────────────────────────

import webpush from 'web-push';

webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export default webpush;
