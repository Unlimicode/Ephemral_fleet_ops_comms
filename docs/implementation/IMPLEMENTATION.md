# Implementation Plan — Client Trip Session Page Rebuild
Date: 2026-03-14
Prompt ref: client-session-page-v1

## Summary
Rebuild the client-facing trip session page into a single mobile-first interface
combining booking details, live trip status, driver card, and WebSocket chat.
Fix four known bugs in the socket layer. Delete the ClientChatPage stub.
Primary target viewport is 390px.

## Parts

| Part | Objective | Files to Change | Risk |
|------|-----------|-----------------|------|
| P1   | Fix socket event name mismatch in useChat.js | frontend/src/hooks/useChat.js | Low |
| P2   | Fix message bubble alignment field in ChatWindow.jsx | frontend/src/components/ChatWindow.jsx | Low |
| P3   | Rebuild BookingLandingPage.jsx — full mobile-first redesign | frontend/src/pages/BookingLandingPage.jsx | High — complete rewrite |
| P4   | Mobile-optimise ChatWindow.jsx | frontend/src/components/ChatWindow.jsx | Medium |
| P5   | Delete ClientChatPage.jsx stub and clean App.jsx route | frontend/src/pages/ClientChatPage.jsx, frontend/src/App.jsx | Low |
| P6   | Final build, lint, and commit | frontend/ | Low |

## Checks
- P1.1 Does `useChat.js` listen for `receive_message` and not `message`?
- P1.2 Does `useChat.js` still emit `send_message` when sending (matches backend handler)?
- P2.1 Does `ChatWindow.jsx` use `msg.from === role` for bubble alignment?
- P2.2 Does `ChatWindow.jsx` contain no reference to `msg.role`?
- P3.1 Does the page render without errors on initial load with a valid cookie session?
- P3.2 Does the sticky top bar render with the SwiftLink logo and status badge at 390px?
- P3.3 Does the arch-grid overlay render behind the page content?
- P3.4 Do two animated geo-shapes render with `float-slow` and `float-reverse` animations?
- P3.5 Does the trip details card show: trip ID, pickup location, destination, pickup time, and flight number if present?
- P3.6 Does the progress bar fill correctly for each status: pending(10%), accepted(40%), in_progress(75%), completed(100%)?
- P3.7 Is the driver card hidden when status is `pending`?
- P3.8 Does the driver card show the driver first name initial avatar, first name only, vehicle type, and status label?
- P3.9 Does the driver card show the correct status label: "En route to pickup" for `accepted`, "In transit" for `in_progress`?
- P3.10 Does the chat section show the locked state (lock icon + pending message) when status is `pending`?
- P3.11 Does the chat section render the active state (dark card, messages area, connection indicator) when status is `accepted`?
- P3.12 Does the compose bar appear as a fixed bottom bar when status is `accepted` or `in_progress`?
- P3.13 Does the compose bar disappear when status is `completed`?
- P3.14 Is the page content bottom-padded by 64px when the compose bar is visible, so the last message is not obscured?
- P3.15 Does pressing Enter (without Shift) in the input field send the message?
- P3.16 Does the send button become visually active (gradient) only when the input has text and the socket is connected?
- P3.17 Does polling fire every 10 seconds and update the displayed status without a page reload?
- P3.18 When the socket emits `session_closed`, does the page transition to the completed state immediately?
- P3.19 Does the complaint form render after status is `completed`?
- P3.20 Does the complaint category pill selector scroll horizontally on 390px without overflowing the page?
- P3.21 Does submitting the complaint call `POST /api/complaints/:tripId` and show the success state on HTTP 201?
- P3.22 Is the page free of horizontal scroll at 390px viewport width?
- P3.23 Does the page content have `max-w-lg mx-auto` centering on viewports ≥ 640px?
- P3.24 Does the `reveal-up` animation fire for all three cards on mount?
- P3.25 Does the page handle a 401 from `GET /api/bookings/session` by showing the recovery form?
- P4.1 Does the ChatWindow container use `flex: 1` sizing rather than a fixed pixel height?
- P4.2 Does the textarea auto-expand as the user types, up to a max of 120px?
- P4.3 Does the send button have `type="button"`?
- P5.1 Does `frontend/src/pages/ClientChatPage.jsx` no longer exist?
- P5.2 Does `frontend/src/App.jsx` contain no import or route reference to `ClientChatPage`?
- P5.3 Does the `/booking` route still render `BookingLandingPage`?
- P5.4 Does `npm run build` pass after the deletion with no unresolved import errors?

## Conflicts
None identified.

## Build Verification
- [x] npm run build — exit code 0, zero errors
- [x] npm run lint — exit code 0, zero warnings
- [ ] Commit hash: [fill after commit]
