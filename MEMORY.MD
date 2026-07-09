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

---

## 2026-06-17 — Session handoff (read when user returns)

### Production / Render (still open)
- **Backend URL:** https://ebikel-backend.onrender.com
- **GitHub repo:** eBikeApps/ebikegrok, branch `main`, Root Directory must be `backend`
- **Deploy hook:** `https://api.render.com/deploy/srv-d6nkoji4d50c7389lcpg?key=DhBm0ivgk7g`
- **Problem:** Render was redeploying but still serving **old code** (email sign-up 410, no `version` in `/health`). User must connect repo in Render dashboard → Manual Deploy. Verify: `GET /health` should return `"version":"2026-06-17-email-signup"`.
- **Do NOT set** `DISABLE_EMAIL_SIGNUP=true` on Render.

### Email sign-up (code fixed locally + pushed)
- Better Auth handles `/api/auth/sign-up/email`; no manual 410 block.
- Local backend on `127.0.0.1:3001` works; `mobile/.env` points simulator to it (not committed — gitignored).
- Production builds use `eas.json` → Render URL.

### Technicians (DB state)
- **Deleted** fictitious seed techs: `tech-seed-1/2/3` (example.com).
- **Remaining real techs:** `maortest@ebike.com`, `tech-test@ebike.com` (available, TLV), `arielyakobov@gmail.com` (offline).
- **Simulator fix:** iOS Simulator GPS is Cupertino → filters out Israeli techs. Added `mobile/src/lib/customer-location.ts` — dev fallback to Tel Aviv (32.0853, 34.7818). Also fixed `api.ts` to send Bearer token.

### Test accounts
| Role | Email | Password |
|------|-------|----------|
| Customer | `a@abc.com` | `123456` |
| Technician | `tech-test@ebike.com` | `123456` |
| (user registered) | `maort@ebike.com` | (user-chosen at sign-up) |

### Fixes shipped this session
1. **Payment screen cancel button** (`job-tracking.tsx`): `ConfirmModal` was missing on early-return paths (`PaymentRequiredScreen`, `WaitingScreen`) — cancel button did nothing. Fixed + error handling on cancel API failure.
2. **Render:** `render.yaml`, `backend/render-build.sh`, GitHub Actions deploy hook workflow.

### Still to verify when back
- [ ] Render connected to GitHub + latest deploy live
- [ ] Email sign-up on production (not just local)
- [ ] Grow payments (GROW_USER_ID was invalid error 701 — needs real credentials)
- [ ] `role-select.tsx` bug: technician card may route to customer tabs (mentioned in QA)
- [ ] Google/Apple OAuth session null after redirect on simulator

---

## 2026-06-22 — Session handoff (read when user returns)

### App Store — גרסה 1.7.0 (build 19) הועלתה
- **Build:** https://expo.dev/accounts/elvisebike/projects/ebike/builds/6384cb19-aec8-4f49-ab99-47e2c4f8890f
- **Submit:** https://expo.dev/accounts/elvisebike/projects/ebike/submissions/3d620f5f-dfa6-4c68-9aac-89f200ed394a
- **App Store Connect:** https://appstoreconnect.apple.com/apps/6759334424/testflight/ios
- **ASC App ID:** 6759334424 | **Bundle:** com.ebikeland.app | **EAS owner:** elvisebike
- **סטטוס:** Build + Submit ל-Apple הושלמו. ממתין ל-Processing (~5–15 דק) ואז Submit for Review ב-ASC.
- **app.json:** version 1.7.0, ios buildNumber 19, android versionCode 19
- **eas.json production env:** Render backend URL, Google Maps, support phone, Supabase URL+anon key, MOCK_PAYMENTS=false

### תכונות ששוחררו ב-1.7.0
1. **מספר הזמנה סידורי** — `EB-XXXXXX` (backend+mobile `job-reference.ts`, כל job API מחזיר `jobReference`)
2. **העלאת תמונות ל-Supabase Storage** — bucket `job-photos`, backend service role + mobile fallback
   - **באג שתוקן:** `expo-file-system` v19 זורק על `getInfoAsync` — חייב `expo-file-system/legacy` ב-`upload-job-photo.ts`
   - Mobile: backend upload קודם, אחר כך Supabase direct; `FileSystem.EncodingType.Base64`
3. **כפתורי קשר לטכנאי** (`active-job.tsx`) — טלפון + WhatsApp ללקוח **רק אחרי** `payment_status=paid` **וגם** סטטוס `on_way|arrived|in_progress|completed`
   - WhatsApp: `openWhatsAppChat()` ב-`mobile/src/lib/phone.ts` (wa.me + מספר מההזמנה)
4. **ConfirmModal רגוע יותר** — פחות אגרסיבי על שגיאות
5. **Mock payments** — מקומי `MOCK_PAYMENTS=true`; production (eas.json) `false`

### Supabase (פרויקט gxwcbdphjmrwmrmtqtms)
- **URL:** https://gxwcbdphjmrwmrmtqtms.supabase.co
- **Bucket:** job-photos (public read, anon insert ל-`jobs/` prefix)
- **מפתחות:** ב-`backend/.env` (service_role) וב-`mobile/.env` / `eas.json` (anon)
- **SQL:** `mobile/supabase-schema.sql` (bucket + RLS policies)
- **חשוב:** הוסף ל-**Render** לפני שמשתמשי App Store מעלים תמונות:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=job-photos`
  - `MOCK_PAYMENTS=false` בפרודקשן
- **לוג הצלחה ב-backend:** `[Storage] Supabase job-photos upload enabled`

### סביבת פיתוח מקומית (נכון לסשן זה)
- Backend: `http://127.0.0.1:3001` (`MOCK_PAYMENTS=true` לבדיקות)
- Mobile `.env`: `EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:3001`
- Expo: `npx expo start --ios --clear` (Node 18 via nvm)
- **Test accounts:** customer `a@abc.com`/`123456`, tech `tech-test@ebike.com`/`123456`
- **מיקום סימולטור:** Tel Aviv fallback ב-`customer-location.ts` (40km radius לטכנאים)

### עדיין לפתוח / לבדוק
- [ ] Render — הוספת משתני Supabase + `MOCK_PAYMENTS=false` + redeploy
- [ ] App Store Connect — build 19 Processing → בחירת build → Submit for Review
- [ ] טקסט "מה חדש" 1.7.0 (נוסח מוכן בשיחה — העלאת תמונה, EB-XXXXXX, תשלום לפני יציאה, WhatsApp לטכנאי)
- [ ] Prisma P1001 מקומי — חיבור DB ל-Supabase pooler לפעמים נופל (לא חוסם build)
- [ ] טאב jobs של טכנאי — עדיין Zustand בזיכרון, לא היסטוריה מ-API (לא בוצע)
- [ ] סיבוב מפתחות Supabase — הודלפו בצ'אט, לשקול rotation

### פקודות שימושיות
```bash
# Build + Submit ל-App Store
cd mobile && nvm use 18 && eas build --platform ios --profile production --auto-submit

# ריסט Expo
lsof -ti:8081 | xargs kill -9; npx expo start --ios --clear
```

---

## 2026-07-06 — Deep QA + תוכנית תיקונים (אישור משתמש לפני כל שלב)

### שיטת עבודה (הסכמה עם המשתמש)
- לתקן **אחד-אחד** לפי סדר עדיפות.
- **לשאול ולקבל אישור** לפני כל תיקון משמעותי.
- מטרה: **הכל רץ חלק בפרודקשן**; מה שלא ניתן לסדר בקוד — להחליט יחד (workaround / דחייה / build חדש).
- **אימות טלפון (OTP)** — עתידי, לא קריטי עכשיו (2026-07-06).

### תוצאות QA אוטומטי (2026-07-06)
| בדיקה | תוצאה |
|--------|--------|
| Backend unit tests | **30/30 PASS** |
| E2E API מקומי (`127.0.0.1:3001`) | **18/18 PASS** (signup→book→pay gate→complete) |
| E2E API פרודקשן (Render) | **FAIL** — email signup 410 |
| TypeScript mobile | **PASS** |
| Production `/health` | רק `{"status":"ok"}` — **קוד ישן**, אין `version` |

### פרודקשן Render — חוסם #1
- **URL:** https://ebikel-backend.onrender.com
- **Repo:** eBikeApps/ebikegrok, branch `main`, rootDir `backend`
- **Deploy hook:** `https://api.render.com/deploy/srv-d6nkoji4d50c7389lcpg?key=DhBm0ivgk7g`
- **קוד חדש מקומי:** `/health` → `version: 2026-07-06-email-signup-v2`, `emailSignUpEnabled: true`
- **פרודקשן חי:** `POST /api/auth/sign-up/email` → **410** `"Use Google or Apple"`
- **חובה ב-Render env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=job-photos`, `MOCK_PAYMENTS=false` (Grow מוגדר), **לא** `DISABLE_EMAIL_SIGNUP=true`

### מה עובד (ביטחון גבוה)
1. מחזור הזמנה מלא מקומית + payment gate (שולם לפני יציאה)
2. תיקון הזמנה רפאית (ghost completed order) — `active-job-sync`
3. order-details + orders מ-API
4. טכנאי: pending → אישור → tabs; היסטוריית jobs מ-API
5. role-select + technician-pending
6. Mock payments מקומי; Grow מוגדר ב-env

### באגים קריטיים בקוד (לתיקון)
| # | בעיה | קובץ | סטטוס |
|---|------|------|--------|
| P0-1 | Render לא מריץ קוד חדש | infra | ⏳ ממתין אישור |
| P0-2 | מיקום הזמנה = GPS לא כתובת | technician-select, repair-request | ✅ geocode מכתובת |
| P0-3 | לא ניתן להזמין בלי GPS | technician-select | ✅ לא דורש GPS |
| P1-1 | משיכת כספים — URL שגוי | withdrawal-request → `/api/payments/withdrawal-request` | ✅ |
| P1-2 | תיקון נוסף — מסך ללא כניסה | extra-repair + active-job | ✅ כפתור ב-in_progress |
| P1-3 | Push tap — רק job-tracking | `push-navigation.ts` + `_layout.tsx` | ✅ |
| P1-4 | Supabase על Render חסר | Render env | ⏳ |
| P2+ | קטגוריות orders, RTL, שגיאות שקטות, וכו' | ראה רשימה מלאה למטה | ⏳ |

### רשימת P2 (לא חוסם launch אבל חשוב)
- orders.tsx — תוויות קטגוריה ✅ parseJobCategories
- profile — התראות + שפה/RTL ✅
- job-tracking — מפה לפי כתובת job ✅
- chat — כפתור חזרה RTL ✅
- active-job — הזמנת טכנאי שיתופי ✅ invite-technician screen
- dashboard טכנאי — טלפון לפני accept ✅ backend מסנן pending
- unapproved tech accept job ✅ backend 403
- forgot-password — דחוי (OAuth בלבד לעכשיו)

### החלטות משתמש (2026-07-06 — אושר)
- [x] **סדר:** מתחילים ב-**P0-1 Render deploy**
- [x] **הרשמה:** **Google/Apple בלבד** לעכשיו — אימייל+סיסמה ו-OTP לא קריטי
- [x] **תשלומים:** עובר ל-**טרנזילה (Tranzila)** — חברה חדשה; צריך דוקומנטציה מהמשתמש להתאמת החיבור (כרגע בקוד: Grow/Meshulam)
- [x] **Build App Store:** **נחליט אחרי** שכל התיקונים עובדים

### לוג תיקונים (מעודכן בזמן עבודה)
| תאריך | תיקון | אושר? | סטטוס |
|-------|--------|-------|--------|
| 2026-07-06 | P0-1 Render deploy + env | ✅ | 🔄 המשתמש עושה Manual Deploy עכשיו |
| 2026-07-06 | Tranzila integration | ⏳ | דוקומנטציה יגיע בהמשך; בינתיים Grow/Mock |
| 2026-07-06 | P1-1 withdrawal URL | ✅ | תוקן בקוד |
| 2026-07-06 | P0-2+3 מיקום מכתובת + בלי GPS | ✅ | geocode + store |
| 2026-07-06 | Tranzila | ⏳ | **תזכורת למחר** — הרשמה + מילוי TRANZILA_TERMINAL ב-Render |

---

## 2026-07-07 — Handoff למחר: Tranzila + התחלת עבודה

**קרא את הסעיף הזה בתחילת הסשן מחר.**

### מצב production נכון לעכשיו (אומת 2026-07-06)
- **Backend:** https://ebikel-backend.onrender.com
- **Deploy live:** `c38d4bd` (+ env `GOOGLE_MAPS_API_KEY` הוגדר)
- **`/health`:** `version: 2026-07-06-tranzila-v1`, `paymentProvider: grow`, `tranzilaConfigured: false`
- **GitHub:** `eBikeApps/ebikegrok` branch `main`
- **Render service ID:** `srv-d6nkoji4d50c7389lcpg`
- **Render CLI:** מותקן + מחובר (workspace `tea-d6nkkiv5r7bs73dgk8vg`)

### מה כבר עובד ב-production (לא לגעת)
| תחום | סטטוס |
|------|--------|
| Deploy / שרת עולה | ✅ |
| Email sign-up + sign-in | ✅ |
| Google/Apple OAuth config | ✅ (לא נבדק E2E מהאפליקציה) |
| מספר סידורי `EB-XXXXXX` + `GET /api/jobs/by-number/:n` | ✅ |
| הזמנות נשמרות ב-DB (Prisma + Supabase) | ✅ אומת |
| Geocode כתובת → קואורדינטות | ✅ (`GOOGLE_MAPS_API_KEY` ב-Render) |
| טכנאי זמין בלבד (`isAvailable`) | ✅ |
| חסימת `on_way` לפני תשלום | ✅ HTTP 402 |
| תיקון נוסף (extra-repair) | ✅ הוסר |
| ניקוי 15 חשבונות QA | ✅ |
| Backend tests | ✅ 42/42 |
| tsc backend + mobile | ✅ |

### מה חוסם "להתחיל לעבוד" — רק תשלומים
- **Grow:** **הוסר לחלוטין** מהפרויקט ומ-Render (2026-07-07)
- **Tranzila:** **הוסר לחלוטין** מהפרויקט (2026-07-07) — סירבו לסליקה
- **ספק תשלומים נוכחי:** רק **Mock** (`mock-payments.ts`) עד חיבור PayPlus/אחר
- **Render:** `MOCK_PAYMENTS=true` (2026-07-08), deploy `0c34368`, version `2026-07-07-no-tranzila-v1`
- **eas.json production:** `EXPO_PUBLIC_MOCK_PAYMENTS=true` (לbuild עתידי — לא נבנה עדיין)
- **prisma db push:** רץ ב-`render-build.sh` — DB מסונכרן (`savedAddresses` קיים)
- **Git:** הכל committed + pushed ל-`eBikeApps/ebikegrok` main

### מחר — צעדים (בסדר)
1. **הרשמה ב-Tranzila** — קבל terminal name (+ אופציונלי App Key + Secret ל-handshake API)
2. **Render Environment** — הוסף:
   - `TRANZILA_TERMINAL` = שם הטרמינל (חובה)
   - `TRANZILA_APP_KEY` = אם נותנים (אופציונלי — ל-handshake)
   - `TRANZILA_SECRET` = אם נותנים (אופציונלי)
   - **לא** לשנות `MOCK_PAYMENTS` (נשאר `false`)
3. **Deploy** — `render deploys create srv-d6nkoji4d50c7389lcpg --wait --confirm`
4. **אימות `/health`:** `tranzilaConfigured: true`, `paymentProvider: "tranzila"`
5. **בדיקת תשלום E2E:**
   - לקוח יוצר הזמנה → טכנאי מקבל → `POST /api/payments/create` → מקבל `paymentUrl`
   - WebView `/payment` טוען דף Tranzila (bridge: `GET /api/payments/tranzila/checkout?token=...`)
   - Notify: `POST /api/payments/tranzila/notify`
   - אחרי תשלום: `paymentStatus=paid` → טכנאי יכול `on_way` → סיום
6. **אופציונלי:** build חדש לאפליקציה (שינויי mobile לא ב-App Store build הנוכחי)

### חשבונות בדיקה
| תפקיד | Email | Password |
|--------|-------|----------|
| לקוח | `a@abc.com` | `123456` |
| טכנאי | `tech-test@ebike.com` | `123456` |

### פקודות שימושיות (CLI מחובר)
```bash
render workspace set tea-d6nkkiv5r7bs73dgk8vg
render deploys create srv-d6nkoji4d50c7389lcpg --wait --confirm
render logs -r srv-d6nkoji4d50c7389lcpg --type app --limit 50 --confirm
curl -s https://ebikel-backend.onrender.com/health | python3 -m json.tool
QA_BACKEND_URL=https://ebikel-backend.onrender.com bun run qa/e2e-qa-flow.ts
```

### הוספת env ב-Render (API — עשינו כך היום)
```bash
curl -X PUT "https://api.render.com/v1/services/srv-d6nkoji4d50c7389lcpg/env-vars/TRANZILA_TERMINAL" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value":"TERMINAL_NAME"}'
```

### קבצי קוד רלוונטיים ל-Tranzila
- `backend/src/lib/tranzila.ts` — DirectNG iframe + notify
- `backend/src/routes/payments.ts` — create, checkout bridge, notify webhook
- `backend/src/lib/mock-payments.ts` — `getActivePaymentProvider()` בוחר tranzila
- `backend/tests/tranzila.test.ts` — 6 tests
- `mobile/src/app/payment.tsx` — WebView ל-paymentUrl

### מה לא לעשות
- **לא** להדליק `MOCK_PAYMENTS=true` ב-production
- **לא** לשחזר Grow — הוסר מהקוד
- **לא** לשחזר extra-repair (בוטל במכוון)
- **OAuth** — בדיקה ידנית אם צריך; email auth כבר עובד

### אחרי Tranzila עובד — Checklist "מוכן לעבודה"
- [ ] `POST /api/payments/create` מחזיר `paymentUrl` (לא 500)
- [ ] לקוח משלם → `paymentStatus=paid`
- [ ] טכנאי `on_way` אחרי תשלום → 200
- [ ] זרימה עד `completed` + review
- [ ] החלטה על build חדש ל-App Store / TestFlight
- [ ] בדיקת Google/Apple login מהאפליקציה (אם נדרש)

### הודעת פתיחה למחר מהמשתמש
> "בוא נחבר Tranzila" / "התחברתי לטרנזילה"

---

## 2026-07-06 (ערב) — Mobile polish + באג התנתקות + handoff למחר

**קרא את הסעיף הזה בתחילת הסשן הבא.** המשתמש אמר: *"מחר נוסיף תשלומים ונמשיך"*.

### סיכום מה עשינו היום (סשן polish)

#### Backend (שינויים מקומיים — **דורש deploy + `prisma db push`**)
- **תפקיד ברירת מחדל:** `customer` (לא `pending`) ב-`schema.prisma`
- **שינוי role:** רק admin דרך `PATCH /api/users/me`
- **כתובות שמורות:** שדה `savedAddresses` JSON על User + CRUD ב-`/api/users/me/addresses` (`backend/src/routes/addresses.ts`)
- **`PATCH /api/users/me`:** תומך `name`, `phone`
- **⚠️ לפני production:** `npx prisma db push` על Render אחרי deploy

#### Mobile — מיתוג ואימות
- שם אפליקציה אחיד: **eBike** (הוסר "eBike Land" / "E-Bike Land")
- **נמחק** `role-select.tsx` — כולם נרשמים כלקוח; טכנאי רק דרך admin
- `index.tsx`: טכנאי → tech tabs/pending; אחרים → customer tabs
- `sign-up.tsx` מעוצב כמו sign-in (רקע כהה, כפתורי social 3D, `AuthUi.tsx` משותף)
- RTL ב-footer של sign-up

#### Mobile — UI/UX (תיקונים שאושרו)
- **`ConfirmModal`:** מצב `alertOnly` לשגיאות; `confirm` ב-i18n = **"מאשר"**
- **תנאים/פרטיות:** טקסט מלא ב-`legal-content.ts`, מסך `/legal`, קישורים לחיצים
- **עריכת פרופיל:** `/edit-profile` (שם, טלפון)
- **כתובות שמורות:** API + `/saved-addresses` + בורר ב-`repair-request` שלב 3, שמירה אוטומטית אחרי geocode
- **הזמנות:** מצב שגיאת רשת + retry; תיקון צבע אייקון סטטוס (`iconColor` hex)
- **טכנאי jobs:** כל הסטטוסים לחיצים (כולל completed)
- **Tab bar:** אחיד (לקוח + טכנאי, safe area); טאב admin מוסתר (`href: null`)
- **Dark mode:** toggle בפרופיל לקוח + טכנאי (`useAppThemeStore`)
- **צבעים:** `brand-colors.ts` — כחול `#3B82F6` לפעולות, ירוק `#10B981` למותג/הכנסות; הוסר סגול `#8B5CF6` מ-FAB, repair-request, technician-select, job-complete
- **job-tracking refactor:** תת-מסכים ב-`mobile/src/components/job-tracking/` (~1071 שורות בקובץ הראשי)

#### באג דחוף שתוקן בסוף היום — מודל התנתקות
- **תסמין:** בלחיצה על התנתקות נראה רק "ביטול"; כפתור אישור בלתי נראה מעל (אבל לחיץ)
- **סיבה:** `ConfirmModal` במצב `centered` — רקע + אנימציית `FadeIn` כפולה חיבתו את כפתור האישור האדום
- **תיקון:** `mobile/src/components/ConfirmModal.tsx` — רקע מאחור, כרטיס `zIndex` מלפנים, כפתורים **ביטול | מאשר** בשורה; `confirmText={t('confirm')}` בפרופיל לקוח וטכנאי
- **tsc:** עובר אחרי התיקון

#### קבצים חדשים חשובים
- `mobile/src/components/auth/AuthUi.tsx`
- `mobile/src/lib/brand-colors.ts`, `theme-colors.ts`, `typography.ts`, `legal-content.ts`, `saved-addresses-api.ts`
- `mobile/src/app/legal.tsx`, `edit-profile.tsx`, `saved-addresses.tsx`
- `mobile/src/components/job-tracking/*`
- `mobile/src/components/KeyboardDoneToolbar.tsx`
- `backend/src/routes/addresses.ts`

#### החלטות משתמש (audit UI — לא לשנות בלי אישור)
| # | נושא | החלטה |
|---|------|--------|
| 3 | שפה | עברית בלבד לעכשיו — OK |
| 6 | אייקון סטטוס | תוקן |
| 9 | עיצוב | שמירה על dual light/dark cinematic |
| 10 | צבעים | הוחל recommendation |
| 12 | מפות | דחוי |
| 19 | skeleton loaders | לא עכשיו |
| 21 | modal patterns | להשאיר |
| 23 | refactor job-tracking | בוצע |
| 28 | build חדש | **אחרי Tranzila** |

#### מה **לא** נגענו / דחוי למחר
- **Tranzila תשלומים** — המשימה העיקרית למחר (ראה סעיף 2026-07-07 למעלה)
- `prisma db push` ל-`savedAddresses` ב-Render
- i18n אנגלית למסכים עם עברית קשיחה (job-tracking, payment, chat)
- איחוד מפות
- Tranzila: `TRANZILA_TERMINAL` ב-Render + E2E תשלום

### מצב git (לא committed — 2026-07-06 ערב)
שינויים רבים ב-mobile + backend **לא committed**. **לא לcommit:** `mobile/typescript` (קובץ זבל). `MEMORY.MD` — כן לעדכן.

### חשבונות בדיקה (ללא שינוי)
| תפקיד | Email | Password |
|--------|-------|----------|
| לקוח | `a@abc.com` | `123456` |
| טכנאי | `tech-test@ebike.com` | `123456` |

### סדר עבודה למחר (כשהמשתמש חוזר)
1. **Tranzila** — הרשמה + `TRANZILA_TERMINAL` (ואופציונלי App Key/Secret) ב-Render → deploy → `/health` עם `tranzilaConfigured: true`
2. **E2E תשלום** — הזמנה → accept → pay → on_way → complete
3. **`prisma db push`** על Render לכתובות שמורות (אם deploy backend מהיום)
4. **build חדש** לאפליקציה אחרי שתשלומים עובדים
5. המשך polish לפי צורך (אחרי תשלומים)

### הודעת פתיחה צפויה מהמשתמש
> "בוא נוסיף תשלומים" / "בוא נחבר Tranzila" / "המשך מאתמול"

Last updated: 2026-07-06 (evening) — Mobile polish session + sign-out modal fix + handoff for Tranzila tomorrow.

---

## 2026-07-09 — זמינות טכנאים, UX לקוח, תשלומי mock, build iOS

**קרא את הסעיף הזה בתחילת הסשן הבא.** המשתמש אמר: *"נמשיך מחר שוב"*.

### מה עשינו היום

#### 1. באג אלביס — זמין בטלפון, לא נראה ללקוח
- **סיבה:** `isAvailable: false` בשרת (cron אחרי 45 דק' בלי heartbeat); האפליקציה שמרה `true` מקומית; `syncAvailabilityFromServer` משך `false` מהשרת
- **תיקון DB מיידי:** אלביס (`maort@ebike.com`) עודכן ל-`isAvailable: true` + `lastSeenAt` עדכני
- **קוד חדש:** `mobile/src/lib/technician-availability-sync.ts` — `reassertTechnicianAvailability()`
- **`mobile/src/app/(technician)/(tabs)/index.tsx`:** דוחף זמינות לשרת בפתיחה/חזרה מרקע; הוסר `syncAvailabilityFromServer`
- **`backend/src/routes/technicians.ts`:** רדיוס מינימלי 40km ב-`/available`
- **Render `/health`:** `mockPayments: true` — פרודקשן כבר mock

#### 2. לקוח קופץ למסך הבית אחרי בחירת טכנאי
- **סיבה:** `job-tracking` קרא לשרת; כשלון → `goHomeAfterCompletion()`
- **תיקון:** `mobile/src/lib/active-job-sync.ts` — retry, גיבוי מ-job מקומי, `shouldSkipCompletionScreen` רק להזמנות שהושלמו
- **`technician-select.tsx`:** ניווט מיידי למעקב (בלי delay 1.2s)

#### 3. אייקון גדול להזמנה פעילה במסך הבית (לקוח)
- **`mobile/src/app/(customer)/(tabs)/index.tsx`:** כרטיס `ActiveJobHeroCard` עם אייקון מפתח גדול, פעימה, סטטוס, מספר הזמנה
- polling כל 12 שניות — נעלם כשהטכנאי מבטל / ההזמנה מסתיימת
- כפתור "הזמן תיקון" מוסתר כשיש הזמנה פעילה

#### 4. תשלומים פיקטיביים לבדיקה
- **`mobile/src/lib/mock-payments.ts`:** `isMockPaymentsEnabled()`, `normalizePaymentUrl()`
- כפתור **"תשלום מיידי ללא כרטיס"** מוצג במצב mock (לפני היה מוסתר!)
- **`payment.tsx`:** אחרי תשלום → חזרה ל-`job-tracking?paid=1` (לא למסך הבית)
- **`backend/.env`:** `BACKEND_URL=http://127.0.0.1:3001` (תיקון WebView מקומי)
- **`eas.json` + `.env`:** `EXPO_PUBLIC_MOCK_PAYMENTS=true`, `EXPO_PUBLIC_ENABLE_DEV_SIMULATE_PAY=true`

#### 5. Build iOS 1.7.1 (build 20)
- **Build הצליח:** `a30166f8-c8ed-40d1-a631-1a3e929efcab`
- **העלאה ל-App Store נכשלה:** חסר חתימה על הסכם ב-[developer.apple.com](https://developer.apple.com) → Agreements, Tax, and Banking
- **⚠️ Build 20 נבנה מ-commit ישן** (`9b1f1e9`) — **בלי** כל התיקונים של היום
- **צריך build 21** אחרי commit + חתימת הסכם Apple

### מצב git (לא committed — 2026-07-09)
רוב השינויים **מקומיים בלבד**. **לא לcommit:** `mobile/typescript` (זבל).

### חשבונות / סביבה
| | |
|---|---|
| לקוח בדיקה | `a@abc.com` / `123456` |
| טכנאי אלביס | `maort@ebike.com` |
| Backend prod | `https://ebikel-backend.onrender.com` |
| Backend local | `http://127.0.0.1:3001` |
| Supabase DB | pooler port **6543** + `?pgbouncer=true` |

### סדר עבודה למחר
1. **חתימת הסכם Apple** → שליחת build 21 ל-App Store
2. **Commit + push** כל השינויים המקומיים
3. **Build 21** עם תיקוני זמינות + מעקב + תשלומי mock + כרטיס הזמנה פעילה
4. **Deploy backend** ל-Render (רדיוס 40km + שינויי payments אם יש)
5. **בדיקת E2E:** הזמנה → accept → תשלום mock → on_way → complete
6. אלביס: לוודא שאחרי build חדש הזמינות מסתנכרנת אוטומטית

### הודעת פתיחה צפויה
> "נמשיך מאתמול" / "תעלה build" / "תבדוק תשלומים"

Last updated: 2026-07-09 — availability sync, job tracking fix, active job hero, mock payments, iOS build 20 done / submit blocked.