# 🔬 דוח QA מקצועי - גרסה 2 (Enterprise-Grade)
**רמת בדיקה: $50,000 — 4 צוותי QA מומחים במקביל**
**תאריך:** 2026-05-11
**מתודולוגיה:** File-by-file code audit + flow tracing + threat modeling
**Quality Score: 3.8/10** (ירד מ-4.5 לאחר ניתוח עמוק יותר)

---

## 📊 סיכום מנהלים

| תחום | באגים שנמצאו | קריטי | גבוה | בינוני | נמוך |
|------|-------------|------|------|--------|------|
| Customer Flow | 25 | 4 | 7 | 11 | 3 |
| Technician Flow | 25 | 4 | 8 | 11 | 2 |
| Backend Security | 30 | 7 | 13 | 9 | 1 |
| UX/RTL/A11y | 38 | 8 | 14 | 13 | 3 |
| **סה"כ** | **118** | **23** | **42** | **44** | **9** |

**שינוי מהאודיט הקודם:** 25 באגים חדשים שלא זוהו, כולל פגיעויות אבטחה קריטיות (Path traversal, SVG XSS, Webhook double-spend).

---

## 🚨 TOP 10 BLOCKERS - חייבים תיקון לפני production

| דירוג | מזהה | תיאור | סיכון |
|------|------|------|------|
| #1 | B14 | Path Traversal ב-uploads | קריאת קבצים רגישים |
| #2 | B13 | SVG XSS דרך file upload | Stored XSS |
| #3 | B12 | אין size limit ל-upload | DoS - disk full |
| #4 | B02 | Webhook double-spend | חיוב כפול ללקוח |
| #5 | B06 | TOCTOU במשיכת כספים | תשלום > יתרה |
| #6 | B07 | callOutFee > half = יתרה שלילית | חוב טכנאי ראשי |
| #7 | T10 | סיום עבודה ללא הגעה | הונאה כלפי לקוח |
| #8 | T18 | דילוג ל-in_progress | חיוב על שלא בוצע |
| #9 | C03 | crash על phone null | פונקציית call לא עובדת |
| #10 | C08 | Double-tap = double order | יצירת עבודה כפולה |

---

# 🔴 חלק 1: באגים קריטיים (23)

## A. Backend Security (7 critical)

### B02 [CRITICAL] Webhook Double-Spend - TOCTOU
**File:** `backend/src/routes/payments.ts:151-276`
**Bug:** הבדיקה אם תשלום כבר עובד היא לפני העדכון. שני webhooks במקביל יראו `status="pending"` ושניהם יעדכנו.
**Attack:**
```
T0: Webhook A מגיע → קורא status=pending
T0+5ms: Webhook B (retry של Grow) מגיע → קורא status=pending
T0+10ms: Webhook A מעדכן status=paid + יוצר עסקה
T0+15ms: Webhook B מעדכן status=paid + יוצר עסקה (כפילות!)
```
**Impact:** טכנאי משולם פעמיים, הכנסה מסתכמת לכפול.
**Fix:**
```typescript
await prisma.$transaction(async (tx) => {
  const updated = await tx.extraRepairRequest.updateMany({
    where: { id: cField1, status: "pending" },
    data: { status: "paid", growTransactionCode: transactionCode, paidAt: new Date() }
  });
  if (updated.count === 0) return; // already processed
  // ... create transaction, send push
}, { isolationLevel: "Serializable" });
```

---

### B06 [CRITICAL] TOCTOU במשיכת כספים — יתרה שלילית
**File:** `backend/src/routes/payments.ts:407-422`
**Bug:** בין בדיקת balance ל-`prisma.transaction.create` יש חלון מירוץ.
**Attack:**
```
טכנאי: balance=₪1000
Req1: בודק balance → 1000, מאשר ₪800
Req2 (פרלל): בודק balance → 1000, מאשר ₪800
תוצאה: ₪1600 נמשכו במקום ₪800
```
**Impact:** הפסד כספי ישיר לעסק.
**Fix:**
```typescript
await prisma.$transaction(async (tx) => {
  const [earned, withdrawn] = await Promise.all([
    tx.transaction.aggregate({ where: { technicianId: user.id, type: "earning", status: "completed" }, _sum: { amount: true }}),
    tx.transaction.aggregate({ where: { technicianId: user.id, type: "withdrawal", status: { in: ["completed", "pending"] }}, _sum: { amount: true }}),
  ]);
  const balance = (earned._sum.amount ?? 0) - (withdrawn._sum.amount ?? 0);
  if (amountNum > balance) throw new Error("Insufficient balance");
  await tx.transaction.create({ data: { ... }});
}, { isolationLevel: "Serializable" });
```

---

### B07 [CRITICAL] callOutFee > half = חיוב שלילי
**File:** `backend/src/routes/jobs.ts:449-474`
**Bug:** `primaryEarning = half - callOutFee` יכול להיות שלילי.
**Attack:** טכנאי משני מגדיר callOutFee=₪10000, מוזמן לעבודה של ₪100. טכנאי ראשי מקבל ₪-9950.
**Impact:** טכנאי ראשי נכנס לחוב, תוקף יכול לנצל לחבל.
**Fix:**
```typescript
const callOutFee = Math.min(secondaryTech?.callOutFee ?? 50, half);
const primaryEarning = Math.max(0, half - callOutFee);
const secondaryEarning = price - primaryEarning;
```

---

### B12 [CRITICAL] אין הגבלת גודל ל-image upload
**File:** `backend/src/routes/uploads.ts:17-45`
**Attack:** שליחת 100MB base64 × 10 בקשות = DoS על דיסק.
**Fix:**
```typescript
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
if (buffer.length > MAX_SIZE) {
  return c.json({ error: "File too large" }, 413);
}
```

---

### B13 [CRITICAL] SVG XSS דרך file upload
**File:** `backend/src/routes/uploads.ts:17-45`
**Attack:** העלאת `<svg><script>fetch('/api/jobs/STEAL',{...})</script></svg>` עם `mimeType=image/svg+xml`. כשמשרתים את הקובץ - הדפדפן מריץ JS.
**Fix:**
```typescript
const SAFE_MIMES = ["image/jpeg", "image/png", "image/webp"];
if (!SAFE_MIMES.includes(mimeType)) {
  return c.json({ error: "Only JPEG/PNG/WebP allowed" }, 400);
}
```

---

### B14 [CRITICAL] Path Traversal בשרת קבצים
**File:** `backend/src/routes/uploads.ts:47-80`
**Bug:** הבדיקה `filename.includes("..")` נכשלת מול `..%2F` או null byte.
**Attack:** `GET /api/uploads/..%2F..%2Fetc%2Fpasswd`
**Fix:**
```typescript
import path from "node:path";
const safe = path.basename(filename);
const full = path.join(UPLOADS_DIR, safe);
if (!full.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
  return c.json({ error: "Invalid path" }, 400);
}
```

---

### B15 [CRITICAL] CSRF מבוטל גלובלית
**File:** `backend/src/auth.ts:102`
**Bug:** `disableCSRFCheck: true` - אתר זדוני יכול לבצע פעולות עבור משתמש מחובר.
**Fix:** עם trustedOrigins מוגדר אפשר להפעיל. דורש בדיקת רגרסיה במובייל.

---

## B. Customer Flow (4 critical)

### C01 [CRITICAL] Stale closure ב-polling של job-tracking
**File:** `mobile/src/app/job-tracking.tsx:377-428`
**Bug:** `pollJobStatus` לא כולל `activeJob` ב-deps. closure תופס activeJob ישן.
**Impact:** עדכוני סטטוס מפוספסים או מטופלים על state ישן.
**Fix:** `}, [params.id, activeJob?.status]);`

---

### C02 [CRITICAL] setInterval לא מנוקה אחרי unmount
**File:** `mobile/src/app/job-tracking.tsx:423-428`
**Bug:** state updates על קומפוננטה לא-mounted, memory leak.
**Fix:**
```typescript
useEffect(() => {
  let active = true;
  const interval = setInterval(() => { if (active) pollJobStatus(); }, 3000);
  return () => { active = false; clearInterval(interval); };
}, [params.id]);
```

---

### C03 [CRITICAL] קריסה ב-handleCall כש-phone null
**File:** `mobile/src/app/job-tracking.tsx:439-443`
**Bug:** `Linking.openURL` עם undefined.
**Fix:**
```typescript
if (!activeJob?.technician?.phone) {
  Alert.alert(isRTL ? 'אין מספר טלפון זמין' : 'No phone available');
  return;
}
Linking.openURL(`tel:${activeJob.technician.phone}`);
```

---

### C08 [CRITICAL] Double-tap = double order
**File:** `mobile/src/app/technician-select.tsx:123-205`
**Bug:** אין הגנה מפני clicks חוזרים לפני שמופעל loading.
**Fix:** `if (bookingLoading) return;` בתחילת `handleConfirmBooking`.

---

## C. Technician Flow (4 critical)

### T01 [CRITICAL] location tracking נעצר ברקע
**File:** `mobile/src/app/(technician)/(tabs)/index.tsx:58-70`
**Bug:** interval נעצר באפליקציה ברקע, לא מתחדש בחזרה.
**Fix:** שימוש ב-`expo-task-manager` + `Location.startLocationUpdatesAsync` עם background permission.

---

### T02 [CRITICAL] קבלת עבודה כפולה משני טכנאים
**File:** `mobile/src/app/(technician)/(tabs)/index.tsx:289-332` + `backend/src/routes/jobs.ts:373-380`
**Bug:** הבאג הזה תוקן בbackend ב-S02 אבל ה-UI לא מטפל ב-409 conflict.
**Fix:** בצד הלקוח, על שגיאת 409:
```typescript
if (err?.status === 409 || err?.message?.includes('כבר נלקחה')) {
  Alert.alert(t('jobTaken'));
  refreshJobs();
}
```

---

### T10 [CRITICAL] סיום עבודה מבלי להגיע
**File:** `mobile/src/app/(technician)/active-job.tsx:861-884`
**Bug:** ניתן ללחוץ "סיים עבודה" ב-status=accepted בלי לעבור arrived/in_progress.
**Impact:** וקטור הונאה - חיוב לקוח על שירות שלא בוצע.
**Fix:**
```typescript
const canComplete = job.status === 'in_progress';
<Pressable
  onPress={handleComplete}
  disabled={!canComplete}
  className={cn(!canComplete && 'opacity-50')}
>
```

---

### T18 [CRITICAL] דילוג מ-on_way ל-in_progress
**File:** `mobile/src/app/(technician)/active-job.tsx:494-508`
**Bug:** אין enforcement של רצף סטטוסים בצד client.
**Note:** ה-backend עושה validation (`validTransitions`), אבל ה-UX מבלבל - הכפתור מציע מעבר לא חוקי.
**Fix:** הצג רק את הסטטוס הבא החוקי לפי הטבלה.

---

## D. UX Critical (8 critical)

### U01 [CRITICAL] Alert.alert במקום custom modals
**Files:**
- `mobile/src/app/repair-request.tsx:73, 127`
- `mobile/src/app/(customer)/(tabs)/profile.tsx:100, 137`
- `mobile/src/app/(technician)/(tabs)/admin.tsx:93, 107, 121, 150, 168, 187`
- `mobile/src/app/withdrawal-request.tsx:257`
**Impact:** Native Alert לא מותאם RTL, אין אנימציות, שובר branding.
**Fix:** קומפוננטה `<ConfirmModal>` משותפת.

---

### U02 [CRITICAL] TouchableOpacity במקום Pressable
**Files:**
- `mobile/src/app/sign-in.tsx:535, 518, 558, 6`
**Note:** CLAUDE.md דורש Pressable.
**Fix:** החלפה גורפת.

---

### U04-U05 [CRITICAL] טקסטים בעברית hardcoded
**Files:**
- `mobile/src/app/repair-request.tsx:212-213, 312, 371-372, 423, 449, 513, 529, 536`
- `mobile/src/app/technician-select.tsx:223, 232-235, 367-368, 468, 484`
**Impact:** משבר i18n - לא ניתן להציג באנגלית.
**Fix:** העברה מאסיבית ל-`src/lib/i18n/index.ts`.

---

### U07 [CRITICAL] flexDirection לא מותאם RTL
**File:** `mobile/src/app/sign-in.tsx:120-121`
**Fix:** `flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'`

---

### U10 [CRITICAL] Alert.alert ב-admin
**File:** `mobile/src/app/(technician)/(tabs)/admin.tsx`
**Fix:** Custom confirmation modal.

---

### U23 [CRITICAL] Hebrew strings בקטגוריות שירות
**File:** `mobile/src/app/technician-select.tsx:223-235`
**Bug:** Map מקודד עברית-לעברית. אם משתמש באנגלית - יראה עברית.
**Fix:** העברה ל-i18n.

---

### U37 [CRITICAL] hardcoded phone במחרוזת שגיאה
**File:** `mobile/src/app/withdrawal-request.tsx:257`
**Bug:** "058-585-8586" hardcoded.
**Fix:** `process.env.EXPO_PUBLIC_SUPPORT_PHONE`.

---

# 🟠 חלק 2: באגים בעדיפות גבוהה (42)

## Backend Security (13)

| # | File:Line | תיאור | תיקון מומלץ |
|---|-----------|------|------------|
| B01 | `index.ts:267-270` | User enumeration ב-forgot-password (404 vs 200) | תמיד החזר 200 |
| B03 | `jobs.ts:373-380` | Race condition משני - לוודא lock גם ב-fallthrough path | Serializable txn |
| B04 | `index.ts:163` | Sign-up ללא rate limiting | 3 בקשות/שעה לפי IP |
| B05 | `payments.ts:151-152` | Webhook ניתן לזיוף אם transactionCode מנוחש | HMAC או IP whitelist |
| B08 | `jobs.ts:278-305` | מספר טלפון של לקוח חשוף ב-pending jobs לטכנאי | להסיר phone מ-select |
| B09 | `reviews.ts:79-97` | אין auth check על GET reviews | הוספת `c.get("user")` |
| B10 | `payments.ts:392-438` | אין Zod על withdrawal-request | `zValidator("json", schema)` |
| B11 | `payments.ts:326-390` | אין Zod על extra-repair, `Number()` על NaN | `z.number().min(50)` |
| B16 | `index.ts:38-62` | אין session expiry מוגדר | `sessionExpiresIn: 7 * 86400` |
| B17 | אין endpoint | אין revocation לטוקנים שדלפו | טבלת `revokedSessions` |
| B18 | logs | PII בלוגים (אימייל, טלפון) | logger sanitizer |
| B19 | `payments.ts:376-378` | paymentUrl + amount ב-push notification data | מינימום data, fetch בצד client |
| B22 | `contact.ts:29` | אין rate limit על contact form (spam) | 5 בקשות/שעה |

---

## Customer Flow (7)

| # | File:Line | תיאור |
|---|-----------|------|
| C04 | `job-tracking.tsx:117-140` | setTimeout באנימציה לא נוקה ב-unmount |
| C05 | `technician-select.tsx:249` | מספר תמיכה hardcoded בקוד הקליינט |
| C06 | `technician-select.tsx:108-121` | אין size limit לתמונה לפני base64 |
| C07 | `technician-select.tsx:75` | dependency missing ב-useEffect (t) |
| C09 | `technician-select.tsx:139-146` | photo upload נכשל, אבל job נוצר עם photoUrl:null |
| C10 | `chat.tsx:98-101` | interval ב-chat ממשיך אחרי navigate back |
| C11 | `chat.tsx:103-129` | `catch {}` ריק - הודעה נעלמת ללא error |

---

## Technician Flow (8)

| # | File:Line | תיאור |
|---|-----------|------|
| T03 | `(technician)/(tabs)/index.tsx:115-171` | אין timeout על job offer (תקוע ל-24h+) |
| T04 | `(technician)/(tabs)/index.tsx:208-212` | polling 3 שניות = battery drain |
| T05 | `(technician)/(tabs)/index.tsx:275-287` | isAvailable לא מסונכרן אם API נכשל |
| T07 | `withdrawal-request.tsx:70` | אין max withdrawal limit, מקבל float |
| T08 | `withdrawal-request.tsx:74-75` | bank validation רופפת (לא 9 ספרות) |
| T11 | `(technician)/active-job.tsx:232-233` | parts price יכול להיות שלילי |
| T13 | `(technician)/active-job.tsx:212-366` | אין compression לתמונות completion |
| T15 | `(technician)/(tabs)/index.tsx:115-171` | אין fallback אם push notification חוסם |
| T17 | `(technician)/(tabs)/earnings.tsx:53-61` | סטטוס pending לא מוצג למשיכות |

---

## UX (14)

| # | File:Line | תיאור |
|---|-----------|------|
| U03 | `technician-select.tsx:514`, `submit-review.tsx:275` | אין disabled+loading על submit |
| U06 | `sign-in.tsx:391-430` | שגיאות hardcoded בעברית בlogic |
| U08 | `sign-in.tsx:131` | marginHorizontal hardcoded ללא marginStart/End |
| U09 | `sign-in.tsx:160` | textAlign:"right" hardcoded |
| U11 | `(customer)/(tabs)/profile.tsx:100, 137` | Alert.alert במחיקת חשבון |
| U12 | `(technician)/(tabs)/index.tsx:312, 329` | accept button ללא disabled state |
| U14 | `(customer)/(tabs)/orders.tsx:211, 245` | contrast text-gray-400 על gray-50 (4:1, AA fail) |
| U17 | `repair-request.tsx:225` | touch target 32px (מינ' 44px) |
| U18 | `sign-in.tsx:172` | hitSlop קטן על password toggle |
| U20 | `(customer)/(tabs)/index.tsx:381` | avatar בלי placeholder/fallback |
| U26 | `chat.tsx:290, 307` | chat bubbles בלי RTL flex |
| U27 | `(customer)/(tabs)/index.tsx:391` | אין accessibilityLabel |
| U30 | `technician-select.tsx:461` | אין animations ב-press transitions |
| U34 | `technician-select.tsx:468, 484` | טקסט modal hardcoded |

---

# 🟡 חלק 3: באגים בעדיפות בינונית (44)

מפורטים בקטגוריות:
- **Backend (9):** B20 (mass assignment latent), B23 (unique constraint על invitations), B24-B25 (notifications חסרות), B27 (commission rate validation), B28-B30 (rate limit מורחב)
- **Customer (11):** C12-C16 (null avatars, stale data, payment state, empty list i18n, phone format)
- **Technician (11):** T06 (negative balance theoretical), T09 (account holder length), T12 (double-tap), T14 (multiple active jobs), T16 (final_price=0), T19-T20 (i18n in errors, Maps fallback), T22-T23 (cleanup, parts validation)
- **UX (13):** U13 (empty states), U15-U16 (KeyboardAvoidingView), U19 (yellow contrast), U21 (image loading), U22 (font sizes), U25 (number locale), U28-U29 (a11y roles), U31 (emoji icons), U32 (textAlign), U35 (disabled clarity), U38 (toLocaleString locale)

---

# 🟢 חלק 4: באגים בעדיפות נמוכה (9)

- **C22-C25:** RTL nits, sign-in label position
- **T21, T24:** Password mismatch, RTL numeric fields
- **U22, U31, U36:** Font size inconsistency, emoji vs lucide, button height

---

# 🛠️ תוכנית עבודה מומלצת

## Sprint 1 (3-5 ימים): Production Blockers
1. **B14** - Path traversal (30 דק')
2. **B13** - SVG XSS (15 דק')
3. **B12** - Upload size limit (15 דק')
4. **B02** - Webhook idempotency (1 שעה)
5. **B06** - Withdrawal TOCTOU (1 שעה)
6. **B07** - callOutFee clamping (15 דק')
7. **T10/T18** - Status sequence enforcement (1 שעה)
8. **C01/C02/C03** - Memory leaks + null crashes (1 שעה)
9. **C08** - Double-tap protection (15 דק')

## Sprint 2 (1 שבוע): Hardening
10. **B04** - Rate limiting על signup
11. **B08** - הסתרת phone ב-pending jobs
12. **B16-B17** - Session expiry + revocation
13. **U01** - Custom modal infrastructure
14. **U04/U05/U23** - i18n migration
15. **U07/U09** - RTL infrastructure

## Sprint 3 (1 שבוע): UX Polish
16. כל ה-HIGH UX
17. Empty states
18. KeyboardAvoidingView
19. Accessibility labels

## Sprint 4 (3 ימים): Medium + Low
20. כל ה-MEDIUM
21. Regression testing

---

# 📈 ציוני איכות מעודכנים

| תחום | ציון V1 | ציון V2 | שינוי |
|------|---------|---------|------|
| Security | 3/10 | 2/10 | ⬇️ (נמצאו path traversal, XSS) |
| Performance | 5/10 | 4/10 | ⬇️ (polling אגרסיבי, memory leaks) |
| UX/Design | 5/10 | 4/10 | ⬇️ (Hebrew hardcoded, no a11y) |
| Code Quality | 6/10 | 5/10 | ⬇️ (stale closures, no error UI) |
| Reliability | 4/10 | 4/10 | ➡️ |
| Accessibility | 2/10 | 2/10 | ➡️ |
| **ממוצע** | **4.5/10** | **3.5/10** | ⬇️ |

---

# 🎯 המלצה מיידית

**אל תשחרר לproduction לפני תיקון 10 ה-blockers.**

Path traversal + XSS = פגיעות אבטחה רצינית. Webhook double-spend + TOCTOU = הפסד כספי ישיר. Status skip = הונאה כלפי לקוחות.

**מתחיל מיד בתיקון לפי הסדר.**
