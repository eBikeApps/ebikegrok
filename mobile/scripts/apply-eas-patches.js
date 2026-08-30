const fs = require("fs");
const path = require("path");

function patchFile(relPath, transform, label) {
  const file = path.join(__dirname, "..", "node_modules", ...relPath.split("/"));
  if (!fs.existsSync(file)) return;
  const src = fs.readFileSync(file, "utf8");
  const next = transform(src);
  if (next !== src) {
    fs.writeFileSync(file, next);
    console.log("[patch]", label);
  }
}

patchFile(
  "@better-auth/expo/dist/client.mjs",
  (src) =>
    src.replace(
      'Browser = await import("expo-web-browser")',
      'Browser = require("expo-web-browser")',
    ),
  "@better-auth/expo: static expo-web-browser require",
);

patchFile(
  "@react-native-menu/menu/android/src/main/java/com/reactnativemenu/MenuView.kt",
  (src) =>
    src.replace(
      `  override fun setHitSlopRect(rect: Rect?) {
    super.setHitSlopRect(rect)
    mHitSlopRect = rect
    updateTouchDelegate()
  }`,
      `  override var hitSlopRect: Rect?
    get() = super.hitSlopRect
    set(value) {
      super.hitSlopRect = value
      mHitSlopRect = value
      updateTouchDelegate()
    }`,
    ),
  "@react-native-menu/menu: RN 0.81 hitSlopRect property",
);

patchFile(
  "@react-native-menu/menu/android/src/main/java/com/reactnativemenu/MenuViewManagerBase.kt",
  (src) =>
    src
      .replace("view.setHitSlopRect(null)", "view.hitSlopRect = null")
      .replace("view.setHitSlopRect(", "view.hitSlopRect = (")
      .replace(
        `  fun setOverflow(view: ReactViewGroup, overflow: String?) {
    view.setOverflow(overflow)
  }`,
        `  fun setOverflow(view: ReactViewGroup, overflow: String?) {
    view.overflow = overflow
  }`,
      ),
  "@react-native-menu/menu: RN 0.81 MenuViewManagerBase",
);
