# SwiftLink — In-System User Guide

**Document purpose:** Defines every help section, its context trigger, its copy, and its visual structure.
This file is the single source of truth for the in-system help feature.
The implementation renders directly from this spec. The dissertation user guide chapter is written from this spec.

---

## 1. Architecture Overview

### Entry points

| Actor | Entry point | Mechanism |
|-------|-------------|-----------|
| Fleet Manager | `?` icon at the right end of the pill-nav → `/manager/help` | Full dedicated page, scrollable, sections collapsible |
| Driver | `?` Help pill injected into the right side of the DriverLayout header | Tapping opens a bottom sheet; content switches per active route |
| Client | Floating `?` button fixed to the bottom-right of both client pages | Opens a bottom sheet; content switches per booking state |

### Why these entry points

**Manager — dedicated page:**
Managers are on desktop, working across multiple pages during a session. A dedicated `/manager/help` page lets them read at their own pace and refer back. It is also the most straightforward thing to screenshot side-by-side with the Word documentation. The `?` in the nav means it is always one click away from any manager page.

**Driver — pill in the layout header:**
Drivers are mobile, mid-task, potentially mid-trip. A floating pill that overlays content would conflict with the layout. The DriverLayout mobile header (`position: sticky, top: 0, height: 56px`) currently shows the SwiftLink logo on the left and the driver name on the right. The Help pill is placed to the right of the driver name as a small `?` button, adding a third element without displacing anything. This makes it accessible from every driver route without disrupting the page content below.

**Client — floating button:**
The client pages have highly variable layouts (three distinct booking states, history). A fixed floating button is the most reliable entry point because it is unaffected by content changes. Positioned at `bottom: 88px, right: 20px`: the 88px bottom clears the iOS browser chrome and provides visual separation from page content.

### Visual language (all actors)

- **Step numbers:** filled circles in `#6C63FF`, white number inside — rendered as inline elements, not images
- **Section icons:** Material Symbols Outlined, same icon font already loaded across the app
- **Status chips:** exact same CSS chips used in the live UI — replicated in help content for recognition
- **Section cards:** `glass-card` style, consistent with the rest of the UI
- **Privacy notes:** purple-tinted box — `background: rgba(108,99,255,0.08)`, `border: 1px solid rgba(108,99,255,0.2)`, left-border accent `3px solid #6C63FF`
- **Info / caution notes:** amber tint — `background: rgba(245,158,11,0.08)`, `border: 1px solid rgba(245,158,11,0.2)`, left-border `3px solid #F59E0B`

### Context detection

- **Manager:** Static page, all sections visible. Default: first section expanded, rest collapsed.
- **Driver:** `window.location.pathname` determines which topic set loads when the sheet opens.
- **Client:** Parent page passes a `context` prop derived from the current trip state.

---

## 2. Fleet Manager Help

**Route:** `/manager/help`
**Entry:** `?` icon at the right end of the ManagerLayout pill-nav, visible regardless of current manager page.

The page is a single column of collapsible glass-card sections. Each card has a header row with a Material Symbol icon, a title, a subtitle, and a chevron. Clicking anywhere on the header expands or collapses the body. Default: Section 2.1 expanded, all others collapsed.

---

### Section 2.1 — Getting Access

**Icon:** `mail`
**Subtitle:** *How manager authentication works*

**Steps:**

1. Go to the SwiftLink login page and enter your registered work email address.
2. Check your inbox for an email from SwiftLink — it arrives within seconds.
3. Click **"Sign in to SwiftLink"** in the email. You are taken directly to the Dispatch dashboard — no password required.
4. Your session remains active for your current browser session. Closing the browser tab ends it.

**Caution note:**
> The sign-in link is **single-use and expires after 15 minutes**. If it has expired, return to the login page and enter your email again to receive a new one.

**Privacy note:**
> SwiftLink uses email magic links instead of passwords. No password is ever created or stored on the system.

---

### Section 2.2 — Creating a Trip Booking

**Icon:** `add_circle`
**Subtitle:** *Registering a new corporate trip on behalf of a client*

**Steps:**

1. From the **Dispatch** page, click **"+ New Booking"** in the top-right corner. A modal form appears.
2. Enter the client's **first name** and **corporate email address**.
   > Only the first name is stored — no surnames, no phone numbers. This is enforced at the database level.
3. Enter the **pickup location** and **destination**.
4. Set the **pickup date and time**.
5. *(Optional)* Enter a **flight number** if this is an airport pickup or drop-off. The driver will see this on their trip card.
6. *(Optional)* Enter **special instructions** — notes visible only to the assigned driver (e.g. "VIP delegation — display name card on arrival").
7. Review the **"Send booking access link"** toggle:
   - **ON (default):** The client receives an email with subject **"Your SwiftLink booking link"** containing a magic link to their personal trip dashboard.
   - **OFF:** The booking is created silently. Use this for internal trips where the client does not need app access.
8. Click **"Create Booking"**. The booking appears immediately in the **Incoming Bookings** panel with status **Pending**.

**Privacy note:**
> The client's corporate email is used only to deliver their access link and trip notifications. It is never visible to the assigned driver at any point.

---

### Section 2.3 — Assigning a Driver and Vehicle

**Icon:** `person_add`
**Subtitle:** *Matching a pending booking to a driver and vehicle*

**Steps:**

1. In the **Incoming Bookings** panel on Dispatch, locate the pending booking card.
2. Review the trip details: client name, route, pickup time, and any special instructions.
3. Select an **available driver** from the driver dropdown on the card.
4. Select a **vehicle** from the vehicle dropdown.
5. *(Optional)* Enter an **ETA** — the time you estimate the driver will arrive at the pickup point. This is shown to the client in their trip view as a reference time.
6. Click **"Assign"**.

**What happens next:**
- The booking status changes from **Pending → Accepted**.
- The driver receives a push notification on their PWA directing them to open the app to view the assignment. The full trip details are inside the app — not in the notification itself.
- The booking moves to the **Awaiting Acceptance** column. A timer bar shows how long the assignment has been waiting: it turns **amber after 10 minutes** and **red after 20 minutes**.
- Once the driver accepts, the client receives a push notification with the driver's first name and vehicle details.

**Caution note:**
> If the timer bar turns red, follow up with the driver directly or reassign the trip to another available driver.

---

### Section 2.4 — Monitoring Active Trips

**Icon:** `near_me`
**Subtitle:** *Tracking trips in progress from the Dispatch dashboard*

**What the Dispatch page shows:**

| Panel | What it displays |
|-------|-----------------|
| **Active Trips** (top-left widget) | Compact list of in-progress trips — driver name, vehicle reg, force-complete button |
| **Awaiting Acceptance** (bottom-right widget) | Assigned trips the driver has not yet accepted, with elapsed time bar |
| **Drivers** (right panel) | All drivers as avatar initials — purple = available, teal = on trip, grey = offline |
| **Fleet Status** (right panel) | Vehicles deployed vs total fleet, with a progress bar |
| **Active Trips** (bottom grid) | Full trip cards — driver, client, route, and complete/confirm controls |

**Force-completing a trip:**

Use this only when a driver is unreachable and cannot complete the trip themselves.

1. In the **Active Trips** panel, locate the trip.
2. Click **"Complete"** on the trip row.
3. A confirm/cancel prompt appears inline — click **"Confirm"** to proceed.
4. The trip is marked completed, both session keys are destroyed, and the client enters a 24-hour complaint window.

**Caution note:**
> Force-complete is for exceptional cases only. Normally the driver marks trip completion from their own app.

---

### Section 2.5 — Sessions and Privacy Dashboard

**Icon:** `lock`
**Subtitle:** *Understanding ephemeral sessions and the data lifecycle*

Navigate to **Privacy Dashboard** from the pill-nav.

**What a session is:**

When a driver accepts a trip, SwiftLink creates two temporary session keys in Redis — one for the driver, one for the client. These keys:
- Authenticate both parties to the secure chat relay
- Define the TTL (Time-To-Live) after which session data is automatically deleted
- Are destroyed immediately when the driver completes the trip — the data cannot be recovered after this point

**Reading the Session Monitor:**

Each row represents one active trip with two live sessions (driver + client). The TTL countdown shows time remaining before automatic expiry.

| TTL bar colour | Meaning |
|----------------|---------|
| **Green** | More than 50% of session time remaining |
| **Amber** | 25–50% remaining — trip likely nearing completion |
| **Red** | Less than 25% remaining — session expiring soon |

**The Audit Log:**

Every session creation and destruction event is written to the audit log with a timestamp, actor ID, and a SHA-256 destruction hash. The destruction hash is cryptographic evidence that the session was properly wiped — not merely abandoned or hidden.

**Privacy note:**
> This dashboard provides demonstrable evidence of compliance with the data minimisation and storage limitation principles of data protection law. No session data persists beyond trip completion.

---

### Section 2.6 — Managing Complaints

**Icon:** `report`
**Subtitle:** *Handling client complaints through the investigation lifecycle*

Navigate to **Complaints** from the pill-nav.

**Complaint statuses:**

| Status | Meaning |
|--------|---------|
| **Open** | Filed by the client — no investigation started yet |
| **Under Investigation** | Investigation active — encrypted message archive is accessible |
| **Resolved** | Investigation complete — no further transitions possible |

**The status control:**

Each complaint card has a **status dropdown**. Use it to move a complaint through its lifecycle. The dropdown is disabled once a complaint reaches **Resolved** — this cannot be undone.

**Starting an investigation:**

1. Click a complaint row to expand the full detail card.
2. Use the status dropdown to select **"Under Investigation"**.
3. The **"View Messages"** button becomes active — click it to decrypt and read the message archive from the trip.
4. Review the conversation between driver and client.
5. Use the **investigation notes** field to record your findings (saved automatically on blur).
6. Click **"Notify Driver"** if you need to formally inform the driver that a review is in progress.
7. When the investigation is complete, use the dropdown to select **"Resolved"**.

**Pausing an investigation:**

If you need to step away mid-investigation, use the dropdown to return the status to **Open**. The message archive becomes inaccessible again until you restart the investigation.

**Privacy note:**
> The message archive is AES-256-GCM encrypted at rest. It can only be decrypted while the complaint status is **Under Investigation**. This enforcement is at the server level — the server refuses to return the archive in any other state, regardless of what the UI requests.

---

### Section 2.7 — Compliance and Audit Export

**Icon:** `download`
**Subtitle:** *Generating compliance reports for institutional review*

Navigate to **Audit** from the pill-nav.

**What you can export:**

| Export | Format | Contains |
|--------|--------|---------|
| DPA Compliance Report | PDF | System overview, all session destruction events with timestamps and SHA-256 destruction hashes, data retention summary |
| Audit Log | CSV | Every logged system action — actor ID, role, action type, target, timestamp, details |

**Steps:**

1. Click **"Export Compliance Report (PDF)"** to generate and download the PDF immediately.
2. Click **"Export Audit Log (CSV)"** to download the raw audit log.

**Caution note:**
> These exports contain operational and personal data relevant to data subject access requests and DPA compliance reviews. Store and transmit them securely.

---

## 3. Driver Help

**Component:** `DriverHelpSheet` — a bottom sheet that opens when the driver taps the `?` button in the layout header. The sheet title and content are determined by the active route.

**Placement in DriverLayout:**
- Mobile: added to the right of the existing driver name element in the sticky header (`height: 56px`). The header currently shows `[SwiftlinkLogo]` left, `[driver name]` right. The Help button sits to the right of the driver name as a small pill: `[driver name] [?]`.
- Desktop/tablet: added to the right-side group in the pill-nav, alongside the driver name and "Active Duty" badge.

---

### Context 3.1 — `/driver/trips` and `/driver/trips/active`

**Sheet title:** Your Trips

#### Understanding Trip Status

Each trip card shows a status badge:

| Badge | Colour | Meaning |
|-------|--------|---------|
| **Assigned** | Amber | You have been assigned this trip. Review the details — accept or decline before pickup time. |
| **In Progress** | Green, pulsing | Trip is active. Tap "View Active Trip" to open the trip interface and chat channel. |
| **Completed** | Grey | Trip is done. Session data has been permanently wiped. |
| **Cancelled** | Red | The client cancelled this booking. No action needed. |

#### Accepting a Trip

1. Read the full trip card: client first name, pickup location, destination, pickup time, and assigned vehicle.
2. Check the **purple note box** if present — it contains special instructions from the fleet manager. Read it before accepting.
3. If a **flight number** is shown, this is an airport trip. Account for potential flight delays.
4. Tap **"Accept"**.
5. The trip moves to **In Progress**. A secure chat session opens for you and the client, and the client is notified.
6. Your status becomes **On Trip** in the manager's dashboard.

**Caution note:**
> Once you accept, the client can see your first name and vehicle registration. No other personal details are shared with them.

#### Declining a Trip

1. Tap **"Decline"** on an Assigned trip card.
2. Enter a reason — **this is required** and cannot be left blank.
   - Examples: "Vehicle mechanical issue", "Medical emergency", "Road closure on route".
3. Tap **"Confirm Decline"**.
4. The trip returns to the manager for reassignment.

**Caution note:**
> Decline reasons are reviewed by your fleet manager. They are not shared with the client.

---

### Context 3.2 — `/driver/trips/:tripId` (Active Trip Detail)

**Sheet title:** Active Trip Guide

This page is the full interface for a trip from pickup to drop-off. It shows your trip manifest at the top, an action button in the middle, and the secure chat panel below.

**You land here by tapping "View Active Trip" on an in-progress trip card from your Trips list.** The trip is already underway the moment you accept it — the secure chat channel is open and the client is notified as soon as you accept.

#### Step 1 — Communicate During the Trip

The **🔒 Secure Channel** panel is the only authorised way to communicate with your client during a trip.

- **You will not see the client's phone number or email at any point.** This is by design — all communication is relayed through SwiftLink's server so neither party's contact details are ever exposed to the other.
- Type a message in the box at the bottom of the chat panel and tap **Send**.
- If you briefly lose signal, any message you sent shows a **⏳** icon. It will be delivered automatically when your connection is restored. Keep the app open in the background.

**What the client can see about you:**
- Your **first name** only
- Your **vehicle make, model, and registration plate**
- The **ETA** your manager set when assigning the trip

They cannot see your surname, phone number, employee ID, or any other personal detail.

#### Step 2 — Complete the Trip

When the client has been safely dropped off at their destination:

1. Tap **"Complete Trip — Dropped Off ✓"**.
2. The trip ends immediately. Both your session and the client's session are destroyed on the server. The chat channel closes.
3. The client enters a **24-hour window** during which they can file a complaint if needed.

**Privacy note:**
> After completion, all message content is permanently deleted from the server — unless the client files a complaint within 24 hours. In that case, the archive is preserved solely for the fleet manager's investigation, then deleted on resolution.

---

### Context 3.3 — `/driver/profile`

**Sheet title:** Your Profile & Notifications

#### Your Profile Details

- Your **full name** and **employee ID** are set by your fleet manager when your account is created.
- You cannot edit these yourself. If any details are incorrect, contact your fleet manager to have them updated.

#### Enabling Push Notifications

Push notifications alert you when:
- A new trip has been assigned to you
- A trip you were assigned to has been cancelled by the client

**To enable:**
1. Tap **"Enable Notifications"** on your profile page.
2. Your browser will show a permission prompt — tap **"Allow"**.
3. The toggle turns on. You will receive alerts even when the app is in the background or the screen is off.

**If you denied permission by mistake:**
1. Open your browser settings (on Chrome for Android: tap the lock icon in the address bar → **Site settings** → **Notifications**).
2. Find SwiftLink in the list. Change **Blocked** to **Allowed**.
3. Return to your profile page and tap **"Enable Notifications"** again.

**Caution note:**
> Push notification permissions are tied to your specific browser and device. If you switch to a new phone or a different browser, you will need to enable notifications again.

---

### Context 3.4 — `/driver/notifications`

**Sheet title:** Your Notifications

- This page shows a history of every trip notification sent to your account on this device.
- **Trip assigned** notifications show the client's first name, pickup location, destination, and pickup time.
- **Cancellation** notifications are shown with a red indicator. Your fleet manager will follow up about reassignment.
- Notifications are stored on the server — they are not lost if you clear your browser cache or reinstall the app.

---

## 4. Client Help

**Component:** `ClientHelpModal` — a bottom sheet opened by a floating `?` button.

**Placement:**
- `position: fixed`, `bottom: 88px`, `right: 20px`, `zIndex: 50`
- 88px bottom clears the iOS browser navigation bar on all common iPhone screen sizes and provides visual breathing room above the fold

**Context prop values and when each is used:**

| Prop value | Condition in `BookingLandingPage` |
|------------|----------------------------------|
| `'booking-form'` | No trip found for this email |
| `'trip-pending'` | Trip exists, `status === 'pending'` (driver not yet assigned) |
| `'trip-accepted'` | Trip exists, `status === 'accepted'` (driver assigned, not started) |
| `'trip-active'` | Trip exists, `status === 'in_progress'` (trip underway) |
| `'trip-ended'` | Trip exists, `status === 'completed'` or `status === 'cancelled'` |
| `'history'` | User is in the read-only history recovery view (`BookingHistoryPage`) |

**Context derivation in `BookingLandingPage`:**

```javascript
const helpContext = (() => {
    if (!trip) return 'booking-form';
    if (trip.status === 'in_progress') return 'trip-active';
    if (trip.status === 'accepted')    return 'trip-accepted';
    if (trip.status === 'pending')     return 'trip-pending';
    // completed or cancelled — show post-trip help
    return 'trip-ended';
})();
```

---

### Context 4.1 — `booking-form`

**Sheet title:** How Your Booking Works

#### Your Booking Access Link

When your fleet manager creates your booking, you receive an email from SwiftLink with the subject **"Your SwiftLink booking link"**.

1. Open the email and click or tap **the link** in the message body.
2. You are taken directly to your personal trip dashboard — **no password required**.
3. The link is single-use. Once you open it, you are signed in automatically.

**Caution note:**
> The link expires if unused for 15 minutes. If it has expired, contact your fleet manager — they can resend it from the Dispatch page.
> If you cannot find the email, check your **spam or junk folder** before asking for a resend.

#### What Your Email Is Used For

Your corporate email is used for three things only:
- Delivering your booking access link
- Sending trip status updates (driver assigned, trip complete)
- Allowing you to recover access to your booking history

**Privacy note:**
> Your email address is never shared with your driver. Your driver sees only your first name.

#### What You Will See After Signing In

Once signed in, your trip dashboard shows:
- Your trip route, pickup date, and time
- Current status — once a driver is assigned, their first name and vehicle details appear
- A secure chat channel so you can message your driver directly
- An option to enable push notifications so you are alerted the moment your driver accepts the trip

---

### Context 4.2 — `trip-pending`

**Sheet title:** Booking Confirmed — Driver Pending

#### Your Booking Has Been Received

Your trip has been registered in the system. Your fleet manager is currently assigning a driver and vehicle.

- You do not need to do anything at this stage.
- This page will update automatically when a driver is assigned.
- You may receive an email notification when your driver is confirmed.

**Caution note:**
> If your pickup time is approaching and no driver has been assigned, contact your fleet manager directly.

---

### Context 4.3 — `trip-accepted`

**Sheet title:** Your Trip is Confirmed

#### Your Driver and Vehicle

A driver has been assigned to your trip. You can see:
- Your driver's **first name**
- Their **vehicle** — make, model, and registration plate
- An **ETA** (estimated arrival time at your pickup point), if your fleet manager has set one

**Privacy note:**
> You will not see your driver's phone number. All communication goes through the secure in-app chat — this protects both you and the driver. Neither side can contact the other outside the SwiftLink platform.

#### Messaging Your Driver

1. Scroll down to the **Secure Channel** section on your trip page.
2. Type your message in the text box and tap **Send**.
3. Your driver receives it in real time.
4. Use this to confirm pickup landmarks, share updates, or flag any last-minute changes.

#### Cancelling Your Trip

You can cancel before the driver starts the journey:
1. Tap **"Cancel Trip"** on your trip page.
2. Confirm the cancellation when prompted.
3. Your fleet manager is notified automatically.

**Caution note:**
> Cancellation is only available while the trip status is **Confirmed**. Once the driver has started the trip, contact your fleet manager directly.

---

### Context 4.4 — `trip-active`

**Sheet title:** Your Trip is Underway

#### Your Trip is in Progress

Your driver has confirmed your pickup and started the journey. The secure chat channel is open.

#### Communicating With Your Driver

1. Use the **Secure Channel** section on your screen.
2. Type your message and tap **Send**.
3. If your signal drops briefly, your message will be sent automatically when connectivity is restored — you will see a **⏳** icon until it goes through.

#### If Something Goes Wrong

- Use the chat to raise issues with your driver first.
- If you cannot resolve it through chat, contact your fleet manager directly by phone.

#### Filing a Complaint

If something went wrong during this trip:
1. After the trip ends, a **"File a Complaint"** section will appear on your screen.
2. You have **24 hours** from the moment the trip is marked complete.
3. Select a complaint category and describe what happened.
4. Your message history from this trip is preserved and will be reviewed by your fleet manager.

**Caution note:**
> After the 24-hour complaint window closes, your message history is **permanently deleted**. If you intend to file a complaint, do not wait.

#### What Happens to Your Data After This Trip

- The secure session and all associated session data are destroyed the moment the trip is marked complete — this happens automatically on the server.
- Message content is permanently deleted unless you file a complaint within 24 hours.
- Your booking record (route, time, driver name, vehicle) is retained for fleet management and compliance purposes.

**Privacy note:**
> SwiftLink is built on a privacy-by-design model. Trip sessions are ephemeral — data is not kept beyond what is strictly necessary for the operation.

---

### Context 4.5 — `trip-ended`

**Sheet title:** Your Trip Has Ended

#### Your Trip is Complete

The trip session has ended and your secure communication channel has been closed.

**If the trip was completed normally:**
- You have up to **24 hours** to file a complaint if needed. Look for the "File a Complaint" section on your screen.
- After 24 hours, all message content is permanently deleted.

**If the trip was cancelled:**
- The booking has been cancelled and the session was closed.
- Contact your fleet manager if you need a new booking.

---

### Context 4.6 — `history`

**Sheet title:** Your Booking History

#### What You Can See Here

This view shows all trips registered under your corporate email:
- Pickup location and destination
- Pickup date and time
- Assigned driver (first name) and vehicle
- Trip status

#### Why You Cannot Edit or Cancel Here

History access is a **temporary, read-only session** — valid for **2 hours** from when you opened the recovery link. You cannot modify or cancel bookings from this view. To make changes to an upcoming booking, contact your fleet manager.

#### Why Some Details May Be Missing

- **Message content** from completed trips is not retained unless a complaint was filed. This is by design.
- **Cancelled trips** appear in the list with their status — route and booking details are preserved for your records.

**Privacy note:**
> Your history session expires automatically after 2 hours. This limits the exposure of your booking records if you are using a shared or unattended device.

---

## 5. Implementation Notes

### New files

| File | Purpose |
|------|---------|
| `frontend/src/pages/manager/ManagerHelpPage.jsx` | Full help reference page for fleet managers |
| `frontend/src/components/DriverHelpSheet.jsx` | Bottom sheet for driver help; selects content set by route |
| `frontend/src/components/ClientHelpModal.jsx` | Bottom sheet for client help; receives `context` prop |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Add route `/manager/help` → `ManagerHelpPage` |
| `frontend/src/components/layout/ManagerLayout.jsx` | Add `?` icon to the right end of the pill-nav |
| `frontend/src/components/layout/DriverLayout.jsx` | Add `?` Help button to the right of the driver name in both the mobile sticky header and desktop nav right-side group; render `<DriverHelpSheet />` |
| `frontend/src/pages/BookingLandingPage.jsx` | Add floating `?` button; derive `helpContext`; render `<ClientHelpModal context={helpContext} />` |
| `frontend/src/pages/BookingHistoryPage.jsx` | Add floating `?` button; render `<ClientHelpModal context="history" />` |

### DriverHelpSheet route detection

```javascript
const path = window.location.pathname;
const driverContext = (() => {
    // Match /driver/trips/:id but NOT /driver/trips/active
    if (path.match(/\/driver\/trips\/(?!active$)[^/]+$/)) return 'trip-detail';
    if (path.includes('/driver/trips'))         return 'trips-list';
    if (path.includes('/driver/profile'))       return 'profile';
    if (path.includes('/driver/notifications')) return 'notifications';
    return 'trips-list';
})();
```

### Section collapse pattern (ManagerHelpPage)

Each section is a `glass-card` with a clickable header row (`icon | title | subtitle | chevron`). An `expandedSection` state string holds the ID of the currently open section. Clicking a header sets it or clears it (accordion behaviour — one open at a time). Default: `'access'` (Section 2.1).

---

*Document version: Sprint 21 — May 2026*
*Author: Ian Lemashon Sopia, SCT221-0593/2022, JKUAT*
