# Test Case: Customer Looking for a Technician (End-to-End Workflow)

**Objective:** Verify the complete customer journey for reporting an e-bike issue and selecting/booking a technician, including the enforced payment-after-accept rule.

**Preconditions:**
- App installed and user is logged in as a Customer (role selected).
- Location permissions granted.
- Backend running with at least one approved, available technician (with location set, isAvailable=true, within service radius).
- No active unpaid job for the test customer (or handle the 409 redirect case).
- Dev mode for simulate pay if no real payment provider (GROW keys not configured).

**Test Data:**
- Sample issue: Front tire puncture on electric bike.
- Customer details: Name "Test Customer", Phone "0501234567", Address in supported city (e.g. Tel Aviv, street from /api/streets).
- Location: Use a lat/lng near a test technician.

## Step-by-Step Test Procedure (Manual / Exploratory Test)

1. **Start Repair Request (from Customer Home)**
   - From customer tabs home (map view), tap the "Report Issue" / repair button.
   - Expected: Navigates to /repair-request (4-step wizard using useRepairRequestStore).

2. **Step 1: Upload Photo (Required)**
   - Tap "Take Photo" or "Choose from Gallery".
   - Capture/select a photo of the "issue".
   - Expected: Photo preview shown, "Next" enabled. (Error if no photo on proceed.)
   - Tap Next.

3. **Step 2: Bike Details & Repair Categories**
   - Select bike type: "Electric Bike".
   - Multi-select categories: "front_tire_puncture", "brake_issue".
   - Expected: Selections highlighted. Price estimate not yet shown. "Next" enabled.
   - Tap Next.

4. **Step 3: Customer Details & Address (Israel-only)**
   - Fill name, phone (10 digits starting 0).
   - Select city (picker, e.g. "תל אביב-יפו").
   - Select street (fetched from backend /api/streets?city=... or manual).
   - House number.
   - Optional email.
   - Expected: Validation errors for missing/invalid fields. Streets load dynamically.
   - Tap Next.

5. **Step 4: Price Estimate Review**
   - Review summary: photo thumbnail, bike type, categories, calculated price range (from PRICE_RANGES in lib/types.ts, e.g. ~450-450 for the two categories on electric).
   - Note about estimate.
   - Tap "Find Technician".
   - Expected: Navigates (push) to /technician-select. Repair store data passed via getRequest().

6. **Technician Selection**
   - Screen loads available technicians (API call to /api/technicians/available using currentLocation from store).
   - Expected: Map (WebView or native) showing tech markers + list sorted by default "nearest".
   - Sort options: nearest, highest_rated, lowest_price.
   - Each tech card shows: name, rating, vehicle, basePrice, distance/ETA (calculated client-side from serviceRadius).
   - Only techs that are isAvailable=true, have location, approved, and within radius appear.
   - Tap a technician card.
   - Expected: Confirm booking modal with tech details + "Book this technician" button.

7. **Confirm Booking (Job Creation)**
   - Tap confirm.
   - Expected:
     - If photo: uploads to /api/uploads (base64), gets url (with size/mime guards).
     - POST /api/jobs with: technicianId, photoUrl, description (auto-generated from categories), bikeType, category (joined), prices, lat/lng, address, name/phone.
     - Backend: Validates no active job for customer (409 if yes -> special handling), verifies tech approved.
     - Creates job with status="pending", assigned to the chosen technicianId.
     - Notifies the specific tech via push (if they have expoPushToken).
   - On success:
     - setActiveJob(newJob), addOrder, reset repair store.
     - router.replace to /job-tracking?id=NEW_JOB_ID
   - Special case (if 409 active order exists): Shows modal "Active Order Exists", on confirm redirects to /job-tracking of the existing activeJobId (so customer goes straight to payment if that's the state).

8. **Job Tracking - Pending State (Waiting for Technician Accept)**
   - Arrives at job-tracking.
   - Expected: Since status=pending, renders <WaitingScreen /> (animated "waiting for tech to accept", with cancel option).
   - Polling starts (every ~3s) for job status updates via GET /api/jobs/:id (and payment status).
   - Customer can cancel here (if not yet paid).
   - (In parallel test: Switch to technician account/app – they should see this as pending job for them in their dashboard/jobs list.)

9. **Technician Accepts the Job (Simulate / Parallel)**
   - As the assigned technician: Accept the pending job (PATCH /api/jobs/:id/status {status: 'accepted'}).
   - Backend effects:
     - Status -> 'accepted', acceptedAt set, tech location snapshot.
     - Marks tech unavailable.
     - Push notification to customer: "Technician ready to come, pay now to confirm".
   - Customer side (via polling or push navigation):
     - Screen automatically switches from WaitingScreen to PaymentRequiredScreen (because status==='accepted' && paymentStatus !== 'paid').

10. **Payment Phase (Customer Pays After Accept)**
    - PaymentRequiredScreen shows:
      - "Technician is ready to depart!"
      - Tech card, price (estimated min).
      - Big "Pay Now" gradient button.
      - Cancel option (pre-pay only).
    - Tap "Pay Now" (handlePayNow):
      - POST /api/payments/create {jobId}
      - Backend: Creates Grow payment page (or errors if not configured), upserts Payment record (pending), returns paymentUrl.
      - If already paid: handled.
      - Client: Sets paymentUrl, opens with Linking.openURL(paymentUrl) (external browser to payment provider).
      - Shows "waiting for approval" + reopen button.
    - (Dev note: If GROW not configured, shows special message + "Simulate Pay" button (gated by EXPO_PUBLIC_ENABLE_DEV_SIMULATE_PAY). Simulate calls /api/payments/simulate-paid which marks paid + notifies tech.)
    - Payment provider success -> webhook marks job.paymentStatus='paid' + Payment completed. Push to tech "payment received, you can now go".
    - Customer polling detects paid -> paymentStatusRef updates, screen transitions away from PaymentRequiredScreen to full tracking UI.
    - Now tech can proceed to on_way (backend enforces paymentStatus==='paid' before allowing on_way).

11. **Post-Payment Tracking & Completion**
    - Full map shows both locations, ETA, status timeline (accepted -> on_way -> arrived -> in_progress -> completed).
    - Customer actions: Call tech (phone only revealed post-accept), chat, cancel (limited post-pay), confirm arrival when tech marks 'arrived'.
    - Tech marks progress; customer confirms in_progress.
    - On complete: final price, review screen.
    - Job status completed, payment settled, review created, earnings for tech.

**Expected Results / Assertions (for this test):**
- No way for customer to pay or force progress before tech accepts (stays in WaitingScreen).
- Choosing tech while having an active unpaid job does NOT create duplicate; instead redirects to the payment page of the existing job.
- Photo is uploaded and attached to job.
- Price shown to customer is the estimate; final price set by tech on completion.
- Location/address sent correctly; tech sees it.
- After pay, tech can drive (on_way allowed); before pay, blocked.
- Notifications and polling keep both sides in sync.
- Cancel protections work (no cancel after paid by customer).
- On success: Job appears in customer's orders, tech earnings updated, review possible.

**Edge Cases to Test in Same Flow:**
- No photo: blocked at step 1.
- Customer has active job: 409 on booking attempt -> redirect to payment.
- Tech no longer available when booking: backend 404 or create still succeeds? (current code allows if approved).
- Payment simulate only in dev (flag + no GROW keys).
- App restart / cold start: job-tracking should hydrate from /jobs/:id or active endpoint.

**Post-Test Cleanup:**
- Cancel or complete the job.
- Reset test data (active jobs, etc.).

**Workflow Summary (Narrative for Customer Looking for Technician):**
Customer sees problem -> "Report Issue" -> guided 4-step form (photo mandatory for tech prep, categories for pricing, full Israeli address for dispatch) -> real-time price estimate -> nearby available techs (filtered by radius, availability, location; sorted by distance/rating/price with map) -> pick one -> book (job created pending with that tech, photo uploaded, tech notified) -> wait in tracking -> tech accepts -> pay screen appears (enforced: no pay before accept, no drive before pay) -> pay (external provider or dev simulate) -> live tracking until complete + review.

This flow ensures quality (photo + acceptance), fairness (pay only after commitment), and safety (no multiple actives).

Last updated per workflow rules. Self-review: Matches all prior slices/fixes (pay after accept, atomic claims, no double jobs, redirects, simulate dev tool, etc.). No violations of non-negotiable rules.