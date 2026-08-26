import * as Linking from "expo-linking";
import type { QueryClient } from "@tanstack/react-query";
import { authClient, extractOAuthCookieFromUrl, persistOAuthCookie } from "./auth-client";
import { refreshSessionAfterAuth } from "./use-session";

export type SocialProvider = "google" | "apple";

export type SocialSignInResult =
  | { status: "ok" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/**
 * Google/Apple via Better Auth Expo proxy.
 *
 * iOS often reports the browser session as "cancel" even after a successful
 * Google login, because the deep link is delivered to Expo Router instead of
 * openAuthSessionAsync. We listen for that URL, persist the cookie ourselves,
 * then wait for get-session.
 */
export async function signInWithSocial(
  provider: SocialProvider,
  queryClient: QueryClient
): Promise<SocialSignInResult> {
  // Always return to the production app scheme. Linking.createURL() in Expo
  // Dev Client is exp+ebike://… which production Better Auth does not trust,
  // so the session cookie is never attached and Google "succeeds" with no profile.
  const callbackURL = "ebike://oauth-callback";
  let capturedCookie: string | null = null;

  const capture = (url?: string | null) => {
    const cookie = extractOAuthCookieFromUrl(url);
    if (cookie) {
      capturedCookie = cookie;
      persistOAuthCookie(cookie);
    }
  };

  const sub = Linking.addEventListener("url", (event) => capture(event.url));
  try {
    capture(await Linking.getInitialURL());

    const result = await (authClient.signIn as any).social({
      provider,
      callbackURL,
    });

    if (result?.error) {
      const errMsg =
        result.error?.message || result.error?.code || JSON.stringify(result.error);
      return {
        status: "error",
        message:
          errMsg ||
          (provider === "google" ? "לא ניתן להתחבר עם Google." : "לא ניתן להתחבר עם Apple."),
      };
    }

    if (!capturedCookie) {
      capture(await Linking.getInitialURL());
    }

    const ready = await refreshSessionAfterAuth(queryClient);
    if (ready) return { status: "ok" };

    // Browser closed with no cookie and no session — user cancelled
    if (!capturedCookie) return { status: "cancelled" };

    return {
      status: "error",
      message:
        provider === "google"
          ? "ההתחברות עם Google הצליחה אך לא הצלחנו לטעון את הפרופיל. נסה שוב."
          : "ההתחברות עם Apple הצליחה אך לא הצלחנו לטעון את הפרופיל. נסה שוב.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `לא ניתן להתחבר: ${msg}` };
  } finally {
    sub.remove();
  }
}
