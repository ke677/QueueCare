# 🏥 QueueCare

QueueCare is a small clinic appointment and queue-management system built for the QA Engineering Technical Assessment. The project intentionally keeps the application simple so the focus stays on correctness, authorization, negative testing, edge cases, and stable automation.

## 1. What is included

- JWT-based authentication
- Patient, staff, and admin roles
- Appointment CRUD operations
- Automatic queue-number assignment
- Today's staff queue
- Staff can mark patients as served
- Patient ownership checks
- Browser UI using plain HTML, CSS, and JavaScript
- API automation with Playwright
- UI automation with Playwright
- A test-only reset endpoint for deterministic automated tests

## 2. Stack

| Area | Technology |
|---|---|
| Backend | Node.js + Express |
| Authentication | JWT + bcryptjs |
| Data store | In-memory arrays |
| Frontend | HTML + CSS + JavaScript |
| Automation | Playwright |

The in-memory store is deliberate: the assessment allows it and it keeps setup close to zero. A production deployment should replace it with a persistent database.

## 3. Prerequisites

- Node.js 18+ recommended
- npm 9+
- Chromium installed by Playwright

## 4. Install

```bash
npm install
npx playwright install chromium
```

## 5. Run the application

```bash
npm start
```

Open `http://localhost:3000`.

Health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

## 6. Default staff account

- Email: `staff@queuecare.test`
- Password: `Staff123!`

For a real deployment, move the seed credentials and JWT secret to environment variables or a secure secret manager. The credentials above are assessment-only demo credentials.

## 7. API tests

```bash
npm run test:api
```

The API suite covers:

- Registration and login
- Token protection
- Appointment creation and queue numbers
- Role-based appointment visibility
- Single appointment retrieval
- Staff serving patients
- Invalid credentials
- Missing fields
- Invalid/missing tokens
- Cross-patient access
- Missing IDs
- Past and malformed dates
- Duplicate bookings
- Rescheduling validation
- Re-cancellation
- Re-booking after cancellation
- Re-serving an already served appointment

## 8. UI tests

```bash
npm run test:ui
```

The browser suite covers:

- Valid login
- Invalid login
- Empty login validation
- Patient registration
- Appointment creation and queue display
- Required-field validation
- Appointment update
- Appointment cancellation

UI tests use labels, roles, and data attributes rather than CSS positions or fragile selectors.

## 9. Run everything

```bash
npm test
```

Playwright reports are written to `playwright-report/` when the suite runs.

## 10. API overview

| Method | Endpoint | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/me` | Authenticated |
| POST | `/api/appointments` | Authenticated |
| GET | `/api/appointments` | Authenticated |
| GET | `/api/appointments/today` | Staff/Admin |
| GET | `/api/appointments/:id` | Owner/Staff/Admin |
| PUT | `/api/appointments/:id` | Owner/Staff/Admin |
| DELETE | `/api/appointments/:id` | Owner/Staff/Admin |
| PATCH | `/api/appointments/:id/serve` | Staff/Admin |

## 11. Authorization model

Patients can create and manage their own appointments only. Staff and admins can view all appointments, access today's queue, and mark patients as served. Protected routes require a valid Bearer token.

## 12. Test-only endpoint

When the application is started with `NODE_ENV=test`, `POST /api/test/reset` resets the in-memory store. This endpoint is intentionally unavailable in the normal application process and exists only to keep automated tests isolated and repeatable.

## 13. Environment variables

- `PORT` - HTTP port; defaults to `3000`.
- `JWT_SECRET` - signing secret; the code contains an assessment fallback, but a real deployment should always set this securely.

## 14. Known limitations

1. Data is stored in memory and is lost when the server restarts.
2. Registration accepts a role because the assessment explicitly asks for role registration. A production system should not allow an unauthenticated user to self-register as staff/admin.
3. The current UI is intentionally lightweight rather than production-designed.
4. The API does not send email/SMS reminders or integrate with a persistent clinic database.

## 15. Assessment focus

The project prioritizes QA-relevant behavior: authorization boundaries, invalid input, state transitions, duplicate bookings, cancellation behavior, queue assignment, and repeat operations. See `TEST_REPORT.md` for the testing strategy and improvement plan.
