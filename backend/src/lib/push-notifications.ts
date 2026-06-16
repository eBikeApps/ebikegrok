/**
 * Expo Push Notification Service
 * Uses Expo's HTTP Push API - no native SDK needed on the backend
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
    console.log("[Push] Invalid or missing push token, skipping notification");
    return;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json() as { data: ExpoPushTicket };
    const ticket = result.data;

    if (ticket.status === "error") {
      console.error("[Push] Error sending notification:", ticket.message, ticket.details);
    } else {
      console.log("[Push] Notification sent successfully, ticket id:", ticket.id);
    }
  } catch (error) {
    console.error("[Push] Failed to send push notification:", error);
  }
}

export async function sendPushNotificationToMany(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const validTokens = tokens.filter(
    (t) => t && t.startsWith("ExponentPushToken[")
  );

  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`[Push] Sent to ${validTokens.length} devices`);
  } catch (error) {
    console.error("[Push] Failed to send batch notifications:", error);
  }
}
