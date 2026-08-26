import { Language } from './i18n';

export type LegalDocType = 'terms' | 'privacy' | 'cancellation';

const UPDATED = '18 באוגוסט 2026';
const UPDATED_EN = 'August 18, 2026';
const COMPANY_HE = 'eBike Land';
const COMPANY_EN = 'eBike Land';
const SITE = 'https://www.ebikel.com';
const EMAIL = 'support@ebikel.com';
const SUPPORT_PHONE = '+972-58-585-8586';

const termsHe = `תנאי שימוש — אפליקציית eBike
עודכן לאחרונה: ${UPDATED}

1. מי אנחנו
אפליקציית eBike ("האפליקציה") מופעלת על ידי ${COMPANY_HE} ("החברה", "אנחנו").
אתר: ${SITE}
יצירת קשר: ${EMAIL}

השימוש באפליקציה מהווה הסכמה לתנאים אלה ולמדיניות הפרטיות. אם אינך מסכים — אין להשתמש בשירות.

2. השירות
האפליקציה היא פלטפורמת תיווך: היא מקשרת בין לקוחות הזקוקים לתיקון אופניים חשמליים (או כלי רכיבה דומה) לבין טכנאים עצמאיים.
החברה אינה ספק התיקון, אינה מעסיקה את הטכנאים כעובדים לצורך ביצוע העבודה אצל הלקוח, ואינה אחראית לטיב העבודה בפועל. האחריות לביצוע התיקון מוטלת על הטכנאי, בכפוף לדיני הגנת הצרכן החלים.

3. הרשמה וחשבון
• ניתן להירשם באימייל וסיסמה, או באמצעות Google או Sign in with Apple.
• כל משתמש נרשם תחילה כלקוח. מעבר לתפקיד טכנאי נעשה באישור מנהל בלבד.
• עליך למסור פרטים נכונים ולשמור על סודיות פרטי ההתחברות.
• אסור ליצור חשבונות מזויפים, להתחזות, או להשתמש בחשבון של אדם אחר.
• ניתן למחוק את החשבון בכל עת ממסך הפרופיל באפליקציה.

4. הזמנות, מחירים ותשלומים
• לפני ההזמנה מוצג טווח מחיר משוער. המחיר הסופי עשוי להיקבע לאחר בדיקת הטכנאי, כולל תוספות שאושרו על ידך באפליקציה.
• החברה עשויה לגבות עמלה מהעסקה. הסכום שאתה משלם הוא המחיר שמוצג לך לפני התשלום.
• התשלום מעובד אצל ספק סליקה חיצוני (כיום PayMe). איננו שומרים מספר כרטיס אשראי מלא.
• עד שהסליקה האמיתית פעילה בשרת, ייתכן שיוצג מסלול תשלום לבדיקות פנימיות בלבד. בחנות הציבורית התשלום אמור להתבצע רק דרך ספק הסליקה.
• ביטול, החזר ותשלום נוסף — לפי "מדיניות ביטול והחזרים".

5. התנהגות
אסור: הטרדה, הונאה, שימוש לרעה, תוכן פוגעני, פגיעה בטכנאי או בלקוח, או כל פעולה בניגוד לדיני מדינת ישראל.

6. אחריות
השירות ניתן כמות שהוא (AS IS), במאמץ סביר להפעלה תקינה.
החברה לא אחראית לנזקים עקיפים או לאובדן רווחים, ולא לנזק שנגרם מביצוע עבודת הטכנאי — והכול בכפוף לחוק הגנת הצרכן ולכל דין שלא ניתן להתנות עליו.

7. קניין רוחני
האפליקציה, העיצוב והמותג eBike שייכים לחברה. אין להעתיק או להשתמש בהם בלי אישור.

8. שינויים
נוכל לעדכן תנאים אלה. תאריך העדכון יופיע בראש המסמך. המשך שימוש לאחר עדכון מהווה הסכמה לנוסח המעודכן.

9. דין וסמכות שיפוט
הדין החל: דיני מדינת ישראל. סמכות השיפוט: בתי המשפט המוסמכים בישראל.

10. יצירת קשר
${EMAIL}
${SITE}`;

const termsEn = `Terms of Service — eBike App
Last updated: ${UPDATED_EN}

1. Who we are
The eBike app ("App") is operated by ${COMPANY_EN} ("we", "Company").
Website: ${SITE}
Contact: ${EMAIL}

Using the App means you agree to these Terms and to the Privacy Policy. If you do not agree, do not use the service.

2. The service
The App is a marketplace. It connects customers who need e-bike (or similar) repairs with independent technicians.
We are not the repair provider and do not perform the on-site work. The technician is responsible for the work, subject to mandatory Israeli consumer-protection law.

3. Accounts
• You may sign up with email and password, or with Google or Sign in with Apple.
• Everyone starts as a customer. Technician access requires administrator approval.
• Provide accurate details and keep your login credentials confidential.
• Fake accounts, impersonation, and use of someone else's account are prohibited.
• You may delete your account at any time from the in-app profile.

4. Orders, prices and payments
• An estimated price range is shown before booking. The final price may be set after inspection, including extra work you approve in the App.
• We may charge a commission. You pay the amount shown to you before checkout.
• Payments are processed by an external payment provider (currently PayMe). We do not store full card numbers.
• Until live checkout is enabled on the server, an internal test path may exist. The public store build is intended to charge only through the payment provider.
• Cancellation, refunds and extra charges follow the Cancellation & Refund Policy.

5. Conduct
No harassment, fraud, abuse, harmful content, or any use that violates Israeli law.

6. Liability
The service is provided "as is", with reasonable efforts to keep it working.
We are not liable for indirect damages or lost profits, or for damage caused by the technician's work — except where Israeli consumer-protection law or other mandatory law does not allow that limit.

7. Intellectual property
The App, design and eBike brand belong to the Company. Do not copy or use them without permission.

8. Changes
We may update these Terms. The update date appears at the top. Continued use after an update means you accept the new version.

9. Governing law
These Terms are governed by the laws of the State of Israel. Courts in Israel have jurisdiction.

10. Contact
${EMAIL}
${SITE}`;

const privacyHe = `מדיניות פרטיות — אפליקציית eBike
עודכן לאחרונה: ${UPDATED}

1. מי אחראי למידע
האחראי לעיבוד המידע: ${COMPANY_HE}
אתר: ${SITE}
פניות בנושא פרטיות: ${EMAIL}

מדיניות זו חלה על שימוש באפליקציית eBike. היא נכתבה בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, ולתיקונים החלים עליו, ובכפוף לדרישות חנויות האפליקציות.

2. איזה מידע אנו אוספים
• חשבון: שם, אימייל, תמונת פרופיל, טלפון (אם מסרת), כתובות שמורות, תפקיד (לקוח / טכנאי).
• התחברות חברתית: אם תבחר Google או Apple, נקבל מהספק את הפרטים שהוא משתף איתנו (בדרך כלל שם, אימייל, ולעיתים תמונה ומזהה חשבון).
• מיקום: מיקום GPS בעת שימוש במפות, חיפוש טכנאים ומעקב הזמנה — רק בהרשאה שלך.
• מיקום ברקע (טכנאים בלבד): אם טכנאי מסומן כזמין, האפליקציה עשויה לעדכן מיקום גם ברקע כדי שלקוחות יוכלו למצוא אותו. אפשר לכבות זמינות או להסיר את הרשאת המיקום בהגדרות המכשיר.
• הזמנות: כתובת תיקון, תיאור תקלה, קטגוריה, תמונות שצילמת או העלית, סטטוס, מחיר והודעות בצ'אט.
• תשלומים: סכום, סטטוס עסקה ומזהה עסקה אצל ספק הסליקה. איננו שומרים מספר כרטיס מלא, CVV או תוקף מלא.
• התראות: אסימון push (Expo) כדי לשלוח עדכוני הזמנה.
• נתוני שימוש טכניים: מזהה הפעלה / עוגיית התחברות, סוג מכשיר בסיסי ויומני שגיאה לצורך אבטחה ותפעול.

3. למה אנחנו משתמשים במידע
• לספק את השירות: שיבוץ טכנאי, ניווט, מעקב, תשלום, צ'אט ותמיכה.
• לאבטח את החשבון ולמנוע הונאה.
• לעמוד בדין (כולל חוק הגנת הפרטיות ודרישות רשויות מוסמכות).
• לשפר את האפליקציה באופן מצטבר, בלי למכור את הזהות שלך לפרסום צד ג'.

4. הבסיס לעיבוד
אנו מעבדים מידע כי הוא נחוץ לביצוע ההסכם איתך (השירות), כי נתת הסכמה (למשל מיקום והתראות), או כי יש לנו חובה או אינטרס לגיטימי סביר (אבטחה, הנהלת חשבונות, יישוב סכסוך) — והכול בכפוף לדין.

5. עם מי משתפים
• הצד השני להזמנה (לקוח או טכנאי) — רק מה שנדרש לביצוע העבודה (שם, מיקום/כתובת, פרטי הזמנה, ולעיתים טלפון אחרי תשלום לפי הכללים באפליקציה).
• ספק התשלום (כיום PayMe).
• אחסון ותשתית: Render (שרת) ו-Supabase (מסד נתונים וקבצים).
• מפות וניווט: Google Maps / שירותי Google.
• התחברות: Google או Apple, אם בחרת בהן.
• רשות מוסמכת או צו שיפוטי, אם נדרש לפי דין.
איננו מוכרים את רשימת המשתמשים שלך.

6. שמירה
נשמור מידע כל עוד החשבון פעיל, וכן לאחר מכן ככל שנדרש לצרכים משפטיים, חשבונאיים או ליישוב מחלוקת (למשל תיעוד עסקה). מידע שתמחק מהחשבון יוסר או יהפוך ללא מזהה בתוך זמן סביר, אלא אם החוק מחייב שמירה.

7. הזכויות שלך
בכפוף לחוק תוכל לבקש עיון, תיקון או מחיקה.
מחיקת חשבון: בפרופיל האפליקציה, או בפנייה ל-${EMAIL}.
ביטול הסכמה למיקום או להתראות: בהגדרות המכשיר או באפליקציה (כיבוי זמינות אצל טכנאי).

8. אבטחה
אנו נוקטים אמצעים סבירים (הצפנת תעבורה, הרשאות גישה, מחיקת חשבון). אין אבטחה מוחלטת ברשת.

9. קטינים
השירות מיועד לבני 18 ומעלה. איננו אוספים ביודעין מידע ממי שמתחת לגיל זה.

10. העברה מחוץ לישראל
ספקים כמו Google, Apple, Render או Supabase עשויים לעבד מידע בשרתים מחוץ לישראל. השימוש בהם נעשה לצורך הפעלת השירות.

11. עדכונים
נעדכן מדיניות זו מעת לעת. התאריך בראש המסמך הוא הנוסח התקף.

12. יצירת קשר
לשאלות על פרטיות: ${EMAIL}
${SITE}`;

const privacyEn = `Privacy Policy — eBike App
Last updated: ${UPDATED_EN}

1. Who is responsible
Data controller: ${COMPANY_EN}
Website: ${SITE}
Privacy contact: ${EMAIL}

This policy applies to the eBike app. It is written to align with Israel's Privacy Protection Law, 1981 (as amended), and with app-store requirements.

2. Data we collect
• Account: name, email, profile photo, phone (if you give it), saved addresses, role (customer / technician).
• Social login: if you choose Google or Apple, we receive the details that provider shares with us (usually name, email, and sometimes a photo and account id).
• Location: GPS while you use maps, find technicians, or track a job — only with your permission.
• Background location (technicians only): if a technician is marked available, the App may update location in the background so customers can find them. Turn availability off, or revoke location in device settings, to stop this.
• Jobs: repair address, issue description, category, photos you take or upload, status, price and chat messages.
• Payments: amount, transaction status and the payment provider's reference. We do not store full card numbers, CVV or full expiry.
• Notifications: an Expo push token so we can send job updates.
• Technical data: session / login cookie, basic device info and error logs for security and operations.

3. Why we use it
• To provide the service: matching, navigation, tracking, payment, chat and support.
• To secure accounts and reduce fraud.
• To comply with law (including the Privacy Protection Law and lawful authority requests).
• To improve the App in aggregate. We do not sell your identity for third-party ads.

4. Legal basis
We process data because it is needed to perform the contract (the service), because you consented (for example location and notifications), or because we have a reasonable legitimate interest or legal duty (security, accounting, dispute handling) — always subject to applicable law.

5. Who we share with
• The other party to a job (customer or technician) — only what is needed to do the work (name, location/address, job details, and sometimes phone after payment, as the App rules allow).
• The payment provider (currently PayMe).
• Hosting and storage: Render (server) and Supabase (database and files).
• Maps: Google Maps / Google services.
• Sign-in: Google or Apple, if you use them.
• A competent authority or court order, if required by law.
We do not sell your user list.

6. Retention
We keep data while the account is active, and afterwards as needed for legal, accounting or dispute purposes (for example a payment record). Data you delete is removed or de-identified within a reasonable time, unless law requires us to keep it.

7. Your rights
Subject to law, you may ask to access, correct or delete your data.
Delete your account from the in-app profile, or email ${EMAIL}.
Withdraw location or notification consent in device settings or in the App (technicians: turn availability off).

8. Security
We use reasonable measures (encrypted transport, access control, account deletion). No online system is perfectly secure.

9. Children
The service is for people aged 18 and over. We do not knowingly collect data from anyone younger.

10. Processing outside Israel
Providers such as Google, Apple, Render or Supabase may process data on servers outside Israel, as needed to run the service.

11. Updates
We may update this policy. The date at the top is the current version.

12. Contact
Privacy questions: ${EMAIL}
${SITE}`;

const cancellationHe = `מדיניות ביטול והחזרים — אפליקציית eBike
עודכן לאחרונה: ${UPDATED}

מטרת המדיניות: שקיפות וצמצום מחלוקות.
התשלום מעובד אצל ספק סליקה חיצוני (כיום PayMe).
פניות: ${EMAIL} או WhatsApp ${SUPPORT_PHONE}

זכויות לפי חוק הגנת הצרכן אינן נשללות. אם הדין מעניק זכות ביטול רחבה יותר — היא גוברת על נוסח זה.

1. ביטול על ידי הלקוח — לפני תשלום
ניתן לבטל את ההזמנה באפליקציה בכל עת, בלי עלות.

2. ביטול על ידי הלקוח — אחרי תשלום
הביטול אפשרי. אחרי שהתשלום אושר, הביטול לא מתבצע בלחיצה אחת באפליקציה, אלא דרך התמיכה — כדי לתאם מול הטכנאי ולפתוח החזר אצל ספק הסליקה.
• פנה לתמיכה ב-WhatsApp או באימייל, ציין את מספר ההזמנה.
• התמיכה תיצור קשר עם שני הצדדים ותטפל בביטול ובהחזר לפי הסעיפים שלהלן ובהתאם לדין.

3. ביטול על ידי הטכנאי
אם הטכנאי מבטל — נפתח תהליך החזר ללקוח דרך ספק הסליקה / התפעול.
לפני יציאה לדרך (סטטוס לפני "בדרך"): החזר מלא של הסכום ששולם.

4. אחרי שהטכנאי יצא לדרך ("בדרך" / הגיע / בתיקון)
אם הלקוח מבקש לבטל בשלב זה — יש לפנות לתמיכה.
התמיכה תדבר עם הלקוח ועם הטכנאי. ייתכן החזר מלא, החזר חלקי או חיוב סביר על יציאה לדרך — לפי נסיבות המקרה, מה שכבר בוצע, ובהתאם לדיני הגנת הצרכן. אין כאן חסימה של זכות הביטול, אלא טיפול ידני הוגן.

5. תקלה שלא תוקנה
אם הטכנאי מדווח שהתקלה לא תוקנה, או שהעבודה לא הושלמה — ייפתח תהליך החזר ללקוח לפי הסכום הרלוונטי.

6. תשלום נוסף שאושר
תוספת תיקון שאושרה ושולמה על ידי הלקוח כפופה לאותם כללי ביטול והחזר.

7. זמני החזר
ההחזר יוצא דרך ספק הסליקה. הופעה בחשבון תלויה בחברת האשראי / PayMe, בדרך כלל מספר ימי עסקים.

8. יצירת קשר לתמיכה וביטולים
• אימייל: ${EMAIL}
• WhatsApp: ${SUPPORT_PHONE}
• אתר: ${SITE}`;

const cancellationEn = `Cancellation & Refund Policy — eBike App
Last updated: ${UPDATED_EN}

Purpose: clarity and fewer disputes.
Payments are processed by an external provider (currently PayMe).
Contact: ${EMAIL} or WhatsApp ${SUPPORT_PHONE}

Rights under Israeli consumer-protection law are not waived. If the law gives you a broader cancellation right, that right prevails.

1. Customer cancellation — before payment
You may cancel the job in the App at any time, at no charge.

2. Customer cancellation — after payment
Cancellation is available. After payment is confirmed it is not a single in-app button: contact support so we can coordinate with the technician and open a refund with the payment provider.
• Message support on WhatsApp or email, and include the job number.
• Support will contact both sides and handle cancellation and refund under the sections below and under applicable law.

3. Technician cancellation
If the technician cancels, a refund process is opened for the customer via the payment provider / operations.
Before the technician has set off (status before "on the way"): full refund of the amount paid.

4. After the technician is on the way ("on the way" / arrived / in repair)
If the customer wants to cancel at this stage, contact support.
Support will speak with both sides. The outcome may be a full refund, a partial refund, or a reasonable call-out charge — depending on what already happened and on consumer-protection law. Cancellation is not blocked; it is handled manually and fairly.

5. Issue not fixed
If the technician reports that the issue was not fixed, or the work was not completed, a refund process is opened for the relevant amount.

6. Extra charges you approved
An extra repair that you approved and paid follows the same cancellation and refund rules.

7. Refund timing
Refunds go out through the payment provider. They usually appear in a few business days, depending on the card issuer / PayMe.

8. Support for cancellations
• Email: ${EMAIL}
• WhatsApp: ${SUPPORT_PHONE}
• Website: ${SITE}`;

export function getLegalContent(type: LegalDocType, language: Language): { title: string; body: string } {
  if (type === 'terms') {
    return {
      title: language === 'he' ? 'תנאי שימוש' : 'Terms of Service',
      body: language === 'he' ? termsHe : termsEn,
    };
  }
  if (type === 'cancellation') {
    return {
      title: language === 'he' ? 'מדיניות ביטול והחזרים' : 'Cancellation & Refunds',
      body: language === 'he' ? cancellationHe : cancellationEn,
    };
  }
  return {
    title: language === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy',
    body: language === 'he' ? privacyHe : privacyEn,
  };
}
