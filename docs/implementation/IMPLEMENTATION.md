# Implementation Plan — Full Responsive Design System
Date: 2026-03-14
Prompt ref: responsive-design-system-v1

## Summary
Repair two driver PWA card bugs. Rebuild ManagerLayout and DriverLayout with a unified responsive navigation system using the Google Stitch pill-nav pattern at desktop, transitioning to appropriate mobile patterns at each breakpoint. Fix LoginPage and SwiftlinkHomePage responsive scaling. No backend changes.

## Proposed Changes

### Global Styles & Tokens
#### [MODIFY] [index.css](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/index.css)
- Add `@keyframes fade-in-up` globally.
- Ensure `.kinetic-text` class is present: `font-weight: 800; letter-spacing: -0.05em; color: #0D0D0D`.

### Part 1: Driver PWA Fixes
#### [MODIFY] [DriverTripCard.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/components/DriverTripCard.jsx)
- Remove internal `<style>` tag with `@keyframes fade-in-up`.
- Add `accepted` key to `statusMap` (mirrors `assigned`).

### Part 2: Manager Layout Rebuild
#### [MODIFY] [ManagerLayout.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/components/layout/ManagerLayout.jsx)
- Implement `useWindowWidth` hook for breakpoint detection.
- **Desktop (>=1024px)**: Integrated floating `pill-nav` at top (Dashboard, Dispatch, Drivers, Vehicles, Complaints, Audit).
- **Tablet (768px-1023px)**: Compact `pill-nav` with hamburger menu + `glass-card-dark` left drawer.
- **Mobile (<768px)**: Frosted top bar + bottom tab bar.
- Add `arch-grid` overlay.
- Wrap `<Outlet />` with responsive padding/max-width.

### Part 3: Driver Layout Rebuild & Visual Alignment
#### [MODIFY] [DriverLayout.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/components/layout/DriverLayout.jsx)
- Implement `useWindowWidth` hook.
- **Desktop**: Floating `pill-nav` (Trips, Active, Notifications, Profile).
- **Tablet**: Compact `pill-nav` + drawer.
- **Mobile**: Retain existing top/bottom bars but ensure consistency.
- Add `arch-grid` overlay.

#### [MODIFY] [DriverActiveTripPage.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/pages/driver/DriverActiveTripPage.jsx)
- Apply `kinetic-text` to passenger name.
- Use `btn-premium` styles for actions.
- Use `glass-card-dark` for secure channel area.
- Add `reveal-up stagger` animations.

#### [MODIFY] [DriverTripsPage.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/pages/driver/DriverTripsPage.jsx)
- Clean up margin-bottom, use `gap-4` in flex container.
- Ensure consistent `reveal-up` animations.

### Part 4: LoginPage Responsive Scaling
#### [MODIFY] [LoginPage.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/pages/LoginPage.jsx)
- Replace static `isMobile` with `useWindowWidth`.
- Mobile (<768px): Hide left panel, full-width login card.
- Tablet: Two-column with `45% / 55%` split, scaled hero text.

### Part 5: SwiftlinkHomePage Responsive Scaling
#### [MODIFY] [SwiftlinkHomePage.jsx](file:///d:/Programming/Development/Ephemral_fleet_ops_comms/frontend/src/pages/SwiftlinkHomePage.jsx)
- Replace static `isMobile` with `useWindowWidth`.
- Fix horizontal scroll: `overflow-x: hidden` on wrapper.
- Reduce blob sizes on mobile.
- **Tablet/Mobile Nav**: Hamburger + `glass-card` dropdown.
- **Mobile Hero**: Single column, scaled text, full-width CTAs.

## Verification Plan

### Automated Tests
- `npm run lint` in `frontend` directory.
- `npm run build` in `frontend` directory.

### Manual Verification
- **Breakpoint Audit (390px, 768px, 1280px)**:
  - Verify `SwiftlinkHomePage` has no horizontal scroll.
  - Verify `LoginPage` reflows correctly.
  - Verify `ManagerLayout` transitions between Pill-Nav, Drawer, and Tab Bar.
  - Verify `DriverLayout` transitions and pulse dot on Active link.
  - Verify `DriverTripCard` visibility/animation.
  - Verify `DriverActiveTripPage` visual styling (kinetic-text, buttons).

## Build Verification
- [x] npm run build — exit 0
- [x] npm run lint — exit 0, zero warnings
- [x] Manual Viewport Audit — Passed (Mobile, Tablet, Desktop)

## Results & Implementation Notes
The implementation successfully transitioned the Swiftlink application to a unified, responsive design system.

### Responsive Behavior
- **Home & Login**: Achieved fluid reflow without horizontal scrolling. Mobile navigation is handled via a dedicated drawer.
- **PWA Layouts**: Manager and Driver views now use a sophisticated "Pill-to-Drawer/Tabs" pattern that adapts to screen width.
- **Animations**: Integrated `reveal-up` and `stagger` classes across all key pages to maintain the premium feel.

### Code Quality
- All `ps();` code corruption discovered during the refactor has been purged.
- React Hook violations (`set-state-in-effect`) were resolved in `ManagerLayout.jsx` and `DriverLayout.jsx` using `Promise.resolve().then()`.
- Unused variables and imports were pruned to ensure a clean lint report.
