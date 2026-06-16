import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_BASE64_SIZE = 7 * 1024 * 1024; // 7MB base64 string (~5MB image)

const sendDetailsSchema = z.object({
  photo_uri: z.string().max(2048).optional(),
  photo_base64: z.string().max(MAX_BASE64_SIZE).optional(),
  description: z.string().max(1000).optional(),
  bike_type: z.enum(["regular", "electric"]),
  category: z.string().min(1).max(100),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().max(300).optional(),
  }).optional(),
  customer_name: z.string().max(100).optional(),
  customer_phone: z.string().max(20).optional(),
  customer_email: z.string().email().max(254).optional(),
});

export const contactRouter = new Hono();

// Send contact details to representative
contactRouter.post("/send-details", zValidator("json", sendDetailsSchema), async (c) => {
  try {
    const {
      photo_uri,
      photo_base64,
      description,
      bike_type,
      category,
      location,
      customer_name,
      customer_phone,
      customer_email
    } = c.req.valid("json");
    console.log('📧 Received contact request, bike_type:', bike_type, 'category:', category);

    // Translate category to Hebrew
    const categoryTranslations: Record<string, string> = {
      'front_tire_puncture': 'פנצ\'ר בגלגל קדמי',
      'rear_tire_puncture': 'פנצ\'ר בגלגל אחורי',
      'tire_tube_replacement': 'החלפת צמיג+פנימית',
      'brake_issue': 'ברקסים לא עובדים',
      'starts_no_drive': 'נדלק ולא נוסע',
      'general_electrical': 'תקלת חשמל כללית',
      'general_service': 'טיפול כללי',
    };

    const categoryHebrew = categoryTranslations[category] || category;

    // Format the email content
    const emailContentText = `
פרטי בקשה חדשה - אין טכנאים זמינים

פרטי הלקוח:
${customer_name ? `שם: ${customer_name}` : ''}
${customer_phone ? `טלפון: ${customer_phone}` : ''}
${customer_email ? `אימייל: ${customer_email}` : ''}

פרטי התיקון:
סוג אופניים: ${bike_type === 'electric' ? 'חשמליים' : 'רגילים'}
קטגוריה: ${categoryHebrew}

${location ? `מיקום: lat: ${location.latitude}, lng: ${location.longitude}` : ''}

---
נשלח דרך אפליקציית Ebikeland
    `.trim();

    const emailContentHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .content {
      padding: 24px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1F2937;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #E5E7EB;
    }
    .info-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #F3F4F6;
    }
    .info-label {
      font-weight: 600;
      color: #6B7280;
      min-width: 120px;
    }
    .info-value {
      color: #1F2937;
      flex: 1;
    }
    .photo-container {
      text-align: center;
      margin: 24px 0;
      padding: 16px;
      background-color: #F9FAFB;
      border-radius: 8px;
    }
    .photo-container img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .footer {
      text-align: center;
      padding: 16px;
      background-color: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
    }
    .map-link {
      display: inline-block;
      padding: 8px 16px;
      background-color: #3B82F6;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚴 בקשת תיקון חדשה</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">אין טכנאים זמינים - נא ליצור קשר עם הלקוח</p>
    </div>

    <div class="content">
      <!-- Customer Details -->
      <div class="section">
        <div class="section-title">👤 פרטי הלקוח</div>
        ${customer_name ? `<div class="info-row"><span class="info-label">שם:</span><span class="info-value">${customer_name}</span></div>` : ''}
        ${customer_phone ? `<div class="info-row"><span class="info-label">טלפון:</span><span class="info-value"><a href="tel:${customer_phone}">${customer_phone}</a></span></div>` : ''}
        ${customer_email ? `<div class="info-row"><span class="info-label">אימייל:</span><span class="info-value"><a href="mailto:${customer_email}">${customer_email}</a></span></div>` : ''}
      </div>

      <!-- Repair Details -->
      <div class="section">
        <div class="section-title">🔧 פרטי התיקון</div>
        <div class="info-row">
          <span class="info-label">סוג רכב:</span>
          <span class="info-value">${bike_type === 'electric' ? '⚡ אופניים חשמליים' : '🛴 קורקינט'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">קטגוריה:</span>
          <span class="info-value">${categoryHebrew}</span>
        </div>
      </div>

      <!-- Photo Note -->
      ${photo_base64 ? `
      <div class="section">
        <div class="section-title">📷 תמונת התקלה</div>
        <div style="padding: 12px; background-color: #EFF6FF; border-right: 4px solid #3B82F6; border-radius: 8px;">
          <p style="margin: 0; color: #1E40AF; font-size: 14px;">
            📎 התמונה מצורפת למייל זה. אנא פתח את הקובץ המצורף לצפייה.
          </p>
        </div>
      </div>
      ` : ''}

      <!-- Location -->
      ${location ? `
      <div class="section">
        <div class="section-title">📍 מיקום הלקוח</div>
        <div class="info-row">
          <span class="info-label">קואורדינטות:</span>
          <span class="info-value">${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</span>
        </div>
        <div style="text-align: center;">
          <a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" class="map-link" target="_blank">
            📍 פתח במפות Google
          </a>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      נשלח דרך אפליקציית <strong>Ebikeland</strong>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email using Resend
    try {
      const emailData: any = {
        from: 'Ebikeland <onboarding@resend.dev>',
        to: 'ebikelandapp@gmail.com',
        subject: 'בקשת תיקון חדשה - אין טכנאים זמינים',
        text: emailContentText,
        html: emailContentHtml,
      };

      // Add photo as attachment if available
      if (photo_base64) {
        emailData.attachments = [
          {
            filename: 'repair-photo.jpg',
            content: photo_base64,
          },
        ];
      }

      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        console.error('Resend error:', error);
        return c.json({ error: 'שגיאה בשליחת המייל' }, 500);
      }

      console.log('Email sent successfully:', data);

      return c.json({
        success: true,
        message: 'הפרטים נשלחו בהצלחה לנציג',
        emailId: data?.id
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return c.json({
        error: 'שגיאה בשליחת המייל'
      }, 500);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({
      error: 'שגיאה בעיבוד הבקשה'
    }, 500);
  }
});
