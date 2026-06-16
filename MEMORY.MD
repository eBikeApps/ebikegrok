# MEMORY

**Rules, constraints, decisions, and facts that must NEVER be forgotten across sessions.**

> This file is the source of truth for permanent project knowledge.  
> Anything written here takes priority over assumptions or previous context.

---

## Project Rules for Grok Build

### Core Workflow — Strict Rules (Never skip for every feature or task)
1. **Planning first** — Always start in Plan Mode (or write a detailed plan). Never write code before the plan is approved.
2. **TDD** — Write failing tests BEFORE any implementation (red → green). Only implement code that makes tests pass.
3. **Small vertical slices** — Break every feature into tiny, independent, testable pieces.
4. **Update memory** — After each piece, update CLAUDE.md / MEMORY.md with architecture decisions, constraints, and lessons.
5. **Self-review** — After implementation, review your own code for simplicity, security, and maintainability.

**Never skip planning or tests on production features.**

### Memory Instructions
- Read MEMORY.md at the start of every session.
- Update MEMORY.md at the end of important work.
- Use /remember for quick notes that must survive sessions.

---

## Non-Negotiable Rules

- Follow the **Core Workflow — Strict Rules** above for every feature or task. Never skip planning or TDD on production code.

## Things to Never Do

<!-- Add explicit anti-patterns or forbidden actions -->

-

## Project Conventions

<!-- Naming, structure, patterns, tech choices that are locked in -->

-

## Important Decisions & Rationale

<!-- Architectural choices and why they were made -->

- **2025-06**: Adopted strict Core Workflow (Plan Mode first + TDD + small slices + memory updates + self-review). This is now mandatory for all feature/task work. Never write code before plan approval. See "Core Workflow — Strict Rules" section above.

- **2025-06 (Slice 1)**: Enforced "customer pays AFTER technician accepts and BEFORE technician drives to customer" as hard server rule.
  - /api/payments/create now rejects (400) unless job.status === "accepted" && paymentStatus !== "paid" (using pure canCreatePayment helper, TDD'd).
  - PATCH /jobs/:id/status for "on_way" now uses atomic updateMany (where accepted + paid) + helper pre-check. Prevents drive without confirmed pay + race conditions (like webhook claims).
  - Added backend/tests/payment-gates.test.ts (bun test) exercising the exact user spec.
  - Tech cancel post-pay still technically possible but customer protected via existing refund endpoint; noted for future hardening.
  - Rationale: User explicit requirement + previous QA races on money (B02 etc already fixed). Backend is now the unambiguous source of truth. Client UX (slices 2+) will mirror it.
  - Lessons: Always extract small pure decision fns for money/state transitions; test them first; use updateMany claims for anything touching paymentStatus or status that affects payout.

- **2025-06 (Slice 3)**: Fixed param key inconsistency (id vs jobId) for job deep links, payment success returns, and push notifs. job-tracking now tolerant (rawParams.id || rawParams.jobId). Senders for tracking now use 'id'. Prevents silent broken polls/hydration after pay or on cold start/notif. Critical for reliable post-pay experience.

- **2025-06 (Bugfix: choose technician error)**: Customer was hitting generic "something went wrong" (or unhandled 409) when selecting technician in technician-select (e.g. due to existing active job, or backend validation errors like tech not available). The api error handling lost the status/data, and 409 special case never triggered because thrown Error had no .status and hebrew message without '409'.
  - Improved api.ts request() to throw Error with .status and .data attached from response.
  - Updated catch in handleConfirmBooking: now properly detects 409 (by status or message keywords), shows informative modal, and onConfirm transfers to /job-tracking?id=activeJobId (which will show the PaymentRequiredScreen if the active job is in 'accepted' unpaid state, per the pay-after-accept rule).
  - For other errors, now shows the actual backend message instead of always generic.
  - This ensures no "error" on choose (when possible), and directly leads to payment page when there's an active that needs payment.
  - Lesson: always preserve full error response (status + data) in api layer for proper handling in UI flows; for active-order cases, prefer guiding to existing job's payment screen over forcing cancel.

- **2025-06 (Workflow Documentation - Customer Looking for Technician)**: Created detailed test case + narrative for the full customer flow of finding/booking a technician (see docs/test-case-customer-looking-for-technician.md).
  - End-to-end happy path: Home -> Report Issue (4-step wizard: photo req, bike+multi categories, full address+details, price est) -> Technician Select (location-based available techs + map + sortable list) -> Confirm booking (photo upload + POST /jobs with chosen techId -> pending job created, tech notified) -> Job Tracking (pending = WaitingScreen; after tech accepts -> PaymentRequiredScreen; pay via /payments/create + external/simulate; then live tracking to complete + review).
  - Critical enforcement: Payment only possible after technician accepts (status=accepted && !paid triggers the screen). No duplicate jobs (409 redirects to existing active's payment page). Pay before on_way/drive.
  - Matches all prior rules/fixes exactly. Documented edges, post-conditions, and parallel tech actions.
  - Self-review: No contradictions with non-negotiable pay-after-accept rule or other constraints. Test case is actionable for manual verification.

-

## Context to Always Remember

<!-- Key domain knowledge, user preferences, recurring gotchas -->

-

---

## How to Use This File

- Add new rules under the appropriate section.
- Be specific and actionable.
- When something becomes a "never forget" item, move it here.
- Update or remove outdated entries when they no longer apply.

Last updated: Current — Standalone web admin dashboard (HTML) added for managing technicians outside the mobile app.

**Admin Dashboard (HTML, outside the app)**
- New route: GET /admin on the backend.
- Access (exact):
  - Direct: https://ebikel-backend.onrender.com/admin?secret=YOUR_ADMIN_DASHBOARD_SECRET
  - Clean bookmark: just /admin — first time the page shows a secret input form (stored in sessionStorage).
- Set ADMIN_DASHBOARD_SECRET in backend/.env (local) and in Render Environment variables.
- The dashboard re-uses the existing admin APIs (/api/admin/pending-technicians, /api/admin/technicians, approve, revoke, delete).
- The APIs now also accept x-admin-secret header so the standalone HTML can call them without a full Better Auth user session.
- Features in Slice 1: pending + approved tech list, approve/revoke/delete, basic stats (pending/approved/active/total), search not yet but tabs/filters, Hebrew RTL, Tailwind CDN, in-page secret prompt.
- "More" ideas (future slices): richer stats, recent jobs, CSV export, etc.
- The existing mobile in-app admin (technician tabs) and CLI script continue to work unchanged.
- Security: secret only unlocks the HTML + trusted calls to the same admin surface that was already protected by isAdminUser + ADMIN_EMAILS.
- MEMORY note: Owner should keep the secret in a password manager and never share the ?secret= URL.

See the approved plan in the session plan.md for full details and phased rollout.

## 2025-06 (Deep QA Specification)
Created comprehensive manual E2E QA document: [docs/QA-FULL-CUSTOMER-TECHNICIAN-WORKFLOWS.md](/Users/arielyakobov/Desktop/ebike/docs/QA-FULL-CUSTOMER-TECHNICIAN-WORKFLOWS.md)
- **Scope**: Full two-sided flows (new account provisioning for fresh Customer + Technician, 4-step repair request with mandatory photo, technician-select map+list+book with 409 handling, accept, PaymentRequiredScreen + real Grow /payment WebView + 5s poll, on_way only after paid, full lifecycle to complete/review/earnings, extra repairs, invitations).
- **Non-negotiable coverage**: Every layer of "pay after accept, before drive" (pure gates TDD'd in payment-gates.ts + tests, atomic updateMany in jobs.ts:461 for on_way and 392 for accept, payments.ts:105 create gate + webhook claims, client banners/hidden buttons/early guards in active-job + job-tracking, 409 redirect in technician-select to existing payment page, no pre-accept pay).
- **Test user creation**: Exact tap-by-tap for new Google/Apple signups → role-select (customer vs technician cards) → profile completion for tech (vehicle, location, isAvailable, isApproved if needed) so they appear in customer searches.
- **Structure**: Preconditions (Render backend with real keys, simulator, location perms), happy path numbered steps + assertions, dedicated edge/race/resilience/security section (double accept, pay before accept, on_way before pay, active job 409, cold-start hydration, polling, RTL, photo security, withdrawal atomics, etc.), execution instructions, code inspection notes from this pass, open risks to verify at runtime.
- **Why this doc**: While emulator built (CocoaPods), produced the spec so user can immediately execute deep verification with fresh accounts once app launches. Matches user's "make new customer and new technician for the test" + "deep QA test ... check that everything works without bugs".
- **Self-review (this slice)**: Followed core workflow (explored first via reads/greps of schema, routes, all key screens/stores/api/payment.tsx/active-job, existing test doc; no new prod code; doc itself is the testable artifact). Small focused vertical (account creation separate, happy path, edges). Assertions explicit for the money rule at every gate. Simple, no over-abstraction. References the TDD unit tests that already exist. Will drive actual sim execution + any fixes (with TDD if code changes).
- **Findings during inspection (no new bugs, confirmations)**: 
  - Enforcement is solid and multi-layered exactly as required (no way to bypass in current code).
  - Client fixes from prior (api error shape, router.push to /payment, 409 modal redirect, handlePayNow, PaymentRequired early return) are wired correctly.
  - One item to explicitly assert in QA run: role-select (both cards do router.replace to customer tabs path) — verify that choosing "technician" actually surfaces the technician UI (tabs/jobs/active-job/earnings) via layouts or redirects. If not, treat as bug.
  - Stores centralized in lib/store.ts (repairRequest, activeJob, location, language, technician etc.).
  - Backend only has payment-gates.test.ts so far (green); full E2E is this manual spec (appropriate until Detox or similar added).
  - Build note at doc time: pods phase long-running; sim (iPhone 16 D00ED9E6 iOS 18.5) was already booted/frontmost.
- **Next**: Execute the doc in simulator with the two fresh accounts. Any failures → small TDD slice + memory append. Then update CLAUDE.md too.

---

Last updated (prior): 2025-06 — Grow payment gateway configuration check + payment page notes:
- Grow (Meshulam) is **NOT configured for real/production payments**:
  - backend/.env (local): GROW_USER_ID= (empty string), GROW_PAGE_CODE= (empty). This causes getGrowCredentials() to throw "GROW_NOT_CONFIGURED".
  - backend/.env.production: GROW keys were completely missing (now has placeholders: "your_grow_user_id_here" etc. — still not real values).
  - Result: /api/payments/create (and extra-repair) will return 503 "מערכת התשלומים טרם הוגדרה". Client (job-tracking.tsx) detects this and shows "ספק תשלומים לא מוגדר" modal + suggests the DEV Simulate button.
- In payments.ts: Real flow uses createGrowPaymentPage / getTransactionDetails / approveTransaction (all fail without keys). The /simulate-paid endpoint is intentionally allowed only when GROW keys are *absent* (for dev safety); it is blocked in "prod" if keys are set.
- Mobile side (eas.json, .env, .env.production): Correctly has no GROW keys (they are backend-only secrets). The EXPO_PUBLIC_ENABLE_DEV_SIMULATE_PAY flag controls the simulate button visibility.
- Production backend (https://ebikel-backend.onrender.com on Render): Environment variables come from the hosting platform dashboard, **not** from .env.production file. Currently missing → real customer payments will fail (fall back to simulate, which may be undesirable in prod).
- How "good" is the current config?
  - For **local dev/testing**: "Good" by design (uses the simulate endpoint + button we added earlier so you can test the full pay-after-accept flow without real money/GROW).
  - For **production/store release**: **Not good** — you must obtain real GROW_USER_ID + GROW_PAGE_CODE from your Grow/Meshulam business account and set them as secret env vars on Render (and fill the real values in .env.production for any local prod testing).
- Related payment page loading behavior:
  - When GROW is not configured, handlePayNow shows the info modal instead of pushing to the /payment WebView screen (so the "payment page" never loads a real form; it stays on the required-screen + simulate button).
  - Once real keys are set, /payments/create will return a valid paymentUrl, handlePayNow will push to /payment (the WebView page), and it should load the Grow payment form (with its own loading states, success/failure URL detection, and 5s status polling fallback).
  - The inline PaymentRequiredScreen (with "שלם עכשיו" + DEV simulate) is still the entry point after technician accepts + before on_way.

Recommendations (add to .env files / hosting):
1. Get credentials from Grow dashboard.
2. Set real values in backend/.env (for local real testing).
3. Set real GROW_USER_ID, GROW_PAGE_CODE, and COMMISSION_RATE as environment variables in your Render (or hosting) service.
4. Fill real values into backend/.env.production (remove the "your_..._here" placeholders before committing if desired).
5. After setting, restart backend and test: POST /api/payments/create should return {paymentUrl, amount} without 503.
6. In prod builds the DEV simulate button is hidden (via the flag), which is correct.

Self-review: This explains exactly why the payment page may appear to "load" (or never load a real form) and fall back to simulate. All previous payment-after-accept, atomic, redirect, and dev-simulate changes remain intact and now have clear config context. Update this entry once real GROW credentials are added and the payment WebView flow is verified end-to-end in production.

## Non-Negotiable Rules (reminder)
- Follow the **Core Workflow — Strict Rules** above for every feature or task. Never skip planning or TDD on production code.
- Read this file at the start of every session.
- Update this file at the end of important work (builds, fixes, inspections, store prep).