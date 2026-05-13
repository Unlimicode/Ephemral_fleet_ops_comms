# SwiftLink — System Outstanding Work

---

## Context — Read This First

### What SwiftLink Is
SwiftLink is a privacy-preserving fleet dispatch system built for corporate transport operators. It manages trip bookings, driver assignment, client-driver communication, and post-trip complaints — all within a single platform.

The system has three actor types:
- **Manager (fleet operator)** — owns the platform, assigns drivers, manages vehicles, handles complaints, has full visibility of all data
- **Driver** — receives trip assignments, communicates with clients through the system, completes trips
- **Client (corporate traveler)** — books trips, tracks status, communicates with their driver, files complaints

### The Core Privacy Argument
The system is built around **data confinement**. The operator collects only what is operationally necessary to run the service. That data is then confined entirely within the organization — it never flows downstream to the driver.

In the current industry norm, dispatch happens over WhatsApp. The driver receives the client's name, phone number, and pickup details directly. Once that message is sent, the operator has no control over what the driver does with that information. The client's number lives on the driver's phone indefinitely.

SwiftLink eliminates that exposure structurally. The driver receives a trip assignment — pickup location, destination, and trip notes — but never the client's contact details. Communication between client and driver happens through a mediated WebSocket relay. The driver has no way to contact the client outside the system, and that channel closes when the trip ends.

### How the Client Accesses the System
There are no traditional client accounts. The client's identity anchor is their **corporate email address**. When a booking is submitted, the system sends a session link to that email. The client clicks once and lands in their trip interface — no password, no login, no account creation.

This is intentional. An account is an open-ended credential that persists beyond the purpose that created it. SwiftLink's client access is **event-driven** — a booking triggers access, and that access is scoped to the lifetime of that trip. When the trip ends and the complaint window closes, there is nothing left open. The corporate email ties all historical trip records together in the database, but access to the system is not permanently open. This is a stronger privacy position than an account-based model because there is nothing to breach — no credentials, no persistent login surface.

### Tech Stack
- **Backend:** Node.js, Express, PostgreSQL, Redis, WebSockets (ws library)
- **Frontend:** React (Vite), deployed as a PWA
- **Auth:** HttpOnly cookie carrying a JWT, issued on booking or recovery
- **Real-time:** WebSocket relay — client and driver join a shared trip room, messages pass through the server, neither party has a direct connection to the other
- **Notifications:** Push notifications via Web Push, email via shared mailer (`backend/config/mailer.js`)
- **Audit:** Append-only audit log, TTL-based data expiry tracked in Redis, Privacy Dashboard for manager

### Key Constraints
- **Never expose client contact details to the driver** — this is the non-negotiable privacy guarantee the entire system is built around
- **`implementation_plan.md` is a record, not a task list** — do not modify it. Append completed sprint entries only
- **Always run `cd backend; npm test` before finishing any task** — 14 suites, 76 tests, 0 failures required
- **`backend/config/mailer.js` is the only mail transport** — do not create alternatives
- **One batch = one commit** — do not commit mid-batch unless a batch is split for a specific reason

### Current State
The system is functionally complete across its core flows — auth, trips, WebSocket relay, complaints, push notifications, audit log, privacy dashboard, PDF/CSV export. The outstanding work below extends the client-facing experience and strengthens the confinement architecture on the client side specifically. Nothing below requires rebuilding existing functionality — it builds on top of what is already there.

---

## How to Work Through This File

1. Read the context above before touching any code
2. Answer the two decisions in **Decisions Pending** at the bottom before starting
3. Work through batches **in order** — each batch depends on the ones before it (except Batch 9 which is independent)
4. After completing each batch: run `npm test`, confirm 0 failures, then commit with the provided commit message
5. Mark tasks complete with `[x]` as you go so progress is visible

---

## Batch 1 — Schema and Data Foundation
> Everything downstream depends on these fields existing first.

- [ ] Decide who sets ETA — manager on assignment, driver manually, or calculated — record decision before implementing
- [ ] Add `additional_info TEXT` (nullable) column to `trips` table via migration
- [ ] Add ETA field to `trips` table via migration (type based on decision above)
- [ ] Add `additional_info` to `POST /api/bookings` — accept and store on booking submission
- [ ] Add `additional_info` to driver trip view query — operational context only, no PII
- [ ] Verify driver assignment query already returns `first_name`, vehicle `make`, `model`, `plate` for client-facing display — add fields if missing

**Commit:** `feat: schema and data foundation — additional_info, ETA field, driver assignment query`

---

## Batch 2 — Session and Auth
> Foundation for all client-facing flows.

- [ ] Extend client session JWT TTL to trip lifecycle (booking → completion) instead of fixed duration
- [ ] Handle session extension/reissue if trip runs longer than expected and JWT approaches expiry while trip is still active
- [ ] Concurrent trips decision — block second booking while one is pending, or handle multiple — implement accordingly

**Commit:** `feat: session TTL tied to trip lifecycle, concurrent trips handling`

---

## Batch 3 — Booking Management Endpoints
> Depends on Batch 1 (schema) and Batch 2 (session).

- [ ] `PATCH /api/bookings/:tripId` — edit booking details, state gate: allowed at `pending` only, blocked beyond with clear error
- [ ] `DELETE /api/bookings/:tripId` — cancel booking, state gate: allowed at `pending` and `assigned`, blocked at `accepted`, `in_progress`, `completed`
- [ ] Reschedule as part of edit — `pickup_time` editable at `pending` only, same endpoint as edit
- [ ] On cancellation at `assigned` — emit socket event to notify driver trip was cancelled
- [ ] On cancellation at `assigned` — send push notification to driver
- [ ] ETA endpoint or field on trip assignment — based on Batch 1 decision

**Commit:** `feat: booking management — edit, cancel, reschedule with state gates, cancellation events`

---

## Batch 4 — Recovery Flow
> Depends on Batch 2 (session types).

- [ ] Recovery endpoint returns three distinct states:
  - Active trip found → issue full session, redirect to trip interface
  - No active trip but history exists → issue short-TTL read-only session (2hrs), load home state with history
  - Email not found → return clear message directing to booking form
- [ ] Read-only history session scoped to history only — no operational access

**Commit:** `feat: three-state recovery flow, read-only history session`

---

## Batch 5 — WebSocket Resilience
> Depends on Batch 2 (session) and Batch 3 (trip states).

- [ ] Reconnection logic — exponential backoff, silent, no user action required
- [ ] On reconnect, replay Redis message buffer so client does not miss messages sent while disconnected
- [ ] PWA initialization sequence: check cookie → check trip status → if `accepted` or `in_progress` auto-connect WebSocket without user action

**Commit:** `feat: WebSocket reconnection with backoff, message buffer replay, PWA auto-connect`

---

## Batch 6 — Client PWA — Full Interface
> Depends on all backend batches above.

#### Three Load States on Mount
- [ ] Active trip → load straight into trip interface, WebSocket auto-connects
- [ ] No active trip, has history → load home state: past trips list, "Book a new ride" button, "Remove this app" option
- [ ] No active trip, no history → load directly into booking form
- [ ] "Remove this app" — clears cookie and removes PWA, does not delete stored data

#### Booking Form
- [ ] Add optional `additional_info` field — labelled "Additional notes for your driver"

#### Trip Interface Sections
- [ ] View full booking details
- [ ] Edit section — pickup, destination, pickup time, additional info — active at `pending`, read-only beyond with reason shown
- [ ] Cancel button — visible at `pending` and `assigned`, hidden or clearly disabled at `accepted` and beyond with reason
- [ ] Reschedule — available at `pending` only
- [ ] Booking status — clearly displayed at all times
- [ ] Driver ETA — shown once assigned, between `assigned` and `in_progress`
- [ ] Driver identification on assignment — first name, vehicle make, model, plate
- [ ] `additional_info` — editable until `accepted`, read-only after with note "Your driver has been briefed"
- [ ] Communication channel — open from `accepted` onwards (verify Sprint 19 fix still correct)
- [ ] Trip completion screen — "Your trip is complete" state, complaint window countdown, "Report an issue" button
- [ ] Post-complaint-window state — clear message that window has closed, not an auth error

#### PWA Behaviour
- [ ] On browser reopen from icon — check cookie, restore session, auto-connect WebSocket if trip active, no user action required

**Commit:** `feat: client PWA — three load states, full trip interface, booking management UI`

---

## Batch 7 — Driver and Manager Frontend
> Depends on Batch 1 (additional_info field) and Batch 3 (cancellation events).

#### Driver
- [ ] Render `additional_info` on driver trip card — labelled clearly as trip notes
- [ ] Cancelled trip state — when client cancels at `assigned`, trip disappears from active view or shows cancelled state cleanly

#### Manager
- [ ] ETA input on dispatch assignment flow — based on Batch 1 ETA decision
- [ ] Dispatch page listens for client cancel socket event and updates trip list in real time

**Commit:** `feat: driver and manager frontend — additional_info, cancellation state, ETA input, cancel event listener`

---

## Batch 8 — Notifications
> Depends on Batch 3 (driver accept flow) and Batch 6 (PWA push permission moment).

- [ ] Verify driver accept endpoint triggers push notification to client — wire up if missing
- [ ] Push notification content on acceptance — driver first name, vehicle make, model, plate (no contact details)
- [ ] Push notification permission requested at booking confirmation moment — not on app load
- [ ] Verify email notification fires on complaint status change — fix if missing

**Commit:** `feat: notifications — push on driver accept, permission timing, complaint status email verification`

---

## Batch 9 — Resilience and Performance
> Can run in parallel with document work. No dependencies on other batches.

- [ ] Offline indicator — subtle, non-alarming
- [ ] Offline action queuing — complaint filing queued and submitted on connectivity restore
- [ ] Message sending while offline shows "pending" state, does not silently fail
- [ ] Timezone handling — store pickup time in UTC, display in local time with timezone clearly labelled
- [ ] Audit bundle size and animation weight for low-end Android devices
- [ ] WebSocket overhead on weak connections — test and optimise if needed
- [ ] PWA degrades gracefully on poor connectivity

**Commit:** `feat: offline resilience, timezone handling, performance audit`

---

## Decisions Pending
- [ ] ETA — who sets it? Decide before starting Batch 1
- [ ] Concurrent trips — block or allow multiple? Decide before starting Batch 2
