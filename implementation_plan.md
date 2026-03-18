# Sprint 19 Complaints Fix Implementation

The complaints module had two issues:
1. `GET /api/complaints` returning empty arrays (Test 4) due to route ordering conflicts.
2. `ECONNREFUSED` noise in tests caused by email notifications firing in the test environment.

## What Was Done

### backend/routes/complaints.js
- **Route Reordering**: Ensured that `GET /` and specific parameterised routes like `GET /:tripId/status` are registered before the more general `GET /:complaintId` handler. This allows the fleet manager list view and client status checks to be matched correctly by Express.
- **Email Guarding**: Wrapped the `transporter.sendMail` logic in the `PATCH /:complaintId/status` handler with a `NODE_ENV !== 'test'` check. This prevents the system from attempting to send emails during test runs, matching the established pattern in other modules.

## Verification
- **Automated Tests**: Ran the full test suite (14 suites, 76 tests) with 100% pass rate.
- **Build Checks**: Verified that the project lints and builds correctly.
- **Audit**: Confirmed that all requested route hierarchy requirements are met.

## Conflicts
- None encountered.
