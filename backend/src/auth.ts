import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { env } from "./env";

async function buildAppleClientSecret(): Promise<string | null> {
  // Read directly from process.env to avoid stale module cache
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const prebuiltSecret = process.env.APPLE_CLIENT_SECRET;

  console.log("[Auth] Apple config check — clientId:", clientId, "teamId:", teamId, "keyId:", keyId, "hasKey:", !!privateKey);

  if (teamId && keyId && privateKey && clientId) {
    try {
      const pem = privateKey.replace(/\\n/g, "\n").trim();
      const pemBody = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");
      const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyData,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
      const now = Math.floor(Date.now() / 1000);
      const b64url = (s: string) =>
        btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
      const payload = b64url(JSON.stringify({
        iss: teamId,
        iat: now,
        exp: now + 15777000,
        aud: "https://appleid.apple.com",
        sub: clientId,
      }));
      const sigInput = `${header}.${payload}`;
      const sig = await crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        cryptoKey,
        new TextEncoder().encode(sigInput)
      );
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      console.log("[Auth] ✅ Apple client secret generated successfully");
      return `${sigInput}.${sigB64}`;
    } catch (err) {
      console.error("[Auth] ❌ Failed to generate Apple client secret:", err);
    }
  }
  return prebuiltSecret ?? null;
}

const appleClientSecret = await buildAppleClientSecret();

// OAUTH_BASE_URL = stable production URL (ebikel-backend.onrender.com) — used ONLY for OAuth redirectURIs.
// Must use a dedicated var to avoid collision with system env BASE_URL (set by Vibecode to the Expo frontend URL).
// BACKEND_URL = current backend URL (from system env, updated by Vibecode proxy).
const stableBaseURL = (env.OAUTH_BASE_URL || env.BACKEND_URL).replace(/\/$/, "");

// Diagnostic log — visible in Render logs to confirm env vars are loaded
console.log("[Auth] Config check — baseURL:", stableBaseURL,
  "| Google:", !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) ? "✅" : "❌ MISSING",
  "| Apple:", !!(process.env.APPLE_CLIENT_ID && appleClientSecret) ? "✅" : "❌ MISSING",
  "| GOOGLE_CLIENT_ID:", env.GOOGLE_CLIENT_ID ? "set" : "NOT SET",
  "| GOOGLE_CLIENT_SECRET:", env.GOOGLE_CLIENT_SECRET ? "set" : "NOT SET",
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: stableBaseURL,

  // B16 FIX: explicit session lifetime + sliding refresh window
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every 24h of activity
  },

  // B04 FIX: built-in rate limiting on auth surface
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },

  emailAndPassword: {
    enabled: true,
  },

  // Add custom user fields to session
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "customer",
      },
      isApproved: {
        type: "boolean",
        defaultValue: true,
      },
      phone: {
        type: "string",
        required: false,
      },
      address: {
        type: "string",
        required: false,
      },
    },
  },

  // ============================================
  // REQUIRED: All trustedOrigins below are needed
  // ============================================
  trustedOrigins: [
    "vibecode://", // Mobile deep links — expo plugin uses startsWith (no wildcards)
    "ebike://", // Production app scheme
    "exp://", // Expo development — expo plugin uses startsWith (no wildcards)
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.dev.vibecode.run",
    "https://*.vibecode.run",
    "https://*.vibecodeapp.com",
    "https://*.vibecode.dev",
    "https://vibecode.dev",
    "https://ebikel-backend.onrender.com",
  ],
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectURI: `${stableBaseURL}/api/auth/callback/google` } }
      : {}),
    ...(process.env.APPLE_CLIENT_ID && appleClientSecret
      ? { apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: appleClientSecret, redirectURI: `${stableBaseURL}/api/auth/callback/apple` } }
      : {}),
  },
  plugins: [expo()],

  // ============================================
  // REQUIRED: Cross-origin cookie settings
  // Without this, sessions return null in mobile/iframe
  // ============================================
  advanced: {
    trustedProxyHeaders: true, // Trust X-Forwarded-Host/Proto from reverse proxy
    disableCSRFCheck: true,
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true,
    },
  },
});
