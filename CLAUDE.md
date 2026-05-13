# SwiftLink — Claude Code Context

## Project Overview
Privacy-preserving fleet operations and communication platform for small Kenyan fleet operators.
BSC final year project — SCT221-0593/2022, Ian Lemashon Sopia, JKUAT.

Three actor types: **fleet managers**, **drivers** (PWA), **clients** (corporate trip bookers).

---

## Stack
- **Backend:** Node.js / Express, PostgreSQL (Supabase), Redis (Upstash), Socket.IO
- **Frontend:** React / Vite, Tailwind CSS, PWA (drivers + clients)
- **Email:** Resend SMTP (prod), Ethereal Email (dev) — all mail goes through `backend/config/mailer.js`
- **Auth:** JWT + Redis TTL (ephemeral sessions), magic links for managers, HttpOnly cookies for clients
- **Dev tunneling:** ngrok via root-level `start-dev.js`
- **CI:** GitHub Actions — backend tests run on every push to main

---

## Repo Structure

### Root
```
start-dev.js            — starts backend + frontend + ngrok together
package.json            — root-level dev script
implementation_plan.md  — sprint engineering log, APPEND ONLY, never overwrite
CLAUDE.md               — this file
```

### Backend `/backend`
```
server.js               — Express app entry point, transporter.verify() on startup
config/
  db.js                 — PostgreSQL connection pool
  redis.js              — Redis client (TLS enabled for Upstash)
  redisHelpers.js       — TTL utilities: setSession, getSession, deleteSession, extendSession, getTTL
  mailer.js             — SINGLE shared mailer. All email calls go here. Never create inline transporters.
  webpush.js            — VAPID config for Web Push
middleware/
  auth.js               — JWT middleware for managers and drivers (requireAuth)
  clientAuth.js         — HttpOnly cookie middleware for clients (requireClientAuth)
routes/
  auth.js               — Manager magic link auth
  bookings.js           — Client bookings: submission, token validation, session, history, edit, cancel, recovery, push-subscribe, logout
  complaints.js         — Complaint lifecycle: file, status update, message archive access
  contact.js            — Client contact/enquiry
  dashboard.js          — Manager dashboard: summary, sessions, compliance report, audit
  drivers.js            — Driver account management
  driverTrips.js        — Driver-facing trip actions: accept, reject, start, complete
  index.js              — Route aggregator (mounts all routers)
  push.js               — Web push subscriptions: subscribe, unsubscribe, VAPID key
  roster.js             — Driver roster: add, deactivate, availability
  trips.js              — Manager trip management: create, assign, view
  vehicles.js           — Vehicle inventory: add, remove, view
socket/
  io.js                 — Socket.IO server, WebSocket relay namespace (/)
  dashboardNamespace.js — /dashboard namespace for manager real-time events
utils/
  encryption.js                  — AES-256-GCM encrypt/decrypt for message archives
  sendPushNotification.js        — Driver push dispatch, auto-deletes stale subscriptions on 404/410
  sendClientPushNotification.js  — Client push dispatch, queries client_push_subscriptions by email
database/
  schema.sql            — PostgreSQL schema: fleet_managers, drivers, vehicles, trips, complaints, audit_log, push_subscriptions, driver_notifications, client_push_subscriptions
  seed.js               — Master seed script (npm run seed)
  seed.sql              — SQL seed fragments
  seedData.js           — CI seed data helpers
  migrations/
    001_driver_notifications.sql          — driver_notifications table
    002_audit_log_compliance.sql          — DPA compliance columns on audit_log
    003_add_trips_created_at.sql          — created_at on trips
    004_add_additional_info_eta_vehicle_details.sql — additional_info, eta on trips; make, model on vehicles
    005_add_cancelled_trip_status.sql     — cancelled added to trips.status CHECK
    006_add_client_push_subscriptions.sql — client_push_subscriptions table (email-keyed)
tests/                  — 14 suites, 89 tests, all must pass before commit
  auth.test.js
  bookings.test.js
  complaints.test.js
  conditionalPersistence.test.js
  dashboard.test.js
  driverAuth.test.js
  driverTrips.test.js
  investigation.test.js
  privacyDashboard.test.js
  push.test.js
  pushNotifications.test.js
  relay.test.js
  roster.test.js
  trips.test.js
```

### Frontend `/frontend/src`
```
App.jsx                 — Router root, ProtectedRoute guard, all route definitions
main.jsx                — Vite entry, wraps App with BrowserRouter then AuthProvider
api/
  axios.js              — Axios instance with baseURL + Bearer token interceptor
context/
  AuthContext.jsx       — Auth state: token, role, user. Persisted in sessionStorage.
hooks/
  useChat.js              — Socket.IO chat hook: connect, send, receive, session_closed
  usePushNotifications.js — Driver push subscription lifecycle hook (Bearer token)
  useOnlineStatus.js      — navigator.onLine + window online/offline events, returns boolean
utils/
  ripple.js             — Ripple click effect utility
styles/
  tokens.css            — CSS custom properties: colours, glass effect, typography
  animations.css        — Reveal/stagger/kinetic animation keyframes
components/
  layout/
    ManagerLayout.jsx   — Manager shell: pill-nav, blob background, arch-grid overlay
    DriverLayout.jsx    — Driver shell: mobile-first, fixed bottom tab bar
    GlassCard.jsx       — Reusable glass card (backdrop-filter blur, session-pulse variant)
    PageWrapper.jsx     — Page padding container (p-4 md:p-6)
  ActiveTripsMap.jsx
  BookingCard.jsx
  ChatWindow.jsx        — Shared chat UI used by both driver and client
  DriverCard.jsx
  DriverTripCard.jsx    — Driver trip list card (status-aware, accept/reject actions)
  GeoBadge.jsx
  PushNotificationToggle.jsx
  StatCard.jsx
  SwiftlinkLogo.jsx     — SVG logo component. Always use this — never inline SVG or img.
  Toast.jsx             — Export: addToast (NOT showToast). Signature: addToast(message, type)
pages/
  manager/
    ManagerDispatchPage.jsx       — /manager/dispatch — DEFAULT manager landing
    ManagerDriversPage.jsx        — /manager/drivers
    ManagerVehiclesPage.jsx       — /manager/vehicles
    ManagerComplaintsPage.jsx     — /manager/complaints
    ManagerAuditPage.jsx          — /manager/audit — compliance and reporting export
  ManagerPrivacyDashboardPage.jsx — /manager/dashboard — lives at pages root (not pages/manager/), imported as ManagerDashboardPage in App.jsx
  driver/
    DriverTripsPage.jsx           — /driver/trips (handles /driver/trips/active via defaultTab prop)
    DriverActiveTripPage.jsx      — /driver/trips/:tripId
    DriverProfilePage.jsx         — /driver/profile
    DriverNotificationsPage.jsx   — /driver/notifications
  BookingLandingPage.jsx          — /booking — client PWA: three load states (booking-form / history / trip), full trip interface, offline complaint queuing, push permission prompt
  BookingHistoryPage.jsx          — /booking/history — lives at pages root (not pages/booking/)
  LoginPage.jsx                   — /login
  SwiftlinkHomePage.jsx           — / — public landing page
```

---

## Route Summary

| Role | Default Landing | All Routes |
|------|----------------|------------|
| fleet_manager | /manager/dispatch | dispatch, drivers, vehicles, complaints, dashboard, audit |
| driver | /driver/trips | trips, trips/active, trips/:tripId, profile, notifications |
| client | /booking | booking, booking/history |
| public | / | /, /login |

---

## Critical Conventions

### Trip Status Flow
```
pending -> accepted -> in_progress -> completed
        -> cancelled                -> cancelled (client cancels)
```
- `pending` = booking submitted, no driver assigned yet
- `accepted` = manager assigned driver + vehicle, driver has not started
- `in_progress` = driver accepted assignment, Redis sessions created, chat channel open
- `completed` = driver marked drop-off done, Redis sessions destroyed, 24h complaint window opens
- `cancelled` = client cancelled at pending or accepted (not allowed at in_progress)
- Client can cancel at `pending` or `accepted`; driver notified via socket + push when cancelled at `accepted`
- Chat opens when trip status is `accepted` (not tied to complaint state)
- Redis session keys: `session:trip:{id}:driver` and `session:trip:{id}:client`, created on accept, deleted on complete
- Push notification sent to client when driver accepts: driver first name + vehicle make/model/plate (no contact details)

### Complaint Status Flow
```
open -> under_investigation -> resolved
```
- Message archive only decryptable when status is `under_investigation`
- Status CAN return to `open` from `under_investigation` — do not block this transition
- `session_closed` WebSocket event triggers client-side trip end UI transition

### Auth Pattern
- **Managers:** magic link email -> single-use Redis token -> JWT (Bearer header)
- **Drivers:** password login -> JWT (Bearer header)
- **Clients:** booking token email -> single-use Redis token -> JWT (HttpOnly cookie, inaccessible to JS)

### Email — Critical Gotchas
- All email goes through `backend/config/mailer.js` only — never create inline transporters
- Named exports: `sendBookingConfirmation`, `sendDriverAssignedNotification`, `sendTripCompletionNotification`, `sendComplaintStatusUpdate`
- Resend click-tracking strips magic link tokens — never add HTML wrappers to magic link emails
- `MAIL_FROM` must match the Ethereal account address in dev or sends fail silently
- Wrap all `sendMail` calls in `if (process.env.NODE_ENV !== 'test')` to prevent ECONNREFUSED in CI

### WebSocket Events
- Client sends: `send_message`
- Server emits to room: `receive_message`
- Sender field on message object: `msg.from` (not `msg.role`)
- Session end event: `session_closed` with `complaint_window_hours: 24` payload
- Dashboard namespace `/dashboard` is completely separate from relay namespace `/`

### Responsive Breakpoints
- Standard hook: `useWindowWidth` — event listener + state + cleanup pattern
- Currently inlined in `ChatWindow.jsx` — extract to `frontend/src/hooks/useWindowWidth.js` if needed elsewhere
- Never use static `window.innerWidth` checks
- Manager content: `max-width: 1440px`
- Driver content: `max-width: 900px`
- Breakpoints: mobile < 768px, tablet 768-1023px, desktop >= 1024px

### Design System
- Background: `#F5EDE3`
- Cards: `glass-card` / `glass-card-dark` with `backdrop-filter: blur(40px)`
- Nav: `pill-nav` pattern (reference: Google Stitch design file in project)
- Animations: `kinetic-text`, `reveal-up stagger`, animated blobs, `arch-grid` overlay
- Logo: always `<SwiftlinkLogo />` — no inline SVG, no img tags

---

## Do Not Touch
- `implementation_plan.md` — append only, never overwrite or reformat existing entries
- `backend/config/mailer.js` — never create alternative transporters anywhere
- `_dev_logs/` — debug artefacts, ignore entirely
- `*.txt` files in `backend/` root — test output artefacts, ignore

---

## Change Documentation Convention
After every completed change, append to `implementation_plan.md`:
```
### [Sprint X] — [short title]
- **Date:** YYYY-MM-DD
- **Files modified:** list each file
- **What changed:** one line per change
- **Why:** brief reason
```
Commit message format: `type(scope): description` (conventional commits)
Examples: `fix(complaints): allow status to return to open`, `feat(audit): add CSV export`

---

## CI Pipeline (GitHub Actions)
Backend tests run on every push. Before finishing any task:
1. Run `cd backend; npm test` and confirm 14 suites, 89 tests, 0 failures
2. These suites have a history of failures — always check them:
   - `driverTrips.test.js`
   - `roster.test.js`
   - `relay.test.js`
   - `dashboard.test.js`
   - `bookings.test.js`
   - `complaints.test.js`
3. Never finish a task with broken tests
4. After tests pass, remind the user to commit and push

---

## Token Usage — Work Efficiently
- **Scope narrowly** — one file or one feature per session
- **Name the file** — "edit ManagerComplaintsPage.jsx to fix X" not "the complaints page is broken"
- **Use /compact** — run when session gets long, frees context window
- **Use /model** — Sonnet for routine tasks, Opus only for hard debugging or architecture decisions
- **Read before writing** — ask Claude Code to read and describe a file before editing it
- **One task then commit** — finish, confirm tests pass, commit, then start next
- **CLAUDE.md handles baseline context** — only add task-specific detail in your prompt

---

## Dev Environment
```powershell
# Start everything (backend + frontend + ngrok)
node start-dev.js

# Backend only
cd backend; npm run dev

# Frontend only
cd frontend; npm run dev

# Run backend tests
cd backend; npm test

# Seed the database
cd backend; npm run seed
```

---

## Current Status — Sprint 20 (complete)

### Completed
- [x] Sprints 1-8: Full backend — auth, trips, WebSocket relay, complaints, push notifications, privacy dashboard APIs
- [x] Sprints 9-12: Full frontend foundation — layouts, pages, chat, responsive design system
- [x] Sprint 13: Client-driver WebSocket wire-up, BookingLandingPage (original)
- [x] Sprint 14: Email consolidation to shared mailer, Privacy Dashboard UI
- [x] Sprint 18: PDF compliance export (ManagerPrivacyDashboardPage), CSV audit export (ManagerAuditPage)
- [x] Sprint 20 Batch 1: Schema foundation — `additional_info`, `eta` on trips; `make`, `model` on vehicles; migration 004
- [x] Sprint 20 Batch 2: Session TTL tied to trip lifecycle; dynamic JWT expiry; concurrent trip blocking (409)
- [x] Sprint 20 Batch 3: `PATCH /bookings/:id` edit; `DELETE /bookings/:id` cancel with state gates; socket + push on cancel at accepted; ETA on assignment
- [x] Sprint 20 Batch 4: Three-state recovery — active trip / history-only / unknown email; read-only 2h history session
- [x] Sprint 20 Batch 5: WebSocket reconnection with exponential backoff (1s–30s, Infinity); silent connect_error; visibility-change reconnect
- [x] Sprint 20 Batch 6: Full BookingLandingPage rewrite — three load states (booking-form / history / trip), cancel UI, ETA badge, driver card with vehicle make/model/plate, additional_info edit, complaint form + progress tracker, `POST /bookings/logout`
- [x] Sprint 20 Batch 7: Driver — `additional_info` display, cancelled trip state; Manager — ETA input on dispatch, booking_cancelled socket listener
- [x] Sprint 20 Batch 8: Client push notifications — `client_push_subscriptions` table (migration 006), `sendClientPushNotification` utility, `POST/DELETE /bookings/push-subscribe`, push fired on driver accept, push permission prompt in BookingLandingPage trip view
- [x] Sprint 20 Batch 9: Offline resilience — `useOnlineStatus` hook, offline pill in nav, complaint queuing to localStorage with auto-drain; ChatWindow pending message state, mid-session reconnect fix; Africa/Nairobi timezone + EAT label on all date displays; `prefers-reduced-motion` in animations.css

- [x] Sprint 21: In-system user guide — ManagerHelpPage (/manager/help), DriverHelpSheet (route-aware bottom sheet), ClientHelpModal (booking-state context, floating ? button on all client pages)
