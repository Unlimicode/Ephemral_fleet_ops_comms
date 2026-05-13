# Chapter 4 — SwiftLink Codebase Study Guide

**BSC Final Year Project — Ian Lemashon Sopia (SCT221-0593/2022)**

This document is your Chapter 4 preparation reference. It maps every Functional Requirement
to the exact code that implements it, explains the reasoning behind every key design decision,
and maps each testing claim to a specific test file and test name.

---

## FR → Code → Test Mapping Table

| FR | Title | Primary Files | Validating Tests |
|----|-------|--------------|-----------------|
| FR1 | Trip Lifecycle Management | `routes/trips.js`, `routes/bookings.js`, `routes/roster.js` | `trips.test.js`, `driverTrips.test.js`, `roster.test.js` |
| FR2 | Client Authentication via EDAT | `routes/bookings.js` (`/` and `/auth`), `middleware/clientAuth.js` | `bookings.test.js` |
| FR3 | Server-Mediated Communication | `socket/io.js`, `routes/bookings.js` (query), `routes/driverTrips.js` (query) | `relay.test.js`, `driverTrips.test.js` Tests 1–2 |
| FR4 | Ephemeral Credential Management | `routes/auth.js`, `middleware/auth.js`, `config/redisHelpers.js`, `routes/trips.js` (complete) | `auth.test.js`, `driverAuth.test.js`, `trips.test.js` Tests 3–4 |
| FR5 | Conditional Persistence | `routes/complaints.js` (POST), `utils/encryption.js`, `config/redisHelpers.js` | `conditionalPersistence.test.js`, `complaints.test.js` Tests 5–6 |
| FR6 | Complaint Investigation & Resolution | `routes/complaints.js` (GET/:id/messages, PATCH/:id/status) | `investigation.test.js`, `complaints.test.js` |
| FR7 | Privacy Dashboard | `routes/dashboard.js`, `socket/dashboardNamespace.js` | `dashboard.test.js`, `privacyDashboard.test.js` |

---

## PILLAR 1 — Trip Lifecycle Management (FR1)

### What FR1 says
Fleet managers can create bookings, assign drivers and vehicles, manage a roster, and send
notifications. Without an active trip record, no other privacy mechanism can be triggered —
no credentials issued, no communication channel opened, no conditional persistence activated.

### Key concept: The Trip as a State Machine
The trip status column in PostgreSQL is the single source of truth for the entire system.
Every privacy mechanism is triggered by a status transition.

```
pending → accepted → in_progress → completed
                  ↓                 ↓
               cancelled         cancelled (not allowed at in_progress)
```

### Code: Status-gated driver assignment (trips.js:68–152)

```javascript
// [FR1] Trip Lifecycle — Driver Assignment
// This endpoint uses a PostgreSQL transaction (BEGIN/COMMIT) to prevent two
// managers from assigning the same driver or vehicle simultaneously. Without
// the transaction, a race condition could put the same driver on two trips.
router.patch('/:tripId/assign', requireAuth(['fleet_manager']), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start atomic block — all checks or nothing

        // Guard 1: Trip must be 'pending' — you cannot assign to an accepted trip
        // This ensures the state machine is respected and assignment only happens once
        const tripCheck = await client.query(
            'SELECT id FROM trips WHERE id = $1 AND status = $2',
            [tripId, 'pending']
        );
        if (tripCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Trip is not in pending status' });
        }

        // Guard 2: Driver conflict — cannot assign a driver already on an active trip
        // 'accepted' and 'in_progress' are both active states
        const driverConflict = await client.query(
            `SELECT id FROM trips WHERE assigned_driver_id = $1
             AND status IN ('accepted', 'in_progress')`,
            [driver_id]
        );
        if (driverConflict.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Driver already on an active trip' });
        }

        // Guard 3: Vehicle conflict — same logic for the physical vehicle
        const vehicleConflict = await client.query(
            `SELECT id FROM trips WHERE vehicle_id = $1
             AND status IN ('accepted', 'in_progress')`,
            [vehicle_id]
        );
        if (vehicleConflict.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Vehicle already deployed' });
        }

        // Only reaches here if all 3 guards pass — atomically assign
        await client.query(
            `UPDATE trips SET assigned_driver_id = $1, vehicle_id = $2,
             status = 'accepted', eta = $4 WHERE id = $3`,
            [driver_id, vehicle_id, tripId, eta]
        );

        await client.query('COMMIT'); // All checks passed — commit the transaction
    }
```

### Code: Session creation on trip acceptance (trips.js:244–275)

```javascript
// [FR4] Ephemeral Credential Management — Session Creation
// When the driver accepts, two Redis sessions are created. These are the
// technical credentials that gate the WebSocket channel. Both have a 24-hour
// TTL — they expire automatically without any code needing to delete them.
router.patch('/:tripId/accept', requireAuth(['driver']), async (req, res) => {

    // Status check: only the assigned driver can accept, only if status is 'accepted'
    const tripCheck = await query(
        'SELECT id, client_corporate_email FROM trips WHERE id = $1 AND assigned_driver_id = $2 AND status = $3',
        [tripId, driverId, 'accepted']
    );

    // Transition to in_progress — this is the moment the communication channel opens
    await query(`UPDATE trips SET status = 'in_progress' WHERE id = $1`, [tripId]);

    // Create driver-side session in Redis (24h TTL)
    // This key gates the driver's ability to access the WebSocket relay
    await setSession(`session:trip:${tripId}:driver`, { driver_id: driverId }, 86400);

    // Create client-side session in Redis (24h TTL)
    // Note: client_corporate_email is stored here, but the DRIVER never sees it —
    // only the relay server uses it to route messages. This is FR3 (mediated comms).
    await setSession(`session:trip:${tripId}:client`, { client_email: tripCheck.rows[0].client_corporate_email }, 86400);
```

### Code: Session destruction on trip completion (trips.js:278–319)

```javascript
// [FR4] Ephemeral Credential Management — Session Destruction
// [FR5] Conditional Persistence — Window Creation
// Trip completion triggers three simultaneous actions:
//   1. Redis sessions deleted → WebSocket credentials destroyed → channel closes
//   2. complaint:window key created with 24h TTL → this is the ONLY mechanism
//      that allows a complaint to be filed. When this key expires, complaints
//      are physically impossible regardless of any application logic.
//   3. session_closed emitted to all connected clients → UI transitions to end state
router.patch('/:tripId/complete', requireAuth(['driver']), async (req, res) => {

    // Mark trip as completed in PostgreSQL
    const result = await query(`UPDATE trips SET status = 'completed' WHERE id = $1`, [tripId]);

    // Destroy ephemeral credentials — no rollback possible. The communication
    // link between client and driver is permanently severed here.
    await deleteSession(`session:trip:${tripId}:driver`);
    await deleteSession(`session:trip:${tripId}:client`);

    // Open the complaint window — 24h TTL in Redis
    // This is purpose-limited persistence: the window only exists to allow a complaint.
    // When it expires, Redis auto-deletes the key. The backend physically cannot process
    // complaints after this — it's enforced by infrastructure, not by code logic.
    await setSession(`complaint:window:${tripId}`, { active: true }, 86400);

    // Broadcast WebSocket event — all parties (driver + client) receive this
    io.to(`trip:${tripId}`).emit('session_closed', {
        tripId,
        reason: 'Trip completed — communication channel closed',
        complaint_window_hours: 24
    });
```

### What the examiner might ask
- **"Why a transaction for assignment?"** — Race condition: without BEGIN/COMMIT, two
  concurrent requests could both read 0 conflicts and both assign the same driver.
- **"Why Redis for sessions instead of the database?"** — Redis auto-expires keys via TTL,
  which means session destruction is guaranteed by infrastructure, not by cleanup code
  that could be skipped or fail.
- **"What happens if the server crashes mid-trip?"** — Redis TTL still expires. The session
  keys have 86400s TTL regardless of server state. The driver loses WebSocket access after
  24 hours even if no explicit deletion happened.

---

## PILLAR 2 — Client Authentication via Email-Delivered Token (FR2)

### What FR2 says
Clients have no persistent accounts. Access is granted through a single-use token sent to
the corporate email, which expires when the trip session ends. The email inbox is the
identity proof — only whoever controls that inbox can authenticate.

### Why this matters (from your survey)
18.2% of operators had any access controls at all. The standard was: give the client a phone
number. This system makes it architecturally impossible for the client's identity to cross
the operator boundary — the driver never sees the email, phone, or surname.

### Code: Token generation at booking (bookings.js:69–96)

```javascript
// [FR2] Client Authentication — EDAT Generation
// crypto.randomBytes(32) generates 256 bits of cryptographic entropy.
// This is the same entropy level used by HTTPS session keys — practically
// unguessable even with a powerful attacker attempting brute force.
const token = crypto.randomBytes(32).toString('hex'); // 64 hex characters

// The token is stored in Redis against the trip_id and email.
// TTL: 86400 seconds (24 hours). If the client does not click the link
// within 24 hours, the token is gone and they must request a new one.
await setSession(
    `booking_access_token:${token}`,  // key: booking_access_token:{64-char-hex}
    { client_corporate_email, trip_id: tripId }, // value: what this token grants access to
    86400  // TTL — mandatory, no session without expiry
);

// The magic link is sent to the corporate inbox ONLY — never in the response body.
const magicLink = `${process.env.CLIENT_ORIGIN}/booking?token=${token}`;
await sendEmail({ to: client_corporate_email, ... });

// CRITICAL: The token is NOT returned in the HTTP response.
// If an attacker intercepts this API response, they get nothing useful.
// The email inbox is the mandatory second factor.
return res.status(201).json({
    message: 'Booking confirmed. A secure access link has been sent to your corporate email.',
    trip_id: tripId  // Only the trip ID is returned — not the token
});
```

### Code: Token validation and HttpOnly cookie issuance (bookings.js:115–195)

```javascript
// [FR2] Client Authentication — EDAT Validation and Session Establishment
router.get('/auth', async (req, res) => {
    const { token } = req.query; // Token arrives via URL from the email link

    // Look up the token in Redis
    const sessionData = await getSession(`booking_access_token:${token}`);
    if (!sessionData) {
        // Token doesn't exist = already used, expired, or fabricated
        return res.status(401).json({ error: 'Invalid or expired access link' });
    }

    // SINGLE-USE ENFORCEMENT: Delete the token immediately on first read.
    // If someone intercepts the URL (e.g., email forwarding, shared screens),
    // they cannot replay it — it's gone after the first click.
    await deleteSession(`booking_access_token:${token}`);

    // Calculate session lifetime tied to trip duration
    // pickup_time + 72h covers the entire possible trip duration + the 48h complaint window
    // Floor of 24h prevents zero-TTL sessions for imminent pickups
    const expiresAt = Math.max(pickupMs + 72 * 60 * 60 * 1000, Date.now() + 24 * 60 * 60 * 1000);
    const ttlSecs = Math.floor((expiresAt - Date.now()) / 1000);

    const jwtToken = jwt.sign(
        { client_corporate_email, trip_id, role: 'client' },
        process.env.JWT_SECRET,
        { expiresIn: ttlSecs }
    );

    // Store JWT as an HttpOnly cookie — the browser stores it, client-side JS cannot read it.
    // httpOnly: true  → XSS payloads cannot steal this token with document.cookie
    // secure: true    → only sent over HTTPS (prevents network interception)
    // sameSite: strict → browser refuses to send cookie on cross-site requests (CSRF)
    res.cookie('client_session', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: ttlSecs * 1000
    });

    // The JWT itself is NEVER sent in the response body.
    // The cookie is set by the browser's native mechanism — JS never touches it.
    return res.status(200).json({
        message: 'Session established',
        trip_id: sessionData.trip_id,
        client_first_name: firstName
        // No token here — client JS has the trip_id, not the credential
    });
});
```

### Code: clientAuth middleware (middleware/clientAuth.js)

```javascript
// [FR2] Why this middleware is different from the manager/driver middleware:
// Manager and driver tokens arrive in the Authorization: Bearer header — readable by JS.
// Client tokens are in an HttpOnly cookie — invisible to JS entirely.
// This distinction is why clients get a separate middleware.
export const requireClientAuth = (req, res, next) => {

    // Read from the HttpOnly cookie — if an XSS payload tried req.cookies.client_session,
    // it would work here, but document.cookie in the browser cannot see it at all.
    // The XSS protection is enforced at the browser layer, not the server layer.
    const token = req.cookies.client_session;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Prevent a leaked fleet_manager JWT from being used as a client session
    // This closes the gap where a compromised manager token could impersonate a client
    if (decoded.role !== 'client') throw new Error('Invalid role');

    req.client = decoded; // Attach payload — routes use req.client.trip_id for scoping
    next();
};
```

### What the examiner might ask
- **"What stops someone from guessing the token?"** — 32 random bytes = 256-bit entropy.
  Even at 1 billion guesses/second, brute force takes 3.67 × 10^60 years.
- **"What if the email is forwarded?"** — Single-use deletion. First click consumes it.
- **"Why not just return the token and store it in localStorage like a normal app?"** —
  localStorage is readable by any JS on the page. An XSS attack in an email client or the
  PWA would steal the token. HttpOnly cookies cannot be read by JS at all.

---

## PILLAR 3 — Server-Mediated Communication (FR3)

### What FR3 says
100% of drivers in the survey received client contact details at assignment — phone, email,
everything. FR3 says the driver communicates through a scoped session channel with no
visibility of client identity. The confinement is architectural — the driver layer physically
cannot receive client contact details regardless of what the manager does.

### Key mechanism: Data minimization in SQL queries

```javascript
// [FR3] Server-Mediated Communication — Data Minimisation at Query Layer
// The JOIN to the drivers table explicitly names only the columns the client
// is allowed to see. `d.full_name` only — NOT `d.work_email`, NOT `d.employee_id`.
// These fields exist in the database but the query boundary prevents them
// from ever leaving the backend and reaching the client's device.
const tripResult = await query(
    `SELECT
        t.id,
        t.status,
        t.pickup_location,
        t.destination,
        t.pickup_time,
        t.eta,
        d.full_name AS driver_name,      -- Only first name, not email or employee_id
        v.make AS vehicle_make,          -- Vehicle make/model/plate is allowed
        v.model AS vehicle_model,        -- (client needs to identify the car)
        v.registration_number AS vehicle_plate,
        v.type AS vehicle_type
        -- work_email, employee_id, phone — intentionally excluded
     FROM trips t
     LEFT JOIN drivers d ON t.assigned_driver_id = d.id
     LEFT JOIN vehicles v ON t.vehicle_id = v.id
     WHERE t.id = $1`,
    [tripId]
);
```

```javascript
// [FR3] The Redis session for the driver does NOT contain the client's email.
// The client email is in the client-side session key, which only the relay server reads.
// The driver's Redis key contains only driver_id — the relay server knows
// which room to route to, but the driver never gets the client's identity.
await setSession(
    `session:trip:${tripId}:driver`,
    { driver_id: driverId },  // No client_corporate_email here
    86400
);
await setSession(
    `session:trip:${tripId}:client`,
    { client_email: tripCheck.rows[0].client_corporate_email },  // In client key only
    86400
);
// The WebSocket relay uses both keys to authenticate each side,
// but it never exposes one side's key contents to the other side.
```

### Code: WebSocket relay — messages carry sender role, not identity

The relay is in `backend/socket/io.js`. Messages are stored as `{ from: 'driver' }` or
`{ from: 'client' }` — the role label, not the email address. Even in the encrypted message
archive, no personally identifiable information is stored alongside the messages.

### What the examiner might ask
- **"What if the manager just looks at the DB and gives the driver the client's email?"** —
  That's a policy violation, not a technical one. But the system ensures the driver's device
  never receives it automatically. FR3's claim is that contact details cannot reach the driver
  through the system — which is true.
- **"How do messages get routed if neither side knows the other's identity?"** — The relay
  server holds the `session:trip:{id}:client` key privately. It authenticates both parties
  against their respective session keys and routes messages by trip room ID only.

---

## PILLAR 4 — Ephemeral Credential Management (FR4)

### What FR4 says
93.8% of drivers retained client data after trip completion — with no technical deletion
mechanism. FR4 says driver JWTs are trip-bound, expiring automatically. The Redis mapping
of who communicated with whom is destroyed on completion. No persistent link between
client and driver survives past the trip.

### The three-layer ephemeral guarantee

| Layer | What gets destroyed | When | Mechanism |
|-------|---------------------|------|-----------|
| Redis session keys | `session:trip:{id}:driver`, `session:trip:{id}:client` | On trip completion | Explicit `deleteSession()` call |
| WebSocket channel | Trip room `trip:{tripId}` | On `session_closed` event | All parties disconnect |
| Client cookie | `client_session` | On `POST /bookings/logout` or JWT expiry | Cookie cleared / JWT exp |

### Code: Token revocation (auth.js:74–108)

```javascript
// [FR4] Ephemeral Credential Management — JWT Revocation via Redis Blocklist
// JWTs are stateless: once issued, the server cannot "cancel" them by default.
// A valid JWT remains valid until its exp claim passes, even after logout.
// Solution: on logout, store the token in Redis with TTL = remaining lifetime.
// The middleware checks this blocklist BEFORE verifying the JWT signature.
// Redis auto-evicts the entry when the token would have expired anyway —
// no permanent state, no zombie revocation records.
router.post('/logout', async (req, res) => {
    const token = authHeader.slice(7);

    // jwt.decode() reads the payload WITHOUT verifying the signature.
    // We only need the exp claim to compute remaining TTL — we don't need to
    // re-verify here because a forged token with a fake exp would just get a
    // wrong TTL, and the middleware's verify() call will catch it anyway.
    const decoded = jwt.decode(token);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - nowSeconds; // Seconds until token would expire

    if (ttl > 0) {
        // Store: key = "blocklist:{full token}", value = true, TTL = remaining life
        // Redis auto-evicts this when the token would have expired naturally
        await setSession(`blocklist:${token}`, true, ttl);
    }
    // If ttl <= 0: token already expired — no need to blocklist it
});
```

### Code: Blocklist check in middleware (middleware/auth.js:25–30)

```javascript
// [FR4] This check runs BEFORE jwt.verify() — a fast Redis read before expensive crypto.
// If the token is blocklisted (logout was called), reject immediately.
// This is how a logged-out session is invalidated even though the JWT is still
// cryptographically valid and hasn't expired yet.
const isBlocklisted = await getSession(`blocklist:${token}`);
if (isBlocklisted) {
    return res.status(401).json({ error: 'Session invalidated' });
}

// Only if not blocklisted do we perform the full JWT signature verification
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Code: Driver deactivation defence (middleware/auth.js:41–49)

```javascript
// [FR4] Extra defence for drivers: even a valid JWT cannot be used if the driver
// account has been deactivated in the database. This handles the case where a
// driver is terminated — the manager can deactivate the account and the JWT
// becomes useless immediately, without waiting for it to expire or explicitly
// blocklisting it. The DB check is the safety net.
if (decoded.role === 'driver') {
    const driverCheck = await query(
        'SELECT active_status FROM drivers WHERE id = $1',
        [decoded.id]
    );
    if (driverCheck.rows.length === 0 || !driverCheck.rows[0].active_status) {
        return res.status(401).json({ error: 'Account deactivated' });
    }
}
```

---

## PILLAR 5 — Conditional Persistence (FR5)

### What FR5 says
81.8% of managers had difficulty resolving complaints because records were unavailable.
But 72.7% retained records indefinitely with no deletion. FR5 resolves this tension:
messages live in Redis during the trip. They're only archived to the database if a complaint
is filed within 24 hours. Otherwise, the TTL expires and everything is permanently gone —
the system is architecturally incapable of retaining content beyond necessity.

### The conditional persistence flow

```
Trip in_progress
    ↓
Chat messages → Redis: messages:trip:{id} (list, TTL = 24h)
    ↓
Trip completed → Redis: complaint:window:{id} created (TTL = 24h)
    ↓
  ┌─ Complaint filed within 24h?
  │   YES → encrypt messages (AES-256-GCM) → save to PostgreSQL
  │         → delete Redis buffer immediately
  │         → complaint window key still exists (allows no second complaint)
  │
  └─ NO (window expires) → Redis auto-deletes messages:trip:{id}
                         → No PostgreSQL record ever created
                         → Data is gone with no recovery path
```

### Code: Conditional persistence logic (complaints.js:80–113)

```javascript
// [FR5] Conditional Persistence — The Heart of the Privacy Architecture
//
// This block runs ONLY when a complaint is successfully filed.
// It reads the live Redis message buffer, encrypts everything with AES-256-GCM,
// writes the ciphertext to PostgreSQL, then immediately deletes the Redis copy.
//
const bufferKey = `messages:trip:${tripId}`;
const rawBuffer = await redisClient.lRange(bufferKey, 0, -1); // Read all messages

if (rawBuffer && rawBuffer.length > 0) {
    const parsedMessages = rawBuffer.map(msg => JSON.parse(msg)); // Parse each message
    const stringifiedPayload = JSON.stringify(parsedMessages);    // Serialize the array

    // Encrypt the entire message history as one block
    // AES-256-GCM provides both confidentiality (nobody can read it) and
    // integrity (nobody can tamper with it without detection)
    const encryptedArchive = encrypt(stringifiedPayload);

    // Write ciphertext to PostgreSQL — not plaintext, not the raw messages
    await pool.query(
        `UPDATE complaints SET encrypted_message_archive = $1 WHERE id = $2`,
        [encryptedArchive, complaintId]
    );

    // Delete the Redis buffer IMMEDIATELY after archiving.
    // WHY: Once messages are in PostgreSQL, the Redis copy is redundant.
    // Leaving it would violate data minimisation — you'd have two copies.
    // This deletion is intentional and permanent.
    await redisClient.del(bufferKey);
}
// If rawBuffer is empty: complaint is filed but there were no messages.
// Complaint record exists with encrypted_message_archive = NULL — that's fine.
// If no complaint is ever filed: this entire block is never reached.
// The Redis key expires by TTL and messages are gone permanently.
```

### Code: AES-256-GCM encryption (utils/encryption.js)

```javascript
// [FR5] Message Archive Encryption — Why AES-256-GCM specifically?
//
// AES-256: 256-bit key = 2^256 possible keys. Brute force is computationally
//          infeasible even with all computers on Earth running until the sun dies.
//
// GCM (Galois/Counter Mode): Provides an Authentication Tag. If even one byte
//          of the ciphertext is changed after encryption (e.g. DB tampering),
//          decryption fails with an authentication error. This is 'authenticated
//          encryption' — it gives both secrecy AND integrity.
//
// scryptSync: Derives the 32-byte encryption key from JWT_SECRET using the
//          scrypt KDF (key derivation function). scrypt is deliberately slow
//          (uses memory + CPU), making brute force of the key very expensive.
//          The key is derived at runtime and never stored anywhere.

export function encrypt(plaintext) {
    // Derive key from JWT_SECRET at runtime — never stored, only in memory
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'fleet-ops-salt', 32);

    // Random 16-byte IV (Initialization Vector) per encryption.
    // WHY random: if the same IV were reused, patterns in plaintexts would
    // leak through the ciphertext. A random IV makes each encryption unique.
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // GCM authentication tag — 16 bytes that verify the ciphertext hasn't been tampered
    const authTag = cipher.getAuthTag();

    // Return IV + auth tag + ciphertext as JSON string for storage in TEXT column
    // The IV must be stored (to decrypt later) but is NOT secret
    return JSON.stringify({
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
        data: encrypted
    });
}

export function decrypt(encryptedJson) {
    const { iv, tag, data } = JSON.parse(encryptedJson);

    // Re-derive the SAME key — scrypt with the same inputs always produces the same key
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'fleet-ops-salt', 32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));

    // Set the auth tag — if the ciphertext was tampered with, this will throw
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8'); // Throws if auth tag doesn't match

    return decrypted;
}
```

### What the examiner might ask
- **"What if someone steals the database?"** — The archive is ciphertext. Without
  `JWT_SECRET` and the production server environment, it's meaningless.
- **"What if no messages were sent?"** — The `encrypted_message_archive` column is NULL.
  The complaint is still valid and can be investigated — only no message archive exists.
- **"Why delete the Redis buffer immediately after archiving?"** — Data minimisation: once
  the archive is in PostgreSQL, having a second copy in Redis serves no purpose. Under the
  DPA 2019 s.25, holding data beyond its purpose is a violation.

---

## PILLAR 6 — Complaint Investigation & Resolution (FR6)

### What FR6 says
18.8% of drivers had been formally accused with no way to prove what was communicated.
FR6 creates a gated investigation process: managers must explicitly advance a complaint
to `under_investigation` before the message archive is accessible. Every access is logged.

### The three-stage gate

```
Complaint filed (status = 'open')
    ↓
Manager views complaint list — encrypted_message_archive NOT returned
    ↓
Manager explicitly sets status = 'under_investigation'
    ↓
GET /:complaintId/messages — archive decrypted, access logged in audit_log
    ↓
Manager sets status = 'resolved' (terminal state — cannot re-open)
```

### Code: Status-gated archive access (complaints.js:204–249)

```javascript
// [FR6] Complaint Investigation — Gated Message Archive Access
//
// The archive is ONLY accessible when status = 'under_investigation'.
// A manager cannot browse messages simply because a complaint exists.
// They must make an explicit decision to open an investigation first.
// WHY: This creates an auditable accountability layer. If a manager
// accesses messages without good reason, there is a documented trail.
//
router.get('/:complaintId/messages', requireAuth(['fleet_manager']), async (req, res) => {

    const complaint = result.rows[0];

    // Gate: status must be 'under_investigation' — not 'open', not 'resolved'
    if (complaint.status !== 'under_investigation') {
        return res.status(403).json({
            error: 'Message archive only accessible during active investigation'
        });
    }

    // Decrypt the archive — this is the only place decryption happens
    const rawPlaintext = decrypt(complaint.encrypted_message_archive);
    const messagesArray = JSON.parse(rawPlaintext);

    // EVERY decryption is logged. Not on a timer, not sampling — every single access.
    // actor_id = the manager's UUID, so the individual manager is accountable.
    await pool.query(
        `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            'MESSAGE_ARCHIVE_ACCESSED',
            req.user.id,         // Which specific manager
            'fleet_manager',
            complaintId,
            JSON.stringify({ accessed_at: new Date().toISOString() })
        ]
    );

    return res.status(200).json({ messages: messagesArray });
});
```

### Code: Driver notification on investigation (complaints.js:343–358)

```javascript
// [FR6] Driver Notification — No PII disclosed
// When a complaint enters investigation, the assigned driver is notified via push.
// The notification body contains no complaint details, no client information,
// no description — only that "a review is in progress". This protects client
// anonymity while still giving the driver fair notice.
if (status === 'under_investigation') {
    await sendPushNotification(driverId, {
        title: 'Trip Review In Progress',
        body: 'A review has been opened for one of your recent trips.',
        type: 'complaint_review',
        // No complaint_id, no client_email, no description — by design
    });
}
```

---

## DATABASE SCHEMA — Privacy-First Design (schema.sql)

### Why this schema is itself an implementation of FRs

| Table | FR it implements | Key design decision |
|-------|-----------------|---------------------|
| `trips` | FR1, FR3 | `client_first_name` ONLY — no surname, no phone. Schema-level data minimisation. |
| `complaints` | FR5, FR6 | `encrypted_message_archive TEXT` — nullable. Only populated when complaint filed. |
| `audit_log` | FR6, FR7 | Append-only. `legal_basis`, `destruction_hash` columns satisfy DPA 2019. |
| `push_subscriptions` | FR1 | `ON DELETE CASCADE` — driver deleted → subscriptions auto-removed, no orphaned endpoints. |
| `client_push_subscriptions` | FR1, FR2 | Keyed by `client_email`, not UUID — clients have no persistent ID in any table. |

### Code: Data minimisation at schema level

```sql
-- [FR1 + FR3] trips table — the core of the system
-- PRIVACY CONSTRAINT: client_first_name only.
-- No last_name column exists. No phone_number column exists.
-- Even if a developer tried to insert surname or phone, there is no column to store it.
-- The database schema enforces data minimisation — it cannot be bypassed by application code.
CREATE TABLE IF NOT EXISTS trips (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_corporate_email TEXT        NOT NULL,
    client_first_name      TEXT        NOT NULL,  -- first name only, no surname
    -- client_last_name: not here intentionally
    -- phone_number: not here intentionally
    pickup_location        TEXT        NOT NULL,
    destination            TEXT        NOT NULL,
    pickup_time            TIMESTAMPTZ NOT NULL,
    status                 TEXT        NOT NULL DEFAULT 'pending'
                                       CHECK (status IN (
                                           'pending', 'accepted', 'in_progress',
                                           'completed', 'cancelled'
                                       )), -- State machine enforced by DB constraint
    assigned_driver_id     UUID        REFERENCES drivers(id) ON DELETE SET NULL,
    eta                    TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
-- [FR6 + FR7] audit_log — append-only compliance ledger
-- Append-only enforced at DB role level: UPDATE and DELETE are revoked.
-- legal_basis: records which section of DPA 2019 justifies this data operation
-- destruction_hash: SHA-256 proof that session data was destroyed (DPA 2019 s.41)
-- data_subjects: JSONB — tracks which data subjects are affected by this operation
CREATE TABLE IF NOT EXISTS audit_log (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type        TEXT        NOT NULL,   -- e.g. 'TRIP_COMPLETED', 'MESSAGE_ARCHIVE_ACCESSED'
    actor_id           UUID        NOT NULL,   -- Who did this (manager, driver, or trip_id for clients)
    actor_role         TEXT        NOT NULL,   -- 'fleet_manager', 'driver', 'client', 'system'
    target_id          UUID,                   -- What was acted on
    timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details            JSONB,                  -- Structured metadata (old/new status, message counts)
    legal_basis        TEXT,                   -- DPA 2019 section reference
    destruction_hash   TEXT,                   -- SHA-256 hex of destroyed session data
    data_subjects      JSONB                   -- Which data subjects affected
);
-- No UPDATE or DELETE permissions granted to the application role.
-- Records can only be INSERTed — the ledger is permanent.
```

### Redis vs PostgreSQL — why the split?

| Data type | Stored in | Why |
|-----------|-----------|-----|
| Active sessions, tokens | Redis | Auto-expires via TTL — destruction is guaranteed by infrastructure |
| Trip records | PostgreSQL | Permanent business records needed for billing, assignment history |
| Message buffer | Redis | Ephemeral — auto-destroyed if no complaint. Never hits the DB unless needed. |
| Encrypted message archive | PostgreSQL | Only when complaint filed — conditional, encrypted, purpose-limited |
| Audit log | PostgreSQL | Permanent, append-only, compliance requirement |
| JWT blocklist | Redis | Needs to be fast (checked on every request). Expires with the token naturally. |

---

## TESTING STRATEGY BREAKDOWN

### How to describe your testing approach

Your test suite has **14 files and ~89 tests**. All tests use real infrastructure:
real PostgreSQL, real Redis, real Socket.IO — via Supertest. This is a deliberate choice:
mocking the database would have hidden the exact class of bug that caused problems in similar
projects (tests pass, production fails when the DB schema diverges from the mock).

### 1. Integration Testing (primary strategy)

**Definition:** Tests that exercise multiple layers together — HTTP endpoint → Express route →
PostgreSQL query → Redis operation → Response body. Real infrastructure, no mocks.

**Where:** All 14 test suites. The standard pattern is:

```javascript
// From trips.test.js — a typical integration test
it('Test 2: Manager assigns driver, status transitions to accepted', async () => {
    const res = await request(app)           // HTTP layer — Supertest sends real HTTP
        .patch(`/api/trips/${tripId}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ driver_id: driverId, vehicle_id: vehicleId });

    expect(res.status).toBe(200);             // HTTP response verified
    expect(res.body.status).toBe('accepted'); // DB state verified via response

    // Then verify the DB directly — not trusting the response alone
    const dbCheck = await pool.query('SELECT status FROM trips WHERE id = $1', [tripId]);
    expect(dbCheck.rows[0].status).toBe('accepted'); // Ground truth: what's actually in PostgreSQL
});
```

**Why it proves your claims:** The test touches the full stack. If the Redis session is not
created, or the DB constraint fires, or the JWT is rejected — the test fails at the right
layer with a real error.

---

### 2. Black-Box API Testing

**Definition:** Tests that treat each endpoint as a black box — you send an HTTP request and
verify the HTTP response. You don't look at the internals, only inputs and outputs.

**Where:** Auth tests, RBAC tests, status code verification.

```javascript
// From auth.test.js Test 3 — pure black box
// You only know: "a logged-out token should be rejected"
// You don't care HOW it's rejected internally (Redis blocklist, middleware, etc.)
it('Test 3: Logged-out token is rejected on subsequent requests', async () => {
    // Step 1: Call logout
    await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

    // Step 2: Try to use the same token — treat the system as a black box
    const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${token}`);

    // Black-box assertion: only verify the HTTP response, not the internals
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Session invalidated');
});
```

```javascript
// From driverAuth.test.js Tests 4–5 — RBAC black box
// "A driver token should not work on manager routes and vice versa"
it('Scenario 4: Driver cannot access fleet manager routes', async () => {
    const res = await request(app)
        .get('/api/trips')               // Manager-only route
        .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(403);        // Black box: we verify the output, not how RBAC works
    expect(res.body.error).toBe('Insufficient permissions');
});
```

---

### 3. Functional Testing (scenario-based)

**Definition:** Tests that verify the system does what it's supposed to do from an end-user
or research perspective — not just that individual endpoints return 200, but that complete
workflows produce the correct outcome.

**Where:** `conditionalPersistence.test.js` (3 scenarios), `privacyDashboard.test.js` (8 stages).

```javascript
// From conditionalPersistence.test.js — Scenario 2
// This is a FUNCTIONAL test: it validates the entire conditional persistence
// workflow as a sequence of real operations, proving FR5 works end-to-end.
it('Scenario 2: Complaint filed within window — messages conditionally persisted', async () => {
    // Stage 1: Create completed trip context
    // Stage 2: Populate Redis with simulated chat messages
    // Stage 3: File complaint via the API
    // Stage 4: Verify messages moved from Redis → PostgreSQL (encrypted)
    // Stage 5: Verify Redis buffer was deleted
    // Stage 6: Advance to under_investigation
    // Stage 7: Decrypt and verify message contents
    // Stage 8: Verify audit log contains MESSAGE_ARCHIVE_CREATED and MESSAGE_ARCHIVE_ACCESSED

    // The test proves the ENTIRE FR5 workflow — not just one endpoint
});
```

---

### 4. Unit Testing (encryption functions)

**Definition:** Tests that verify a single function in isolation, with no external dependencies.

**Where:** The `encrypt()` and `decrypt()` functions in `utils/encryption.js` are pure
functions with no I/O dependencies — they take a string and return a string. They can be
tested without any database or Redis connection.

```javascript
// How you would describe the unit test for encrypt/decrypt:
// Input: any plaintext string
// Expected output: decrypt(encrypt(x)) === x
// And: encrypt(x) !== x (ciphertext is different from plaintext)
// And: two calls to encrypt(x) produce different ciphertext (random IV)
// These are unit tests because they test the function, not the system.

const plaintext = 'Hello from the driver';
const ciphertext = encrypt(plaintext);

expect(ciphertext).not.toBe(plaintext);          // Encryption happened
expect(decrypt(ciphertext)).toBe(plaintext);      // Decryption recovers original
expect(encrypt(plaintext)).not.toBe(ciphertext);  // Random IV means different output each time
```

Even though these specific unit tests aren't in a separate file, the `investigation.test.js`
file exercises the encrypt/decrypt pair as part of its integration tests — validating that
the encryption functions work correctly in the context of the complaint archive.

---

### 5. Security Testing (structural validation)

**Definition:** Tests that verify the system's security guarantees hold — that access control
cannot be bypassed, data cannot leak across boundaries, and privacy mechanisms work correctly.

**Where:** Distributed across multiple files:

| Security property tested | File | Test |
|--------------------------|------|------|
| Token single-use (replay blocked) | `bookings.test.js` | Scenario 2: token consumed on first use |
| Token not in response body | `bookings.test.js` | Scenario 1: response body has no token field |
| Driver can't see client email | `driverTrips.test.js` | Test 1–2: `client_corporate_email` undefined in response |
| Manager can't see encrypted archive without investigation | `investigation.test.js` | Test 1: archive undefined when status=open |
| Cross-client access blocked | `complaints.test.js` | Test 3: 403 when accessing another client's trip |
| RBAC enforced | `driverAuth.test.js` | Tests 4–5: 403 on wrong role |
| Deactivated driver rejected | `roster.test.js` | Test 3: 401 on deactivated account |
| Complaint window physically closes | `complaints.test.js` | Test 2: 403 after window expires |

```javascript
// From driverTrips.test.js — Security test: data minimisation
it('Test 1: Driver trip view does not expose client corporate email', async () => {
    const res = await request(app)
        .get(`/api/driver/trips/${tripId}`)
        .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    // The assertion that proves data minimisation:
    // If this field were in the response, the test would fail —
    // which means this test will catch any future accidental exposure
    expect(res.body.client_corporate_email).toBeUndefined();
    expect(res.body.client_email).toBeUndefined();
});
```

---

## QUICK REFERENCE — Examiner Questions and Answers

| Question | Where to look | Answer |
|----------|--------------|--------|
| "How does the client authenticate?" | `bookings.js` /auth | Single-use Redis token → HttpOnly cookie JWT |
| "How are messages kept private?" | `complaints.js` POST, `encryption.js` | Redis buffer → AES-256-GCM → PostgreSQL on complaint only |
| "How does the driver get assigned?" | `trips.js` PATCH /assign | PostgreSQL transaction with 3 conflict guards |
| "What happens to data after the trip?" | `trips.js` PATCH /complete | Redis sessions deleted, complaint window opened (24h TTL) |
| "How is the audit trail append-only?" | `schema.sql` audit_log | DB role has no UPDATE/DELETE permission on audit_log |
| "What testing did you do?" | `tests/` directory | 14 suites, 89 tests, integration + black-box + functional + security |
| "How is encryption keyed?" | `encryption.js` | scryptSync(JWT_SECRET, salt, 32) — key in memory only |
| "Can a driver see a client's name?" | `bookings.js` GET /:tripId query | `d.full_name` only — work_email and employee_id not selected |
| "What is conditional persistence?" | `conditionalPersistence.test.js` | Messages in Redis → encrypted DB only if complaint filed |
| "How is RBAC enforced?" | `middleware/auth.js` | allowedRoles array checked against decoded.role |
