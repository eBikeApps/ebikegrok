import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),

  // Database
  DATABASE_URL: z.string().default("file:./dev.db"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BACKEND_URL: z.string().default("http://localhost:3000"),
  OAUTH_BASE_URL: z.string().optional(), // Stable production URL for OAuth redirect URIs
  OPENAI_API_KEY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  FROM_EMAIL: z.string().optional(),

  // Admin
  ADMIN_EMAILS: z.string().optional().default(""),
  // Standalone web admin dashboard (HTML, outside the mobile app)
  ADMIN_DASHBOARD_SECRET: z.string().optional().default(""),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Apple OAuth
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(), // pre-generated JWT (fallback)
  APPLE_TEAM_ID: z.string().optional(),       // 10-char Team ID from Apple Developer
  APPLE_KEY_ID: z.string().optional(),        // Key ID from the Sign In with Apple private key
  APPLE_PRIVATE_KEY: z.string().optional(),   // PEM content of .p8 file (newlines as \n)

  // Grow (Meshulam) payment gateway
  GROW_API_BASE: z.string().optional().default("https://secure.meshulam.co.il/api/light/server/1.0"),
  GROW_USER_ID: z.string().optional(),
  GROW_PAGE_CODE: z.string().optional(),
  COMMISSION_RATE: z.string().optional().default("0.10"),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
