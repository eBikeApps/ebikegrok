# Deep QA: Full Customer + Technician End-to-End Workflows (Payment Gate Enforced)

**Objective:** Verify the complete two-sided on-demand e-bike/scooter repair marketplace works bug-free, with strict adherence to the core rule: **Customer pays ONLY AFTER technician accepts the job and BEFORE the technician can mark "on_way" / drive to the customer.**

This is the authoritative manual test specification. Run end-to-end on device/simulator against the configured backend (currently Render with real Grow keys).

All previous hardening (atomic claims, pure gates, 409 redirects, PaymentRequiredScreen, tech payment-wait banner + hidden button, in-app WebView + poll, error propagation, etc.) must be exercised and pass.

**Last Updated:** During build of simulator (CocoaPods phase). Per project rules: update MEMORY.md + CLAUDE.md after execution + findings.

---

## Test Environment & Preconditions

- **App:** Latest build running in iOS Simulator (or physical device via Xcode / `expo run:ios --device <UDID>`). Bundle: `com.ebikeland.app`, Display: "eBike".
- **Backend:** `EXPO_PUBLIC_BACKEND_URL=https://ebikel-backend.onrender.com` (Render). Real GROW_USER_ID + GROW_PAGE_CODE configured on Render → simulate-paid is **blocked** (correct for production-like testing). Use real Grow payment page in WebView (test cards if Grow dashboard in test mode).
- **Permissions:** Location (always + when-in-use), Camera, Photos. Grant when prompted.
- **Network:** Device/sim can reach Render + Grow.
- **Clean state:** No active jobs for the test customer accounts. Use fresh sign-ups (see below).
- **Two test accounts minimum (created fresh for this QA):**
  - Customer A (new email/Google)
  - Technician B (new email/Google, will be made available/approved)
- **Optional second device or rapid sign-out/in** for parallel actions (recommended for realistic timing).
- **Tools:** Terminal for `bun test` (backend payment gates), Prisma Studio or direct DB queries for verification/cleanup if you have Render DB access, app logs.
- **RTL/Hebrew:** App defaults to Hebrew (language store). Verify all strings, layouts, pickers are correct and not broken.
- **Data:** Israeli cities/streets via /api/streets (dynamic). Use real-ish Tel Aviv area for location matching tech radius.

**Known from code inspection (pre-QA):**
- Job model: status (pending/accepted/on_way/arrived/in_progress/completed/cancelled), paymentStatus (pending/paid/...), full timestamps, photoUrl, estimated + final price, extraRepairRequests, invitations, relations.
- Server gates (src/lib/payment-gates.ts + wired in jobs.ts:447 and payments.ts:105): canCreatePayment (accepted + !paid), canTransitionToOnWay (accepted + paid). TDD tests exist and pass (`bun test` in backend).
- Atomic claims: POST /jobs (existing active → 409 + activeJobId), accept (updateMany pending+null tech), on_way (updateMany accepted+paid), webhook paid claims.
- Client: api.ts throws with .status + .data (enables 409 handling). technician-select catches 409 → modal → router.replace to job-tracking of active. job-tracking has WaitingScreen vs PaymentRequiredScreen early return + handlePayNow does router.push({pathname:'/payment', params}). payment.tsx = full WebView + nav watcher + 5s /status poll fallback + success "continue to tracking". active-job (tech): banner + no on_way button when accepted+unpaid; fast polling.
- Role flow: sign-up (Google/Apple via Better Auth) → role-select (customer blue / technician green cards, PATCH /users/me) → respective tabs. Note: both buttons currently route to `/(customer)/(tabs)` — layouts must redirect based on role or this is a latent bug to verify.
- Photo mandatory in repair-request (store + UI). Price from PRICE_RANGES [category + bikeType].
- No other automated E2E; this doc + backend unit tests are the QA surface.

---

## Section 1: Create Fresh Test Accounts (New Customer + New Technician)

**Goal:** Two brand-new users never used before. One ends as customer, one as technician. Performed in the running app.

### Steps (repeat for each account; use different emails/Google accounts)

1. Fresh install or sign out completely (profile → sign out if present; or delete app data / use new simulator).
2. Open app → lands on sign-up / sign-in (Google or Apple prominent).
3. Sign up with **new** Google account (or Apple) or email flow if available.
   - Expected: Auth succeeds via Better Auth, session cookie set, user created in DB with role="pending", isApproved=true (customers), email verified false initially.
4. App should redirect to **role-select** (beautiful gradient screen with two big cards: "לקוח" blue + "טכנאי" green).
5. For **Customer A**:
   - Tap the Customer (blue) card.
   - Expected: PATCH /api/users/me {role: "customer"}, role updated, router to `/(customer)/(tabs)` (home with map + "Report Issue").
   - Grant location + notifications if prompted.
   - Verify in profile or home: you are a customer. No technician features.
6. For **Technician B** (sign out of Customer A first, or use second context):
   - Repeat signup with fresh account.
   - At role-select: Tap the Technician (green) card.
   - Expected: Same PATCH. Then (depending on layout logic) should eventually land in technician experience: bottom tabs including "Jobs", "Earnings", profile with tech fields (vehicle, availability toggle, etc.).
   - **Critical test:** After choosing technician, does the UI correctly show technician dashboard/tabs (jobs list for pending claims, active-job screen, earnings, not the customer home)? If it stays on customer tabs or crashes role, **log as bug**.
7. **Technician profile completion (required for visibility in customer searches):**
   - Go to technician profile or settings.
   - Set: phone, vehicleType (e.g. "אופנוע + ציוד נייד"), serviceRadius (e.g. 15-20km), basePrice (e.g. 80), bio optional.
   - Toggle isAvailable = true.
   - Set current location (use device GPS or map pin near a test customer location, e.g. central Tel Aviv).
   - Save.
   - Expected: Backend updates User. isAvailable=true, location set.
8. **Make technician "approved" and discoverable (if isApproved defaults false for techs):**
   - In current code, customer booking and available list require `role="technician" && isApproved=true`.
   - If the new tech does not appear in customer "technician-select":
     - Use Prisma / DB admin (Render dashboard or local if you have connection) or a temporary admin endpoint: `UPDATE "User" SET "isApproved" = true WHERE email = 'tech-test-xxx@...'`
     - Or check if there's an "admin" tab in technician UI that self-approves for dev (unlikely in prod).
   - Re-login as tech or refresh. Verify in customer flow that the tech appears (distance/rating/price).

**Post-creation assertions:**
- Two distinct users in DB.
- Customer can create jobs; tech can accept/see pending.
- Tech appears in /api/technicians/available when location + available + approved.
- Sign out/in works; session restores role correctly.
- No data leakage between accounts.

**Cleanup note:** These accounts can be reused or deleted later via DB or by completing/cancelling all their jobs.

---

## Section 2: Core Happy Path — Customer Books, Tech Accepts, Customer Pays (Gate Enforced), Full Lifecycle

**Pre:** Fresh Customer A + approved/available Technician B with location near customer test point. No active jobs. App on simulator booted with location services.

### 2.1 Customer: Create Repair Request (4-step wizard + photo mandatory)

1. As Customer A, from home tab (map or list), tap "Report Issue" / big repair CTA.
2. **Step 1 — Photo (MANDATORY):**
   - Tap camera or gallery.
   - Capture/select a clear photo of "damaged tire" or similar.
   - Expected: Preview appears, no "Next" until photo chosen. (Try proceed without → blocked.)
   - Tap Next.
3. **Step 2 — Bike + Categories:**
   - Choose "Electric Bike" (or Regular).
   - Multi-select 1-2 categories e.g. "front_tire_puncture", "brake_issue".
   - Expected: Categories highlighted, dynamic price estimate appears from PRICE_RANGES (e.g. 350-650 NIS range). "Next" enabled.
4. **Step 3 — Details + Israeli Address:**
   - Name, phone (050-...), optional email.
   - City picker (searchable list of Israeli cities, e.g. "תל אביב-יפו").
   - Street: after city, loads dynamically from backend /api/streets (or fallback). Search + select real street.
   - House number.
   - Expected: Validation (phone 10 digits starting 0, required fields). Streets load without error.
5. **Step 4 — Review & Find Tech:**
   - Summary card: photo thumb, bike, categories, address, price range estimate.
   - Tap "Find Technician".
   - Expected: Store serializes request via getRequest(), router.push to /technician-select. No job created yet.

**Assertions:** useRepairRequestStore holds all data correctly. No job row yet. Photo will be uploaded only on confirm booking.

### 2.2 Technician Selection (Map + List, Real-time-ish)

6. Screen loads:
   - Calls getAvailableTechnicians(currentLocation).
   - Expected: Map (react-native-maps + Google) shows markers for qualifying techs (isAvailable, approved, within radius, has location).
   - Sortable list below (default "nearest"). Cards show: name/avatar, rating (stars + count), vehicle, basePrice or est, distance/ETA.
   - Sort buttons: nearest, highest_rated, lowest_price — list reorders instantly.
   - Pull-to-refresh works.
7. Tap a card for Technician B.
   - Expected: Confirm modal with tech details + "Book this technician" (or Hebrew equivalent).
8. Tap confirm / Book.
   - Expected (double-tap guard active via bookingLoading):
     - If photo in store: POST /api/uploads (base64 or file, security size/mime checks on backend).
     - POST /api/jobs with full payload (technicianId, photoUrl, description, bikeType, category, prices, lat/lng, address, name/phone).
     - Backend: checks no active job for customer → 201 + job (pending). If 409 → client shows clear modal with activeJobId and onConfirm does router.replace('/job-tracking?id=...').
     - Push notification attempted to the specific tech (or broadcast).
     - Client: setActiveJob, addOrder, reset repair store, router.replace to /job-tracking?id=NEW_ID.
9. **Immediate 409 test (important edge, part of this flow or repeat):**
   - While this job is still active/unpaid, from customer try to start another repair request + choose any tech.
   - Expected: 409 from backend (existingActive), client catches via error.status/data, shows friendly Hebrew modal "כבר יש לך הזמנה פעילה...", confirm navigates directly to the existing job's /job-tracking (which will be in PaymentRequired if accepted unpaid).

**Assertions (post-booking):** Job row exists with status=pending, paymentStatus=pending, photoUrl set, correct customerId + technicianId. Customer sees WaitingScreen. Tech (when switched) sees it as actionable.

### 2.3 Technician Accepts (Atomic + Pay Push)

10. Switch to (or sign in as) Technician B account.
    - Go to technician jobs/dashboard (tabs/jobs or home).
    - Expected: Sees the pending job from Customer A (via /jobs or /technician/pending). Limited info pre-accept (no phone/email yet — per B08 fix).
11. Tap Accept / "קבל" on the job.
    - Expected:
      - PATCH /api/jobs/:id/status {status: "accepted"}
      - Backend: valid transition, atomic updateMany (if unassigned) succeeds (409 if raced), sets acceptedAt + tech snapshot location, sets isAvailable=false on tech, pushes to customer "הטכנאי מוכן... שלם עכשיו".
      - Job now status=accepted, paymentStatus still pending.
      - UI: job moves to active or "my jobs". Tech now has the job assigned.
12. Switch back to Customer A (or via polling/push deep link):
    - /job-tracking should flip from WaitingScreen → **PaymentRequiredScreen**.
    - Screen shows: tech card, price, prominent "שלם עכשיו" button, note that tech is ready but waiting for payment. Cancel still possible pre-pay.

**Assertions (pay gate):**
- Cannot have paid before this point (no payment row or status paid while pending).
- Tech cannot have driven yet.
- Push + polling (3-5s customer, faster for tech) keep in sync. Cold start / app restart on job-tracking with id param must hydrate the accepted unpaid state and show pay screen.

### 2.4 Customer Pays (Real Grow via In-App WebView + Fallback)

13. On PaymentRequiredScreen, tap "Pay Now".
    - Expected: POST /api/payments/create {jobId}
      - Backend: canCreatePayment check passes (accepted + !paid) → 200 with {paymentUrl, amount}. Creates/updates Payment record (pending, commission calc).
      - (If keys missing would 503 + client fallback, but on Render they are set.)
    - Client: router.push('/payment', { jobId, paymentUrl, amount, description }).
14. Payment screen:
    - Shows amount, secure badge, loads WebView with the Grow paymentUrl (real form from Grow/Meshulam — Israeli payment page).
    - Loading states, onLoadEnd etc.
15. Complete payment in WebView (use test card if available in your Grow account; otherwise real small transaction or note for later).
    - Expected primary path: Grow success redirect hits backend /api/payments/success (HTML shown, window.close attempt) → WebView nav change detects /success → sets 'success' state.
    - Fallback: 5s poll to /api/payments/status/:jobId (authed) detects paymentStatus=paid → success.
    - On success: nice green UI "התשלום התקבל!", amount, "מעקב אחר הטכנאי" button.
16. Tap continue:
    - router.replace to /job-tracking?id=jobId.
    - Expected: PaymentRequiredScreen gone. Full tracking UI appears (map with both locations, timeline starting accepted, chat/call buttons now active since post-accept, customer phone revealed to tech? etc.).
    - Backend webhook (or simulate path) also: atomic updateMany job paymentStatus → paid (idempotent), Payment completed, push to tech "payment received, you can now go".

**Assertions (the money gate):**
- Payment create was impossible before accept.
- on_way still impossible for tech at this moment (we will test next).
- WebView + poll + success navigation all exercised.
- Job.paymentStatus = 'paid', Payment row has growTransactionCode etc.
- No double payment possible (gate + webhook claim).

### 2.5 Technician Proceeds Only After Pay (on_way gate)

17. As Technician B, refresh active-job (or via push / fast poll ~800ms).
    - Expected: The yellow "⏳ ממתין לתשלום הלקוח" banner **disappears**.
    - "יצאתי — בדרך ללקוח" (on_way) button **appears and is enabled**.
18. Tap "on_way".
    - Expected:
      - PATCH /api/jobs/:id/status {status: "on_way"}
      - Backend: canTransitionToOnWay pre-check (if not → 402), then atomic updateMany (status=accepted AND paymentStatus=paid) succeeds → status=on_way, onWayAt set. 409/402 otherwise.
      - Push or update to customer.
      - Client: status timeline advances, map ETA etc. updates.
19. Continue full lifecycle as tech + customer confirmations:
    - Tech: arrived → customer confirms (customer PATCH in_progress only allowed from arrived).
    - in_progress (tech marks, or customer confirms arrival).
    - Tech can now request extra repair (extra-repair.tsx → /payments/extra-repair → customer gets push + pays via similar WebView flow for extra).
    - On complete: tech sets finalPrice (may differ), marks completed. Customer can submit review (rating 1-5 + comment) → /submit-review. Review created, earnings Transaction for tech (net after commission).
    - Verify in technician earnings tab: the earning appears (before/after withdrawal logic).
    - Orders history for customer shows the completed job.

**Assertions:**
- Any attempt by tech to on_way **before** the pay step is blocked at two layers (client banner/hidden button + early guard + backend 402/409 with clear Hebrew message).
- After pay: on_way succeeds atomically.
- Later states (arrived etc.) only after previous.
- Customer cannot force in_progress before arrived.
- On complete: final price, review, transaction created, tech totalEarnings updated.
- Chat (messages route) works between the pair post-accept.
- No second active job for customer.

**Post happy path cleanup:** Cancel or let complete; note jobNumber for DB reference.

---

## Section 3: Edge Cases, Error Paths, Resilience, Security (Deep Coverage)

Run these as dedicated sub-flows or injected into the happy path. Create new fresh jobs/accounts as needed.

**Payment & Money Edges (non-negotiable):**
- Pay attempt on pending job (from job-tracking or direct API): backend 400 "Payment is only allowed after a technician accepts...". Client shows error, no WebView.
- Pay attempt on already-paid: blocked.
- on_way before paid: backend 402 (pre-check) or 409 (atomic claim fails). Client in active-job never offers the button + banner visible.
- Double tech accept race (two techs tapping at same ms on same unassigned pending): only one atomic claim succeeds; loser gets 409 "העבודה כבר נלקחה...".
- Webhook / success after already paid: idempotent (count=0 paths), no double credit.
- Cancel post-pay by customer: limited; may trigger refund path (tech-initiated refund request creates pending refund tx).
- Extra repair: tech requests while in_progress, customer pays via separate Grow flow (cField "extra"), status paid on ExtraRepairRequest.

**Booking & Active Job:**
- Customer with active unpaid tries book another: 409 → graceful redirect to existing payment screen (no duplicate jobs, no generic error).
- Tech no longer available/approved at exact booking instant: still creates (current code) or 404? Document actual behavior.
- No photo: blocked in wizard step 1.
- Bad address/street: validation + streets API errors handled gracefully.

**Lifecycle & UI:**
- App kill + restart on payment required or tracking: deep link tolerant (id or jobId param), polling or /customer/active or /jobs/:id hydrates correct screen (PaymentRequired or full tracking).
- Polling intervals: customer ~3-5s, tech faster. Status/payment refs prevent stale UI.
- Push notifications: acceptance → pay prompt; paid → tech can drive; extra repair request; etc. (Resend fallback if no token).
- Real-time map, ETA calc, timeline timestamps.
- Customer confirms in_progress only after tech arrived.
- Reviews only after completed. One per job.
- Technician invitations for secondary tech (invitations.tsx): create, accept/reject, earnings split? Test if implemented.

**Tech Dashboard & Availability:**
- Pending jobs list for tech (unassigned or assigned).
- After accept: tech marked unavailable, doesn't see new pendings easily.
- After complete: availability can be toggled back on.
- Earnings: list of transactions, balance calc (earned - withdrawals), withdrawal request form (strict validation, atomic balance check, serializable tx to prevent overdraw races).
- Active job screen for tech: all states, extra repair button, chat, customer contact (post pay/accept), map.

**Auth/Role/Profile:**
- New user forced through role-select exactly once.
- Switching roles? (probably not allowed easily — test).
- Technician without profile fields: may not appear in searches (verify).
- isApproved=false tech: invisible to customers.

**Resilience & Non-Functional:**
- Offline: queued actions? graceful degradation of polling.
- Slow network: loading states, retry in payment WebView.
- Hebrew/RTL: all screens (pickers, modals, gradients, maps direction if relevant).
- Permissions revocation mid-flow.
- Multiple rapid taps (guards on booking, pay, status).
- Large photo: client-side size guard before upload + backend security.
- Concurrent customer + tech actions: state machine + atomics keep consistent.

**Error UX (from previous bugs fixed):**
- Network error on choose tech or pay: shows real backend message (Hebrew), not always "something went wrong".
- 409 on booking: useful modal + direct to payment, not dead-end error.

---

## Section 4: Execution Instructions & Reporting

1. Get the simulator running (see build notes at top; use the UDID command below or Xcode).
2. Provision two fresh accounts (Section 1).
3. Execute happy path (Section 2) end-to-end at least once with real timing (polling, pushes if tokens registered).
4. Execute all major edges (Section 3). Use direct API calls (curl with cookies or postman) or app UI for negative cases.
5. For each step, note PASS / FAIL + screenshot or log snippet + actual vs expected.
6. Backend verification (if DB access):
   - `SELECT * FROM "Job" WHERE id = '...';` — check status, paymentStatus, timestamps, finalPrice.
   - Same for Payment, Transaction, Review, ExtraRepairRequest.
7. Run `cd backend && bun test` — payment-gates must stay green.
8. After full pass: sign out, clean data (cancel/complete jobs, optionally delete test users or mark inactive).

**Copy-paste for simulator control (while pods/xcodebuild runs or to restart cleanly):**
```bash
cd ~/Desktop/ebike/mobile
source ~/.nvm/nvm.sh && nvm use 18
npx expo run:ios --device D00ED9E6-1C58-40F0-A369-64832EAA7DE5
```
Or Xcode: `cd ~/Desktop/ebike/mobile/ios && open eBike.xcworkspace` → scheme eBike → iPhone 16 (18.5) → Run.

**Current known build state (at time of doc creation):** expo run:ios harness task still reporting only "Installing CocoaPods..." (15+ min). Simulator itself is booted and frontmost (iPhone 16 D00ED9E6... (Booted)). Pods step is expected before xcodebuild/Metro. If no progress, kill background and run the command above yourself for live tail.

---

## Section 5: Open Risks / Items to Verify During Run

- Role-select routes both to customer tabs path — does technician role actually get the technician UI (tabs + active-job + earnings)?
- Real Grow payment page loads and succeeds end-to-end on Render (no 503, WebView works, webhook fires, status flips).
- Push tokens registered and notifications arrive (or at least the Resend/email fallback).
- Exact Hebrew strings and no layout breakage in all modals, pickers, payment success.
- Performance of map + polling on device.
- Withdrawal atomic balance logic (create two rapid withdrawals).
- Any remaining pre-existing QA items from QA_REPORT_V2 / prior logs that touch these flows.

---

**Self-Review of this QA Doc (per project rules):**
- Covers the user's #1 requirement (pay after accept, before drive) with multiple overlapping test points (UI, API, DB, atomic, client guards).
- Small slices: account creation separate, happy path, then edges.
- Actionable numbered steps + clear assertions.
- Includes TDD artifacts that already exist (payment-gates.test.ts).
- No new prod code yet — this is the test spec. When executing and finding bugs, apply full workflow (plan slice → failing test → fix → green → memory update).
- Simple, focused on the two-sided + money flow. No gold-plating.
- Will be executed in simulator once build finishes; findings will drive any fixes + memory append.

Run this fully. Do not stop until customer and technician sides are proven solid with the payment gate holding under all attempted bypasses.

If bugs surface during execution, open a focused slice, write a failing test first (unit or add to this doc), fix, re-verify.

Good luck — this should make the app bulletproof for the stated requirements.
