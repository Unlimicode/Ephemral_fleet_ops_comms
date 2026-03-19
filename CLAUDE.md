# SwiftLink — Claude Code Context

## Project Overview
Privacy-preserving fleet operations and communication platform for small Kenyan fleet operators.
BSC final year project. Currently Sprint 17–18.

Three actor types: **fleet managers**, **drivers** (PWA), **clients** (corporate trip bookers).

---

## Stack
- **Backend:** Node.js / Express, PostgreSQL, Redis, Socket.IO
- **Frontend:** React / Vite, Tailwind CSS, PWA (drivers)
- **Email:** Resend SMTP (prod), Ethereal Email (dev) — all mail goes through `backend/config/mailer.js`
- **Auth:** JWT + Redis TTL (ephemeral sessions), magic links
- **Dev tunneling:** ngrok via root-level `start-dev.js`

---

## Repo Structure

### Root
```
start-dev.js          — starts backend + frontend + ngrok together
package.json          — root-level scripts
implementation_plan.md — sprint log, DO NOT overwrite
```

### Backend `/backend`
```
server.js             — Express app entry point
config/
  db.js               — PostgreSQL pool
  redis.js            — Redis client
  redisHelpers.js     — TTL/session utilities
  mailer.js           — SINGLE shared mailer (Resend/Ethereal). All email calls go here.
  webpush.js          — Web push config
middleware/
  auth.js             — Manager JWT middleware
  clientAuth.js       — Client JWT middleware
routes/
  auth.js             — Manager auth (magic link)
  bookings.js         — Trip bookings (create, assign, status)
  complaints.js       — Complaint lifecycle
  contact.js          — Client contact/enquiry
  dashboard.js        — Manager dashboard stats
  drivers.js          — Driver management
  driverTrips.js      — Driver-facing trip actions
  index.js            — Route aggregator
  push.js             — Web push subscriptions
  roster.js           — Driver roster/scheduling
  trips.js            — Trip records
  vehicles.js         — Vehicle management
socket/
  io.js               — Socket.IO server, WebSocket relay
  dashboardNamespace.js — Dashboard-specific socket namespace
utils/
  encryption.js       — Data encryption helpers
  sendPushNotification.js — Push notification dispatch
database/
  schema.sql          — PostgreSQL schema
  seed.js / seed.sql  — Dev seed data
```

### Frontend `/frontend/src`
```
App.jsx               — Router root, route definitions
main.jsx              — Vite entry point
api/
  axios.js            — Axios instance with baseURL + auth headers
context/
  AuthContext.jsx     — Auth state provider (manager + driver + client)
hooks/
  useChat.js          — Chat polling + Socket.IO hook
  usePushNotifications.js — Push subscription hook
utils/
  ripple.js           — Ripple click effect utility
styles/
  tokens.css          — Design tokens (colours, spacing)
  animations.css      — Reveal/stagger/kinetic animations
components/
  layout/
    ManagerLayout.jsx — Manager shell (pill-nav, blob bg, arch-grid)
    DriverLayout.jsx  — Driver shell (mobile-first, pill-nav)
    GlassCard.jsx     — Reusable glass card component (backdrop-filter blur)
    PageWrapper.jsx   — Generic page wrapper with layout constraints
  ActiveTripsMap.jsx
  BookingCard.jsx
  ChatWindow.jsx
  DriverCard.jsx
  GeoBadge.jsx
  PushNotificationManager.jsx
  StatCard.jsx
  SwiftlinkLogo.jsx   — SVG logo component, use everywhere for consistency
  Toast.jsx           — Toast notifications — export is `addToast` (NOT showToast)
pages/
  manager/
    ManagerDispatchPage.jsx         — /manager/dispatch — DEFAULT manager home, bookings/dispatch
    ManagerDriversPage.jsx          — /manager/drivers — Driver management
    ManagerVehiclesPage.jsx         — /manager/vehicles — Vehicle management
    ManagerComplaintsPage.jsx       — /manager/complaints — Complaint handling + investigation
    ManagerAuditPage.jsx            — /manager/audit — Compliance/reporting (Sprint 18)
  ManagerPrivacyDashboardPage.jsx   — /manager/dashboard — Privacy/data dashboard (imported as ManagerDashboardPage in App.jsx, lives at pages root not pages/manager/)
  driver/
    DriverTripsPage.jsx         — Driver trip list
    DriverActiveTripPage.jsx    — Active trip view + chat
    DriverProfilePage.jsx       — Driver profile
    DriverNotificationsPage.jsx — Push notification history
  booking/
    BookingLandingPage.jsx  — /booking — Client trip session: booking details + driver card + live chat + complaint form
  BookingHistoryPage.jsx            — /booking/history — Client booking history (pages root, not in booking/)
  LoginPage.jsx                     — /login
  ManagerPrivacyDashboardPage.jsx   — /manager/dashboard (see manager routes above)
  SwiftlinkHomePage.jsx             — / — Public landing page
```

---

## Critical Conventions

### Status Strings (check these when card/component visibility breaks)
```
Booking:  pending → accepted → assigned → in_progress → completed | cancelled
Complaint: open → under_investigation → resolved
```
- Chat visibility opens at `accepted` status on BookingLandingPage
- `session_closed` WebSocket event triggers client-side trip end transition

### Auth Pattern
- Managers: magic link → JWT stored in Redis with TTL
- Drivers: separate auth flow via `clientAuth.js` middleware
- Clients: JWT, separate middleware

### Email — IMPORTANT GOTCHAS
- **All email goes through `backend/config/mailer.js` only** — never create inline transporters
- Named exports: `sendBookingConfirmation`, `sendDriverAssignedNotification`, `sendTripCompletionNotification`
- Resend click-tracking strips magic link tokens — never add HTML wrappers to magic link emails
- `MAIL_FROM` must match the Ethereal account address in dev or sends fail silently

### WebSocket Events
- Client sends: `send_message`
- Client receives: `receive_message`
- Field for sender role: `msg.from` (not `msg.role`)
- Dashboard namespace is separate from main relay namespace

### Responsive Breakpoints
- `useWindowWidth` hook pattern is the standard — event listener, state, cleanup
- It is NOT currently a standalone file (not in hooks/ or utils/) — if needed, create it at `frontend/src/hooks/useWindowWidth.js`
- Never use static `window.innerWidth` checks

### Design System
- Background: `#F5EDE3`
- Cards: `glass-card` / `glass-card-dark` with `backdrop-filter: blur(40px)`
- Nav: `pill-nav` pattern (Google Stitch reference)
- Animations: `kinetic-text`, `reveal-up stagger`, animated blobs, `arch-grid` overlay
- Logo: always use `<SwiftlinkLogo />` component — do not use inline SVG or img tags

---

## Change Documentation Convention
After every change, append to `implementation_plan.md` using this format:
```
### [Sprint X] — [short title]
- **Date:** YYYY-MM-DD
- **Files modified:** list each file
- **What changed:** one line per change
- **Why:** brief reason
```
Never overwrite existing entries — append only.
Commit message format: `type(scope): description` (conventional commits)

---

## CI Pipeline (GitHub Actions)
Backend tests run on every push. Before finishing any task:
1. Run `cd backend && npm test` locally and confirm all suites pass
2. Check these suites specifically — they have a history of failures:
   - `driverTrips.test.js`
   - `roster.test.js`
   - `relay.test.js`
   - `dashboard.test.js`
   - `bookings.test.js`
3. Never leave a task in a state where tests are broken
4. After confirming tests pass, remind the user to commit and push

---

## Token Usage — How to Work Efficiently
To keep Claude Code token usage low on Pro plan:

**Scope tasks narrowly**
- One file or one feature per session where possible
- Say exactly which file to edit rather than describing symptoms broadly
- e.g. "Edit `ManagerComplaintsPage.jsx` to fix X" not "the complaints page is broken"

**Use /compact regularly**
- Run `/compact` in the Claude Code terminal when a session gets long
- This summarises conversation history and frees up context window

**Use /model to match task to model**
- Sonnet for most tasks (faster, cheaper on quota)
- Opus only for complex architecture decisions or hard debugging
- Switch with `/model` command

**Read before writing**
- Ask Claude Code to read and describe a file before editing it
- Catches misunderstandings before tokens are spent on a wrong implementation

**One task, then commit**
- Finish one change → confirm tests pass → commit → start next task
- Long sessions that span many files cost significantly more

**Don't re-explain context**
- CLAUDE.md handles baseline context automatically
- Only add what's specific to the current task in your prompt

---


- `implementation_plan.md` — sprint log, append only, never overwrite
- `backend/config/mailer.js` — do not create alternative mail transports
- `_dev_logs/` — debug artefacts, ignore entirely
- `*.txt` output files in backend root — test artefacts, ignore

---

## Dev Environment
```bash
# Start everything (backend + frontend + ngrok)
node start-dev.js

# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Run backend tests
cd backend && npm test
```

---

## Current Outstanding Work (Sprint 17–18)
- [ ] `addToast`/`showToast` naming mismatch in `Toast.jsx`
- [ ] Request Transfer button obscured by animated shapes on mobile scroll
- [ ] Complaint status regression (cannot return to `open`)
- [ ] Message visibility tied to `under_investigation` status (should open at `accepted`)
- [ ] SwiftLink SVG logo consistency across all layouts
- [ ] Client-facing complaint progress view + email notifications on status change
- [ ] Sprint 18: Manager dashboard Stitch-style redesign (all 6 pages: ManagerDispatchPage, ManagerDriversPage, ManagerVehiclesPage, ManagerComplaintsPage, ManagerAuditPage, ManagerPrivacyDashboardPage)
- [ ] Sprint 18: Compliance/reporting export (`ManagerAuditPage.jsx`)
