import { useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { LoadingScreen } from "@/components/LoadingScreen";
import { extractOAuthCookieFromUrl, persistOAuthCookie } from "@/lib/auth/auth-client";
import { refreshSessionAfterAuth } from "@/lib/auth/use-session";

/**
 * Dedicated return URL after Google/Apple.
 * Expo Router lands here from the deep link so we can save the session cookie
 * even when the in-app browser reports the session as cancelled.
 */
export default function OAuthCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ cookie?: string }>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromParams = typeof params.cookie === "string" ? params.cookie : null;
      if (fromParams) persistOAuthCookie(fromParams);

      const href = Linking.getLinkingURL?.() ?? (await Linking.getInitialURL());
      const fromUrl = extractOAuthCookieFromUrl(href);
      if (fromUrl) persistOAuthCookie(fromUrl);

      const ready = await refreshSessionAfterAuth(queryClient);
      if (cancelled) return;
      router.replace(ready ? "/" : "/sign-in");
    })();
    return () => {
      cancelled = true;
    };
  }, [params.cookie, queryClient, router]);

  return <LoadingScreen />;
}
