const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "..",
  "node_modules",
  "@better-auth",
  "expo",
  "dist",
  "client.mjs",
);

if (!fs.existsSync(file)) process.exit(0);

const src = fs.readFileSync(file, "utf8");
const next = src.replace(
  'Browser = await import("expo-web-browser")',
  'Browser = require("expo-web-browser")',
);

if (next !== src) {
  fs.writeFileSync(file, next);
  console.log("[patch] @better-auth/expo: static expo-web-browser require");
}
