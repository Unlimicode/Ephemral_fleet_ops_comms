# SwiftLink — Claude Code Context

## Project Overview
Privacy-preserving fleet operations and communication platform for small Kenyan fleet operators.
BSC final year project — SCT221-0593/2022, Ian Lemashon Sopia, JKUAT.

Three actor types: **fleet managers**, **drivers** (PWA), **clients** (corporate trip bookers).

---

## Stack
- **Backend:** Node.js / Express, PostgreSQL (Supabase), Redis (Upstash), Socket.IO
- **Frontend:** React / Vite, Tailwind CSS, PWA (drivers)
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
  bookings.js           — Client bookings: submission, token validation, session, history
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
  encryption.js         — AES-256-GCM encrypt/decrypt for message archives
  sendPushNotification.js — Push dispatch, auto-deletes stale subscriptions on 404/410
database/
  schema.sql            — PostgreSQL schema (6 tables + push_subscriptions)
  seed.js               — Master seed script (npm run seed)
  seed.sql              — SQL seed fragments
  seedData.js           — CI seed data helpers
tests/                  — 14 suites, 76 tests, all must pass before commit
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
  useChat.js            — Socket.IO chat hook: connect, send, receive, session_closed
  usePushNotifications.js — Push subscription lifecycle hook
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
  BookingLandingPage.jsx          — /booking — client trip session: details, driver card, live chat, complaint form
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
                                   -> cancelled
```
- `accepted` = manager assigned driver, driver not yet started
- `in_progress` = driver pressed start, client picked up
- Chat on BookingLandingPage opens when booking status is `accepted`
- Redis session keys created when driver accepts, destroyed on complete

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
- Named exports: `sendBookingConfirmation`, `sendDriverAssignedNotification`, `sendTripCompletionNotification`
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
- Not a standalone file yet — create at `frontend/src/hooks/useWindowWidth.js` if needed
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
1. Run `cd backend; npm test` and confirm 14 suites, 76 tests, 0 failures
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

## Current Status — Sprint 19

### Completed
- [x] Sprints 1-8: Full backend — auth, trips, WebSocket relay, complaints, push notifications, privacy dashboard APIs
- [x] Sprints 9-12: Full frontend foundation — layouts, pages, chat, responsive design system
- [x] Sprint 13: Client-driver WebSocket wire-up, BookingLandingPage
- [x] Sprint 14: Email consolidation to shared mailer, Privacy Dashboard UI
- [x] Sprint 18: PDF compliance export (ManagerPrivacyDashboardPage), CSV audit export (ManagerAuditPage)
- [x] Fix: addToast/showToast naming mismatch and reversed args fixed across 7 files (commit 75ccb26)

### Outstanding
- [ ] Request Transfer button obscured by animated shapes on mobile scroll (BookingLandingPage)
- [ ] Complaint status regression — cannot return to `open` from `under_investigation`
- [ ] Message visibility incorrectly tied to `under_investigation` (should open at `accepted` booking status)
- [ ] SwiftLink SVG logo inconsistency across layouts
- [ ] Client-facing complaint progress view + email notifications on complaint status change
- [ ] Sprint 18: Manager dashboard Stitch-style redesign (all 6 pages: Dispatch, Drivers, Vehicles, Complaints, Audit, PrivacyDashboard)
