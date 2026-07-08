/**
 * Post-flow stability monitor — 5 minutes, poll every 30s.
 * Run: JOB_ID=... CUSTOMER_EMAIL=... bun run qa/monitor-5min.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BACKEND_URL ?? "http://127.0.0.1:3001";
const INTERVAL_MS = 30_000;
const DURATION_MS = 5 * 60_000;
const PASSWORD = "123456";

type MonitorRow = {
  at: string;
  check: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

const rows: MonitorRow[] = [];

function loadMeta() {
  try {
    const raw = readFileSync(join(import.meta.dir, "output/qa-results.json"), "utf8");
    return JSON.parse(raw).meta ?? {};
  } catch {
    return {};
  }
}

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  return data.token;
}

async function getJob(token: string, jobId: string) {
  const res = await fetch(`${BASE}/api/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json() };
}

async function health() {
  const res = await fetch(`${BASE}/health`);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function log(check: string, status: MonitorRow["status"], detail: string) {
  rows.push({ at: new Date().toISOString(), check, status, detail });
  console.log(`[${status}] ${check}: ${detail}`);
}

async function main() {
  const meta = loadMeta();
  const jobId = process.env.JOB_ID ?? (meta.jobId as string);
  const customerEmail = process.env.CUSTOMER_EMAIL ?? (meta.customerEmail as string);
  if (!jobId || !customerEmail) {
    console.error("Missing JOB_ID or CUSTOMER_EMAIL");
    process.exit(1);
  }

  console.log(`Monitoring job ${jobId} for 5 minutes...\n`);
  const token = await signIn(customerEmail);
  const start = Date.now();
  let iteration = 0;

  while (Date.now() - start < DURATION_MS) {
    iteration++;
    const h = await health();
    log(
      `Health check #${iteration}`,
      h.status === 200 ? "PASS" : "FAIL",
      `HTTP ${h.status}`
    );

    const job = await getJob(token, jobId);
    const j = job.data?.job;
    if (job.status !== 200 || !j) {
      log(`Job fetch #${iteration}`, "FAIL", `HTTP ${job.status}`);
    } else {
      const stable =
        j.status === "completed" &&
        j.paymentStatus === "paid" &&
        j.jobReference?.startsWith("EB-");
      log(
        `Job state #${iteration}`,
        stable ? "PASS" : "WARN",
        `status=${j.status}, pay=${j.paymentStatus}, ref=${j.jobReference}`
      );
    }

    const remaining = Math.ceil((DURATION_MS - (Date.now() - start)) / 1000);
    if (remaining > 0) {
      console.log(`  ... next check in 30s (${remaining}s left)\n`);
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  const outDir = join(import.meta.dir, "output");
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "monitor-results.json");
  writeFileSync(path, JSON.stringify({ durationMin: 5, intervalSec: 30, rows }, null, 2));
  console.log(`\nMonitor complete. ${rows.filter((r) => r.status === "FAIL").length} failures.`);
  console.log(`Saved: ${path}`);
}

main().catch(console.error);