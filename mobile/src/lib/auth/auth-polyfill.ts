// Pre-initialize the better-auth online/focus managers before @better-auth/expo tries to set them up.
// This prevents the "TypeError: Object is not a function" error caused by
// @better-auth/expo's dynamic import("expo-network") failing in the Metro bundler.
import { AppState } from "react-native";

const kOnlineManager = Symbol.for("better-auth:online-manager");
const kFocusManager = Symbol.for("better-auth:focus-manager");

type Listener<T> = (value: T) => void;

if (!(globalThis as any)[kOnlineManager]) {
  const onlineListeners = new Set<Listener<boolean>>();
  (globalThis as any)[kOnlineManager] = {
    isOnline: true,
    subscribe(listener: Listener<boolean>) {
      onlineListeners.add(listener);
      return () => onlineListeners.delete(listener);
    },
    setOnline(online: boolean) {
      if (this.isOnline === online) return;
      this.isOnline = online;
      onlineListeners.forEach((l) => l(online));
    },
    setup() {
      return () => {};
    },
  };
}

if (!(globalThis as any)[kFocusManager]) {
  const focusListeners = new Set<Listener<boolean>>();
  let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
  (globalThis as any)[kFocusManager] = {
    isFocused: true,
    subscribe(listener: Listener<boolean>) {
      focusListeners.add(listener);
      return () => focusListeners.delete(listener);
    },
    setFocused(focused: boolean) {
      if (this.isFocused === focused) return;
      this.isFocused = focused;
      focusListeners.forEach((l) => l(focused));
    },
    setup() {
      subscription = AppState.addEventListener("change", (state) => {
        (globalThis as any)[kFocusManager].setFocused(state === "active");
      });
      return () => subscription?.remove();
    },
  };
}
