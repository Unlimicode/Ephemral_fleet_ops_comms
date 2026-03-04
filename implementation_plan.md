# Implementation Plan — Privacy-Preserving Fleet Operations Communication System

**Project:** SCT221-0593/2022 — Ian Lemashon Sopia  
**Supervisor:** Dr. Dennis Najgi  
**Institution:** Jomo Kenyatta University of Agriculture and Technology  
**Stack:** Node.js, Express, PostgreSQL (Supabase), Redis (Upstash), Socket.IO, React PWA  

This document is the engineering log for the system build. Each entry records what was built, what files were changed, and why each decision matters to the system architecture. Entries are appended chronologically as phases are completed.

---

## Sprint 1 — Infrastructure Foundation

### Phase 1.1 — Project Scaffold
**Files created:** `backend/`, `frontend/`, `.gitignore`, `.nvmrc`, `README.md`  
**What was built:** Monorepo structure separating backend API from frontend PWA. Node version locked via `.nvmrc` to ensure consistent execution across development and CI environments.  
**Architectural relevance:** Clean separation of concerns between API layer and client layer from the start.

### Phase 1.2 — CI Pipeline
**Files created:** `.github/workflows/ci.yml`  
**What was built:** GitHub Actions workflow running backend tests and frontend lint/build checks on every push to main. Backend job connects to real Supabase and Upstash instances via GitHub secrets.  
**Architectural relevance:** Every commit is verified against real cloud infrastructure, not mocked dependencies. This ensures test results reflect actual production behaviour.

### Phase 1.3 — Database Connection Modules
**Files created:** `backend/config/db.js`, `backend/config/redis.js`  
**What was built:** PostgreSQL connection pool using `pg` library. Redis client using `@redis/client` with TLS enabled for Upstash. Both modules log connection status on startup.  
**Architectural relevance:** Connection modules are imported by all route handlers and helpers. Centralising them means connection configuration is changed in one place.

### Phase 1.4 — PostgreSQL Schema
**Files created:** `backend/database/schema.sql`  
**What was built:** Six-table schema: `fleet_managers`, `drivers`, `vehicles`, `trips`, `complaints`, `audit_log`. Key privacy constraints enforced at schema level: `trips` stores `client_first_name` only — no phone number, no last name. `complaints` has nullable `encrypted_message_archive` column for conditional persistence. `audit_log` has no update or delete permissions.  
**Architectural relevance:** Data minimisation is enforced structurally. A driver receiving trip details cannot receive client contact information because the schema physically does not store it in an accessible form.

---

## Sprint 2 — Fleet Manager Authentication

### Phase 2.1 — Backend Dependencies
**Files modified:** `backend/package.json`, `backend/.env.example`  
**What was built:** Installed `bcryptjs`, `jsonwebtoken`, `nodemailer`. Added `JWT_SECRET` and `JWT_EXPIRES_IN` placeholders to `.env.example`.  
**Architectural relevance:** `bcryptjs` chosen over native `bcrypt` for cross-platform compatibility. JWT implements RFC 7519 stateless tokens required for the ephemeral credential architecture.

### Phase 2.2 — Audit Log Append-Only Enforcement
**Files created:** `backend/database/seed.sql`  
**What was built:** PostgreSQL role `fleet_ops_app` with explicit `REVOKE UPDATE, DELETE ON audit_log`. This prevents any application code — even compromised code — from modifying audit records.  
**Architectural relevance:** The append-only guarantee is enforced at the database permission level, not just application logic. This is a hard security constraint, not a policy.

### Phase 2.3 — Redis TTL Helper Layer
**Files created:** `backend/config/redisHelpers.js`  
**What was built:** Four exported functions wrapping the raw Redis client: `setSession(key, value, ttlSeconds)`, `getSession(key)`, `deleteSession(key)`, `extendSession(key, ttlSeconds)`. TTL is a required argument with no default — accidental persistent storage causes a loud runtime error rather than silent misconfiguration.  
**Architectural relevance:** TTL enforcement is mandatory by API design. Every session key in the system must have an expiry. This is signature-level enforcement of the Mediated Ephemeral Identity framework.

### Phase 2.4 — Fleet Manager Authentication Routes
**Files created:** `backend/routes/auth.js`, `backend/routes/index.js`  
**Files modified:** `backend/server.js`  
**What was built:** `POST /api/auth/login` — verifies fleet manager credentials against `fleet_managers` table using bcryptjs, issues signed JWT. `POST /api/auth/logout` — decodes JWT expiry, stores token in Redis blocklist with TTL equal to remaining token lifetime.  
**Architectural relevance:** Logout is stateless invalidation — the token is stored in Redis only for as long as it would have been valid, then Redis evicts it automatically. No zombie revocation state.

### Phase 2.5 — Auth Middleware
**Files created:** `backend/middleware/auth.js`  
**What was built:** `requireAuth(allowedRoles)` middleware enforcing full security chain: extract Bearer token → check Redis blocklist → verify JWT signature → check role against allowed roles → attach decoded payload as `req.user`. Returns 401 at any failure, 403 on role mismatch.  
**Architectural relevance:** Role-based access control is enforced at the middleware layer. Fleet manager routes and driver routes are structurally separated — a driver token cannot access fleet manager endpoints.

### Phase 2.6 — Auth Integration Tests
**Files created:** `backend/tests/auth.test.js`  
**What was built:** Three tests: valid login returns token, invalid credentials return 401, blocklisted token is rejected after logout.  
**Architectural relevance:** These tests prove the complete JWT lifecycle — issuance, use, and invalidation. The blocklist test specifically proves that logout is enforced server-side, not just client-side.

### Phase 2.7 — Development Seed Script
**Files created:** `backend/database/seedData.js`  
**What was built:** Node.js script that hashes a known test password with bcrypt and inserts a fleet manager account using `INSERT ... ON CONFLICT DO NOTHING` for idempotency.  
**Architectural relevance:** Provides a known test account for CI without hardcoding credentials in the codebase. Test credentials are injected via GitHub secrets.

---

## Sprint 3 — Trip Session Lifecycle

### Phase 3.1 — Trip Creation Endpoint
**Files created:** `backend/routes/trips.js`  
**Files modified:** `backend/routes/index.js`  
**What was built:** `POST /api/trips` — protected by `requireAuth(['fleet_manager'])`. Accepts booking details and inserts a trip record with status `pending`. Returns the created trip.  
**Architectural relevance:** The endpoint accepts `client_first_name` only — no phone number. This is data minimisation enforced at the route layer on top of the schema-level constraint.

### Phase 3.2 — Driver Assignment Endpoint
**Files modified:** `backend/routes/trips.js`  
**What was built:** `PATCH /api/trips/:tripId/assign` — verifies trip is `pending`, verifies driver is active, assigns driver and vehicle, advances status to `accepted`. Uses `SELECT FOR UPDATE` transaction to prevent concurrent assignment race conditions.  
**Architectural relevance:** The assignment endpoint never exposes `client_corporate_email` to the driver layer. The driver receives only what is needed for operational purposes.

### Phase 3.3 — Trip Acceptance and Redis Session Mapping
**Files modified:** `backend/routes/trips.js`  
**What was built:** `PATCH /api/trips/:tripId/accept` — advances trip to `in_progress`, creates two Redis session keys with 86400 second TTL: `session:trip:{tripId}:driver` and `session:trip:{tripId}:client`. Writes `TRIP_SESSION_CREATED` to audit log.  
**Architectural relevance:** This is the technical implementation of the Mediated Ephemeral Identity framework. The Redis session mapping establishes the communication channel without transmitting client contact details to the driver. The 24-hour TTL ensures automatic destruction.

### Phase 3.4 — Trip Completion and Session Destruction
**Files modified:** `backend/routes/trips.js`  
**What was built:** `PATCH /api/trips/:tripId/complete` — deletes both Redis session keys, creates `complaint:window:{tripId}` key with 86400 second TTL, writes `TRIP_SESSION_DESTROYED` to audit log.  
**Architectural relevance:** Session destruction on completion is the technical guarantee that drivers cannot retain access to client communication channels after a trip ends. The complaint window TTL gives clients exactly 24 hours before all records are permanently wiped.

### Phase 3.5 — Trip Status Query Endpoints
**Files modified:** `backend/routes/trips.js`  
**What was built:** `GET /api/trips` — returns all trips for dispatch view. `GET /api/trips/:tripId` — returns single trip. `GET /api/trips/:tripId/session-status` — returns live Redis session state as booleans for each key.  
**Architectural relevance:** The session-status endpoint is the data source for the Privacy Dashboard. It exposes TTL state without revealing message content.

### Phase 3.6 — Trip Lifecycle Integration Tests
**Files created:** `backend/tests/trips.test.js`  
**What was built:** Four tests covering the complete trip lifecycle: trip creation with no phone number field, driver assignment, session creation on acceptance, session destruction on completion with complaint window opening.  
**Architectural relevance:** These tests are machine-verified evidence for Research Question 4. They prove data minimisation, ephemeral session creation, and guaranteed session destruction as technical facts, not claims.

---

## Sprint 4 — WebSocket Relay

### Phase 4.1 — WebSocket Session Validation
**Files created:** `backend/socket/relay.js`, `backend/socket/io.js`  
**Files modified:** `backend/server.js`  
**What was built:** Socket.IO server with connection handler that extracts `tripId` and `role` from handshake auth, validates against Redis session keys, joins authenticated sockets to `trip:{tripId}` room.  
**Architectural relevance:** The Redis session key check is the identity gate. A socket cannot join a trip room without a valid active session. This means only parties with legitimate trip sessions can communicate — enforced at the infrastructure layer.

### Phase 4.2 — Message Relay
**Files modified:** `backend/socket/relay.js`  
**What was built:** `send_message` event handler that re-validates Redis session on every message, constructs message object with `from`, `content`, `timestamp`, emits `receive_message` to entire room.  
**Architectural relevance:** The server never stores message content during relay — it exists only in transit. Re-validation on every message means an expired session is caught immediately, not on reconnection.

### Phase 4.3 — Explicit Channel Closure
**Files modified:** `backend/routes/driverTrips.js`, `backend/socket/io.js`  
**What was built:** On trip completion, `io.to('trip:{tripId}').emit('session_closed', {...})` notifies connected clients immediately with `complaint_window_hours: 24` payload.  
**Architectural relevance:** Explicit notification on channel closure is a UX guarantee — connected parties are informed immediately rather than discovering the closure on their next failed message attempt.

### Phase 4.4 — WebSocket Integration Tests
**Files created:** `backend/tests/relay.test.js`  
**What was built:** Four tests: valid session connection succeeds, invalid session rejected with `auth_error`, message relay reaches both parties with correct `from` field, channel closure event broadcast on trip completion.  
**Architectural relevance:** These tests prove the complete WebSocket privacy guarantee — only legitimate session holders connect, messages relay without identity exposure, channel closes immediately on completion.

---

## Sprint 5 — Client and Driver Authentication

### Phase 5.1 — Booking Submission and Secure Access Token
**Files created:** `backend/routes/bookings.js`  
**Files modified:** `backend/routes/index.js`, `backend/.env.example`  
**What was built:** `POST /api/bookings` — public endpoint accepting booking details, generating a 32-byte cryptographic token via `crypto.randomBytes`, storing it in Redis as `booking_access_token:{token}` with 86400 second TTL, sending the token to the client's corporate email via nodemailer. Token is never returned in the API response.  
**Architectural relevance:** The token exists only in Redis and in the corporate email inbox. Only the person with access to that inbox can authenticate. This makes the corporate email a second authentication factor.

### Phase 5.2 — Token Validation and HttpOnly Cookie Session
**Files modified:** `backend/routes/bookings.js`  
**Files modified:** `backend/server.js`  
**What was built:** `GET /api/bookings/auth?token={token}` — validates token against Redis, deletes it immediately on use (single-use), issues a signed JWT set as an HttpOnly cookie with `secure`, `sameSite: strict` flags. `GET /api/bookings/session` — reads cookie and returns current session state.  
**Architectural relevance:** HttpOnly cookies cannot be read by JavaScript, preventing XSS token theft. Single-use token deletion prevents replay attacks. The cookie persists across browser sessions, eliminating the need to request a new link every time the browser is closed.

### Phase 5.3 — Client Auth Middleware and Booking View
**Files created:** `backend/middleware/clientAuth.js`  
**Files modified:** `backend/routes/bookings.js`  
**What was built:** `requireClientAuth` middleware reading the HttpOnly cookie, verifying JWT, attaching decoded payload as `req.client`. `GET /api/bookings/:tripId` — returns trip details with driver `full_name` only, never `work_email` or `employee_id`. `POST /api/bookings/:tripId/request-new-link` — rate-limited to 3 requests per hour per email via Redis counter.  
**Architectural relevance:** Driver join query returns only `full_name` — data minimisation enforced at the SQL query level. Cross-client access is prevented by matching `req.client.trip_id` against the requested trip ID.

### Phase 5.4 — Client Authentication Integration Tests
**Files created:** `backend/tests/bookings.test.js`  
**What was built:** Six tests: booking submission without token in response, single-use token deletion on validation, persistent session via cookie, data minimisation on booking view, cross-client access prevention, expired token rejection.  
**Architectural relevance:** Test 2 proves the single-use guarantee. Test 4 proves driver contact details never reach the client layer. Test 5 proves session scoping prevents cross-client data access.

### Phase 5.5 — Driver Authentication with Role-Aware Middleware
**Files created:** `backend/routes/drivers.js`, `backend/tests/driverAuth.test.js`  
**Files modified:** `backend/middleware/auth.js`, `backend/routes/trips.js`  
**What was built:** Driver login and logout endpoints mirroring fleet manager auth pattern. `requireAuth` upgraded to accept role array — `requireAuth(['fleet_manager'])`, `requireAuth(['driver'])`, or `requireAuth(['fleet_manager', 'driver'])`. All fleet manager routes locked to fleet manager role. Trip accept and complete endpoints locked to driver role.  
**Architectural relevance:** Role separation is enforced structurally. A driver JWT cannot call fleet manager endpoints and vice versa. This is the enforcement point for operational privilege separation.

### Phase 5.6 — Driver Trip Routes with Availability Tracking
**Files created:** `backend/routes/driverTrips.js`, `backend/tests/driverTrips.test.js`  
**Files modified:** `backend/routes/drivers.js`, `backend/routes/index.js`  
**What was built:** Driver availability tracked in Redis on login (`available`), trip acceptance (`on_trip`), trip completion (`available`), logout (`offline`). `GET /api/driver/trips` — returns only trips assigned to authenticated driver, never `client_corporate_email`. `PATCH /api/driver/trips/:tripId/accept` — creates Redis session mappings. `PATCH /api/driver/trips/:tripId/reject` — returns trip to `pending` with mandatory reason logged to audit trail. `PATCH /api/driver/trips/:tripId/complete` — destroys session keys, opens complaint window. `GET /api/drivers/availability` — fleet manager view of real-time driver status.  
**Architectural relevance:** Driver availability is operational state stored in Redis, not PostgreSQL. It has no TTL because it represents current status, not a session. The trip query structurally excludes `client_corporate_email` at the SQL level.

### Phase 5.7 — Driver Roster and Vehicle Inventory Management
**Files created:** `backend/routes/roster.js`, `backend/routes/vehicles.js`, `backend/tests/roster.test.js`  
**Files modified:** `backend/routes/index.js`  
**What was built:** Fleet manager endpoints for adding drivers (generates temporary password, emails credentials, never returns password in response), deactivating drivers (sets `active_status: false`, blocklists active JWT, sets availability to offline), viewing roster with live availability. Vehicle endpoints for adding, removing (blocked if deployed), and viewing vehicles with deployment status derived from active trip assignments.  
**Architectural relevance:** Driver deactivation triggers immediate JWT blocklisting — a deactivated driver cannot continue an active session even with a valid unexpired token. This satisfies the remote session invalidation requirement at the architectural level.

### Phase 5.8 — Complaint Lodgement System
**Files created:** `backend/routes/complaints.js`, `backend/tests/complaints.test.js`  
**Files modified:** `backend/routes/index.js`  
**What was built:** `POST /api/complaints/:tripId` — protected by `requireClientAuth`, verifies trip ownership via cookie, checks `complaint:window:{tripId}` exists in Redis as the sole time-bound gate, inserts complaint record. `GET /api/complaints` — fleet manager view of all complaints without `encrypted_message_archive`. Audit log entry uses trip ID as actor to preserve client anonymity.  
**Architectural relevance:** The Redis TTL check is the architectural enforcement of the 24-hour window — when the key expires, the endpoint physically cannot accept complaints. This is purpose limitation implemented as a technical constraint, not a policy check against timestamps.

---

## Sprint 6 — Conditional Message Persistence

### Phase 6.1 — Message Buffering in Redis
**Files modified:** `backend/socket/relay.js`  
**What was built:** After each relayed message, appends JSON-encoded message to Redis list `messages:trip:{tripId}` via `rPush`. Resets TTL to 86400 seconds on every append via `expire` command.  
**Architectural relevance:** The message buffer exists purely to support conditional persistence. During normal operation it is never read. If no complaint is filed, the TTL fires and the buffer is permanently deleted with zero intervention required.

### Phase 6.2 — Conditional Encryption and Persistence
**Files created:** `backend/utils/encryption.js`  
**Files modified:** `backend/routes/complaints.js`  
**What was built:** `encrypt(plaintext)` and `decrypt(encryptedJson)` using AES-256-GCM. Encryption key derived from `JWT_SECRET` via `crypto.scryptSync` at runtime — never stored. On complaint filing: pulls message buffer from Redis, encrypts, writes to `complaints.encrypted_message_archive`, deletes Redis buffer immediately, logs `MESSAGE_ARCHIVE_CREATED` to audit trail.  
**Architectural relevance:** The encryption key exists only in memory during encryption and decryption. Even if PostgreSQL is compromised, the archive cannot be decrypted without access to the server environment. The Redis buffer is deleted immediately after archiving — not left to expire — because its continued existence after archiving would violate data minimisation.

### Phase 6.3 — Fleet Manager Complaint Investigation
**Files modified:** `backend/routes/complaints.js`  
**What was built:** `GET /api/complaints/:complaintId` — returns complaint details without `encrypted_message_archive`. `GET /api/complaints/:complaintId/messages` — decrypts and returns message archive only when complaint status is `under_investigation`, logs every access as `MESSAGE_ARCHIVE_ACCESSED`. `PATCH /api/complaints/:complaintId/status` — updates status, logs `old_status` and `new_status` to audit trail.  
**Architectural relevance:** Message archive access is gated behind investigation status. A fleet manager cannot read archived messages simply because a complaint exists — they must move it to active investigation, creating an auditable paper trail for every access event.

### Phase 6.4 — Conditional Persistence Lifecycle Validation
**Files created:** `backend/tests/conditionalPersistence.test.js`  
**What was built:** Three research validation scenarios simulating the complete data lifecycle:  
- **Scenario 1:** Clean trip, no complaint, TTL fires, nothing persists.  
- **Scenario 2:** Complaint filed within window, messages encrypted into PostgreSQL, Redis buffer deleted, fleet manager accesses decrypted archive under investigation.  
- **Scenario 3:** Window expires before complaint filed, late complaint rejected with 403, no archive created.  
**Architectural relevance:** These three scenarios are the quantitative validation of Research Question 4. They prove data minimisation, conditional persistence, and purpose limitation as machine-verified facts.

---

## Sprint 7 — Privacy Dashboard

### Phase 7.0 — MVP Scope Gap Closure
**Files modified:** `backend/routes/driverTrips.js`, `backend/routes/bookings.js`, `backend/routes/roster.js`, `backend/routes/trips.js`  
**What was built:**  
- `PATCH /api/driver/trips/:tripId/start` — driver marks client pickup complete, advances status from `accepted` to `in_progress`, logs `TRIP_STARTED`.  
- `GET /api/bookings/history` — returns all trips tied to authenticated client email, excluding driver details.  
- `GET /api/roster/audit` — paginated audit log query with optional `action_type` filter.  
- Trip completion email — sends 24-hour complaint window notification to `client_corporate_email` on trip completion.  
**Architectural relevance:** These four gaps were identified during a systematic audit of Section 5 of the MVP scope document. Each gap was a missing feature explicitly required by the research proposal.

### Phase 7.1 — TTL Helper and Session State Endpoints
**Files modified:** `backend/config/redisHelpers.js`  
**Files created:** `backend/routes/dashboard.js`, `backend/tests/dashboard.test.js`  
**Files modified:** `backend/routes/index.js`  
**What was built:** `getTTL(key)` helper returning Redis TTL in seconds (-2 = key absent, -1 = no expiry, positive = remaining seconds). `GET /api/dashboard/trips/:tripId` — returns session state for all four Redis keys per trip with TTL values and message count. `GET /api/dashboard/overview` — returns system-wide summary: active trips, active sessions, open complaint windows, sessions destroyed today.  
**Architectural relevance:** These endpoints make the invisible Redis TTL state visible in real time. The frontend uses `ttl_seconds` to drive countdown timers without polling Redis directly. This is the data source for the live Privacy Dashboard demonstration.

### Phase 7.2 — Dashboard Socket.IO Namespace
**Files created:** `backend/socket/dashboardNamespace.js`  
**Files modified:** `backend/server.js`, `backend/routes/trips.js`, `backend/routes/driverTrips.js`, `backend/routes/complaints.js`  
**What was built:** `/dashboard` Socket.IO namespace with JWT authentication requiring `role: 'fleet_manager'`. `emitDashboardEvent(eventName, data)` broadcaster emitting to all connected dashboard clients. Events emitted: `trip_assigned`, `session_created`, `session_destroyed`, `complaint_filed`.  
**Architectural relevance:** The dashboard namespace is a one-way broadcast channel — fleet managers receive real-time system events without any access to trip communication content. The namespace is structurally separate from the `/` relay namespace.

### Phase 7.3 — Audit Trail and Compliance Report Endpoints
**Files modified:** `backend/routes/dashboard.js`, `backend/tests/dashboard.test.js`  
**What was built:** `GET /api/dashboard/audit` — paginated audit log with optional `action_type` and `actor_role` filters. `GET /api/dashboard/compliance-report` — aggregates audit log counts by action type, complaint counts by status, trip counts by status, returns structured report with `sessions`, `data_lifecycle`, `complaints`, and `audit_entries_total` fields.  
**Architectural relevance:** The compliance report is the quantitative answer to Research Question 4. It produces a documented record of data minimisation in practice — sessions created, destroyed, data expired naturally, data conditionally persisted — suitable for presentation to regulators and research examiners.

---

*This document is append-only. Each phase is recorded once in chronological order. Do not modify existing entries.*
