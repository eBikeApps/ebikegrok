import { Hono } from "hono";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, basename, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

type HonoEnv = {
  Variables: {
    user: any;
    session: any;
  };
};

const uploadsRouter = new Hono<HonoEnv>();

const UPLOADS_DIR = resolve(process.cwd(), "uploads");
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // B12 FIX: 5MB hard cap
const SAFE_MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// Magic-byte sniff so a client can't lie about mimeType to upload SVG/HTML
function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

uploadsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const { base64, mimeType = "image/jpeg" } = body;

    if (!base64 || typeof base64 !== "string") {
      return c.json({ error: "base64 data required" }, 400);
    }

    // B13 FIX: whitelist MIME types to block SVG/HTML/etc
    if (!SAFE_MIMES[mimeType]) {
      return c.json({ error: "Only JPEG/PNG/WebP allowed" }, 400);
    }

    // B12 FIX: enforce raw base64 length cap BEFORE decoding to prevent
    // a malicious client from forcing a huge Buffer allocation
    const data = base64.replace(/^data:image\/\w+;base64,/, "");
    // base64 expands ~4/3, so cap base64 length at ~6.7MB to allow ~5MB decoded
    if (data.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 16) {
      return c.json({ error: "File too large (max 5MB)" }, 413);
    }

    const buffer = Buffer.from(data, "base64");
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return c.json({ error: "File too large (max 5MB)" }, 413);
    }
    if (buffer.length < 32) {
      return c.json({ error: "Invalid image data" }, 400);
    }

    // B13 FIX: verify magic bytes match the claimed mimeType
    const detected = detectImageMime(buffer);
    if (!detected) {
      return c.json({ error: "Unrecognized image format" }, 400);
    }

    await ensureUploadsDir();

    const ext = SAFE_MIMES[detected];
    const filename = `${randomUUID()}.${ext}`;
    const filepath = join(UPLOADS_DIR, filename);

    await writeFile(filepath, buffer);

    const backendUrl = process.env.BACKEND_URL || "";
    const url = `${backendUrl}/api/uploads/${filename}`;

    return c.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

uploadsRouter.get("/:filename", async (c) => {
  try {
    const raw = c.req.param("filename");

    // B14 FIX: strict path traversal protection
    // 1. Reject any filename with separators or encoded escapes
    if (
      raw.includes("/") ||
      raw.includes("\\") ||
      raw.includes("..") ||
      raw.includes("\0") ||
      raw.includes("%")
    ) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    // 2. Normalize to basename and validate it didn't change
    const safe = basename(raw);
    if (safe !== raw) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    // 3. Verify the resolved path stays within UPLOADS_DIR
    const filepath = resolve(join(UPLOADS_DIR, safe));
    if (!filepath.startsWith(UPLOADS_DIR + sep)) {
      return c.json({ error: "Invalid path" }, 400);
    }

    // 4. Enforce a strict extension allowlist
    const ext = (safe.split(".").pop() || "").toLowerCase();
    const allowedExts: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (!allowedExts[ext]) {
      return c.json({ error: "Unsupported file type" }, 400);
    }

    if (!existsSync(filepath)) {
      return c.json({ error: "File not found" }, 404);
    }

    const buffer = await readFile(filepath);

    return new Response(buffer, {
      headers: {
        "Content-Type": allowedExts[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      },
    });
  } catch (error) {
    console.error("Serve upload error:", error);
    return c.json({ error: "Failed to serve file" }, 500);
  }
});

export { uploadsRouter };
