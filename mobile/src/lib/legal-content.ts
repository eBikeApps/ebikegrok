import { Language } from './i18n';

export type LegalDocType = 'terms' | 'privacy';

const termsHe = `תנאי שימוש — אפליקציית eBike
עודכן לאחרונה: יולי 2026

1. כללי
אפליקציית eBike ("האפליקציה") מופעלת על ידי eBike Land / ebikeland.com ("החברה", "אנחנו"). השימוש באפליקציה מהווה הסכמה לתנאים אלה.

2. השירות
האפליקציה מקשרת בין לקוחות הזקוקים לתיקון אופניים חשמליים לבין טכנאים עצמאיים. החברה אינה ספק תיקון ואינה אחראית לביצוע העבודה בפועל — האחריות לביצוע מוטלת על הטכנאי.

3. הרשמה וחשבון
• כל משתמש נרשם כלקוח. שינוי תפקיד לטכנאי מתבצע ידנית על ידי מנהל המערכת בלבד.
• עליך לספק פרטים נכונים ולשמור על סודיות פרטי ההתחברות.
• אסור ליצור חשבונות מזויפים או להשתמש בחשבון אחר ללא הרשאה.

4. הזמנות ותשלומים
• מחיר משוער מוצג לפני ההזמנה; מחיר סופי עשוי להיקבע על ידי הטכנאי לאחר הבדיקה.
• תשלום מתבצע דרך ספק תשלומים חיצוני מאובטח בהתאם לתנאיו.
• ביטול הזמנה לפני תחילת עבודה כפוף למדיניות הביטולים המוצגת באפליקציה.

5. התנהגות משתמשים
אסור: שימוש לרעה, הטרדה, הונאה, פרסום תוכן פוגעני, או כל פעולה המפרה חוקי מדינת ישראל.

6. אחריות והגבלתה
השירות ניתן "כמות שהוא" (AS IS). החברה לא אחראית לנזקים עקיפים, אובדן רווחים, או נזקים הנובעים מעבודת טכנאי — בכפוף לחוקי הצרכנות החלים.

7. קניין רוחני
כל הזכויות באפליקציה, בעיצוב ובמותג eBike שייכות לחברה.

8. שינויים
נוכל לעדכן תנאים אלה; המשך שימוש לאחר עדכון מהווה הסכמה.

9. דין וסמכות שיפוט
תנאים אלה כפופים לדיני מדינת ישראל. סמכות שיפוט: בתי המשפט המוסמכים בישראל.

10. יצירת קשר
support@ebikeland.com`;

const termsEn = `Terms of Service — eBike App
Last updated: July 2026

1. General
The eBike app ("App") is operated by eBike Land / ebikeland.com ("we", "Company"). Use of the App constitutes acceptance of these Terms.

2. The Service
The App connects customers needing e-bike repairs with independent technicians. We are a marketplace platform, not the repair provider. Work performance is the technician's responsibility.

3. Registration
• All users register as customers. Technician role is assigned by an administrator only.
• You must provide accurate information and keep credentials secure.

4. Orders & Payments
• Estimated prices are shown before booking; final price may be set after inspection.
• Payments are processed via a secure third-party payment provider. Cancellations follow in-app policy.

5. Conduct
No abuse, harassment, fraud, or unlawful use.

6. Liability
Service provided "as is", subject to applicable Israeli consumer protection law.

7. Contact: support@ebikeland.com`;

const privacyHe = `מדיניות פרטיות — אפליקציית eBike
עודכן לאחרונה: יולי 2026

1. מי אנחנו
מפעיל האפליקציה: eBike Land. דוא"ל: support@ebikeland.com

2. מידע שאנו אוספים
• פרטי חשבון: שם, אימייל, תמונת פרופיל, טלפון (אופציונלי).
• מיקום: מיקום GPS לצורך מציאת טכנאים, ניווט ומעקב הזמנה (בהסכמתך).
• הזמנות: כתובת, תיאור תקלה, תמונות, היסטוריית עבודות.
• תשלומים: מעובדים על ידי ספק תשלומים חיצוני; איננו שומרים פרטי כרטיס אשראי מלאים.
• התראות: אסימון push (Expo) לעדכוני הזמנה.

3. מטרות השימוש
• מתן השירות, שיבוץ טכנאים, תמיכה, אבטחה ושיפור האפליקציה.
• עמידה בדרישות חוק (לרבות חוק הגנת הפרטיות, התשמ"א-1981).

4. שיתוף מידע
• עם טכנאים/לקוחות הרלוונטיים להזמנה.
• עם ספקי תשלום, אחסון (Render, Supabase) ושירותי מפות (Google).
• לפי צו שיפוטי או דרישת רשות מוסמכת.

5. אבטחה
אנו נוקטים אמצעי אבטחה סבירים; אין אבטחה מוחלטת ברשת.

6. זכויותיך
בכפוף לחוק, ניתן לבקש גישה, תיקון או מחיקת חשבון דרך האפליקציה (מחיקת חשבון בפרופיל) או בפנייה ל-support@ebikeland.com.

7. שמירת מידע
נשמור מידע כל עוד החשבון פעיל וכנדרש לצרכים משפטיים וחשבונאיים.

8. קטינים
השירות מיועד למשתמשים בני 18 ומעלה.

9. עדכונים
נעדכן מדיניות זו מעת לעת; תאריך עדכון בראש המסמך.

10. יצירת קשר
support@ebikeland.com`;

const privacyEn = `Privacy Policy — eBike App
Last updated: July 2026

1. Controller: eBike Land — support@ebikeland.com

2. Data we collect
Account info, location (with consent), job details, photos, push tokens. Card data is handled by our payment provider; we do not store full card numbers.

3. Purposes
Provide the service, match technicians, support, security, legal compliance (Israeli Privacy Protection Law, 1981).

4. Sharing
With parties to a job, payment/maps/hosting providers, and authorities when required by law.

5. Your rights
Access, correction, deletion via in-app account deletion or email.

6. Contact: support@ebikeland.com`;

export function getLegalContent(type: LegalDocType, language: Language): { title: string; body: string } {
  if (type === 'terms') {
    return {
      title: language === 'he' ? 'תנאי שימוש' : 'Terms of Service',
      body: language === 'he' ? termsHe : termsEn,
    };
  }
  return {
    title: language === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy',
    body: language === 'he' ? privacyHe : privacyEn,
  };
}