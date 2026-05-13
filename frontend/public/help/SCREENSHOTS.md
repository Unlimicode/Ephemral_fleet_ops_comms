# Help Screenshot Guide

Drop screenshots into the subfolders below using the exact filenames listed.
The help system loads each image automatically — if a file is missing the slot
silently disappears, so you can add them one at a time in any order.

Recommended format: PNG, width ~1200px (desktop) or ~390px (mobile).

---

## manager/ — 7 files

| Filename | URL to open | What to show |
|----------|-------------|--------------|
| `01-login.png` | `/login` | Fleet Manager tab selected, work email typed in the email field |
| `02-new-booking-modal.png` | `/manager/dispatch` | "+ New Booking" modal open with all fields filled in |
| `03-assign-driver.png` | `/manager/dispatch` | Pending booking card with driver dropdown, vehicle dropdown, and ETA field all visible |
| `04-dispatch-overview.png` | `/manager/dispatch` | Full-page view — Active Trips widget, Awaiting Acceptance bar, Drivers panel, and Fleet Status all on screen |
| `05-privacy-dashboard.png` | `/manager/dashboard` | Session Monitor with at least one live TTL row showing a coloured progress bar |
| `06-complaints-page.png` | `/manager/complaints` | Complaint card expanded, status dropdown visible, "View Messages" button present |
| `07-audit-exports.png` | `/manager/audit` | Audit tab showing both the PDF Compliance Report and CSV Audit Log export buttons |

---

## driver/ — 4 files

| Filename | URL to open | What to show |
|----------|-------------|--------------|
| `01-trips-list.png` | `/driver/trips` | Trips list with cards in at least 2 different statuses (e.g. Assigned + Completed) |
| `02-active-trip-chat.png` | `/driver/trips/:tripId` | Active trip page with Secure Channel chat open and a few messages visible |
| `03-profile-push.png` | `/driver/profile` | Profile page showing the push notification toggle |
| `04-notifications-list.png` | `/driver/notifications` | Notifications page with at least one trip-assignment notification card |

---

## client/ — 6 files

| Filename | URL to open | What to show |
|----------|-------------|--------------|
| `01-booking-form.png` | `/booking` (no session) | The booking form as a first-time visitor sees it — all fields blank |
| `02-trip-pending.png` | `/booking` (pending trip) | Trip dashboard with "Pending" status badge, no driver card yet |
| `03-trip-accepted.png` | `/booking` (accepted trip) | Trip dashboard with driver card showing first name, vehicle, plate, and ETA |
| `04-trip-active-chat.png` | `/booking` (in_progress trip) | Active trip with Secure Channel chat open |
| `05-trip-ended-complaint.png` | `/booking` (completed trip) | Completed trip showing the ComplaintCard with the 24-hour countdown |
| `06-booking-history.png` | `/booking/history` | History page listing past trips under the corporate email |

---

## Tips

- Use browser DevTools device toolbar (F12 → phone icon) for mobile screenshots
- For client screenshots you need a valid booking token — create a test booking first
- Crop to just the page content, not the browser chrome
- Keep file sizes reasonable (compress with TinyPNG or similar if over 500 KB)
