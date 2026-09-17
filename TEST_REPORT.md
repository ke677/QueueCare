# QueueCare QA Test Report

## 1. What I Built

QueueCare is a small clinic appointment system built with Node.js and Express. It uses JWT authentication, bcrypt password hashing, an in-memory data store, and a plain HTML/CSS/JavaScript browser interface. Playwright is used for both API and browser automation.

The main design decision was to keep the application intentionally small. That makes authorization, state transitions, validation, and queue behavior easy to inspect and test rather than hiding them behind unnecessary framework complexity.

## 2. What I Tested

The automated suite covers the required happy paths, negative cases, and edge cases from the assessment.

### Happy paths

- Registration and login with a valid token
- Appointment creation with automatic queue number
- Patient appointment filtering
- Staff access to all appointments
- Single appointment lookup
- Staff serving a patient

### Negative cases

- Wrong password
- Non-existent email
- Missing appointment fields
- Missing authentication token
- Invalid authentication token
- Patient accessing another patient's appointment
- Patient attempting staff-only service action
- Non-existent appointment ID

### Edge cases

- Past appointment date
- Invalid date format
- Duplicate same-day booking
- Rescheduling to a past date
- Cancelling an already-cancelled appointment
- Re-booking after cancellation
- Marking an already-served appointment as served again

### Browser flows

- Valid login
- Invalid login
- Empty login validation
- Patient registration
- Appointment creation
- Required appointment-field validation
- Appointment update
- Appointment cancellation

## 3. What I Automated

API behavior is automated through Playwright's HTTP request API because it provides direct assertions on HTTP status codes and response bodies. Browser behavior is automated separately so UI failures are not confused with API failures.

The UI tests deliberately use accessible labels and button roles instead of CSS classes or screen coordinates. This makes the tests less sensitive to visual changes.

## 4. Bugs and Risk Areas Identified

The test design identified several important risk areas that would matter in a real clinic system:

1. **Role escalation risk:** the assessment requires a role during registration, so the demo API accepts `staff` and `admin` during registration. In production this must be replaced with controlled staff provisioning.
2. **In-memory persistence:** restarting the server removes users and appointments. This is acceptable for the assessment but not for real clinic data.
3. **Queue numbering:** queue numbers are calculated from active appointments on a date. A production implementation should define a persistent queue policy so numbers remain auditable when appointments are cancelled or rescheduled.
4. **Secret management:** the application includes an assessment fallback JWT secret. Production must require a securely managed secret.

## 5. What I Would Improve

Given more time I would:

- Replace the in-memory store with PostgreSQL or SQLite.
- Add database constraints for duplicate bookings.
- Add a controlled staff/admin provisioning workflow.
- Add refresh-token/session management and token revocation.
- Add rate limiting and account lockout for repeated login failures.
- Add audit logs for appointment changes and staff actions.
- Add API schema validation with a dedicated validation library.
- Add accessibility checks and responsive visual regression coverage.
- Add CI execution on every pull request.
- Add coverage reporting and mutation testing to evaluate whether tests actually detect faulty behavior.

## 6. Test Execution Note

The repository contains the complete automated suites and a Playwright configuration. The execution environment used to prepare this repository did not have network access to install npm dependencies, so the final `npm test` command could not be executed here. The README provides the exact installation and execution commands for the reviewer environment.

This limitation is documented deliberately rather than claiming test results that were not observed.
