import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authClient } from "./auth-client";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SESSION_QUERY_KEY = ["auth-session"] as const;

type SessionData = Awaited<ReturnType<typeof authClient.getSession>>["data"];

/**
 * After OAuth / sign-in, wait until the session cookie is readable and cached
 * before navigating away — otherwise index sees null and bounces to /sign-in.
 */
export async function refreshSessionAfterAuth(queryClient: QueryClient): Promise<boolean> {
  queryClient.removeQueries({ queryKey: ["me"] });

  for (let attempt = 0; attempt < 6; attempt++) {
    await queryClient.refetchQueries({ queryKey: SESSION_QUERY_KEY });
    const cached = queryClient.getQueryData<SessionData>(SESSION_QUERY_KEY);
    if (cached?.user) return true;
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  const result = await authClient.getSession();
  if (result.data?.user) {
    queryClient.setQueryData(SESSION_QUERY_KEY, result.data);
    return true;
  }
  return false;
}

export const useSession = () => {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const result = await authClient.getSession();
      console.log('[Session] getSession user:', result.data?.user?.email ?? 'null');
      return result.data ?? null;
    },
    // staleTime 0 ensures that after invalidate/refetch we always hit the network.
    // Without it, a stale "null" session can be served from cache right after
    // sign-in, sending the user back to /sign-in.
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });
};

/**
 * Call this after any auth action (sign-in, sign-up, sign-out)
 * to refresh the session state and trigger navigation guards.
 */
export const useInvalidateSession = () => {
  const queryClient = useQueryClient();
  return async () => {
    queryClient.removeQueries({ queryKey: ['me'] });
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
};

/**
 * Complete sign-out: clears server session, local storage, and cache
 */
export const useSignOut = () => {
  const queryClient = useQueryClient();
  return async () => {
    // 1. Immediately clear React Query cache (synchronous)
    queryClient.cancelQueries({ queryKey: SESSION_QUERY_KEY });
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    queryClient.removeQueries({ queryKey: ['me'] });

    // 2. Clear Better Auth storage keys (the ones Expo plugin actually uses)
    // I03 FIX: also clear AsyncStorage-persisted Zustand stores that may
    // hold cached user/profile data; otherwise next login can see stale data.
    try {
      const secureKeysToDelete = [
        "ebike_cookie",             // storagePrefix="ebike" → actual key used by @better-auth/expo
        "ebike_session_data",
        "ebike_token",
        "vibecode_cookie",          // legacy keys — clear in case of leftover from old builds
        "vibecode_session_data",
        "vibecode_token",
      ];
      const asyncKeysToDelete = [
        "ebike_cookie",
        "vibecode_cookie",
        "vibecode_session_data",
        "auth-storage",
        "technician-storage",
      ];

      await Promise.all([
        ...secureKeysToDelete.map(key =>
          SecureStore.deleteItemAsync(key).catch(() => {})
        ),
        ...asyncKeysToDelete.map(key =>
          AsyncStorage.removeItem(key).catch(() => {})
        ),
      ]);
    } catch (e) {
      // Ignore errors
    }

    // 3. Sign out from server (after clearing local state)
    try {
      await authClient.signOut();
    } catch (e) {
      // Continue even if server fails
    }

    // 4. Clear all React Query cache (in case other queries hold user data)
    queryClient.clear();
  };
};
