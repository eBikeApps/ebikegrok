import { Hono } from "hono";

function text(name: string, fallback: string) {
  const value = (process.env[name] ?? "").trim();
  return value || fallback;
}

function build(name: string) {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Oldest app version still allowed to open. Raise these when a store release must replace older copies. */
const appReleaseRouter = new Hono();

appReleaseRouter.get("/", (c) => {
  return c.json({
    customer: {
      minVersion: text("APP_MIN_CUSTOMER_VERSION", "2.1"),
      minIosBuild: build("APP_MIN_CUSTOMER_IOS_BUILD"),
      minAndroidBuild: build("APP_MIN_CUSTOMER_ANDROID_BUILD"),
      iosUrl: "https://apps.apple.com/il/app/ebike/id6775995887",
      androidUrl: "https://play.google.com/store/apps/details?id=com.ebike.app",
    },
    technician: {
      minVersion: text("APP_MIN_TECH_VERSION", "2.1"),
      minIosBuild: build("APP_MIN_TECH_IOS_BUILD"),
      minAndroidBuild: build("APP_MIN_TECH_ANDROID_BUILD"),
      iosUrl: "https://apps.apple.com/app/id6819102162",
      androidUrl: "https://play.google.com/store/apps/details?id=com.ebiketech.app",
    },
  });
});

export { appReleaseRouter };
