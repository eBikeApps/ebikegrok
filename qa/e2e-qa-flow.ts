/**
 * Full E2E QA — customer + technician flow via API (local or Render backend).
 * Run: bun run qa/e2e-qa-flow.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BACKEND_URL ?? "http://127.0.0.1:3001";
const TS = Date.now();
const CUSTOMER_EMAIL = `qa-customer-${TS}@ebike.test`;
const TECH_EMAIL = `qa-tech-${TS}@ebike.test`;
const PASSWORD = "123456";
const TLV = { lat: 32.0853, lng: 34.7818 };

type CheckResult = {
  step: number;
  category: string;
  test: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  notes: string;
};

const results: CheckResult[] = [];
let step = 0;

function record(
  category: string,
  test: string,
  expected: string,
  actual: string,
  status: CheckResult["status"],
  notes = ""
) {
  step += 1;
  results.push({ step, category, test, expected, actual, status, notes });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : status === "WARN" ? "!" : "-";
  console.log(`${icon} [${step}] ${category} — ${test}: ${status}`);
  if (status === "FAIL") console.log(`    expected: ${expected}`);
  console.log(`    actual: ${actual}`);
  if (notes) console.log(`    notes: ${notes}`);
}

async function authSignUp(email: string, name: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`sign-up failed: ${JSON.stringify(data)}`);
  return { token: data.token, userId: data.user.id };
}

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

async function prismaApproveTechnician(userId: string) {
  const { prisma } = await import("../backend/src/prisma");
  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true },
  });
}

async function main() {
  console.log(`\n=== E2E QA Flow ===`);
  console.log(`Backend: ${BASE}`);
  console.log(`Customer: ${CUSTOMER_EMAIL}`);
  console.log(`Technician: ${TECH_EMAIL}\n`);

  let customerToken = "";
  let techToken = "";
  let customerId = "";
  let techId = "";
  let jobId = "";
  let jobNumber = 0;
  let jobReference = "";

  // ── 1. Create customer ─────────────────────────────────────────────────────
  try {
    const c = await authSignUp(CUSTOMER_EMAIL, "QA Customer");
    customerToken = c.token;
    customerId = c.userId;
    const me = await api(customerToken, "GET", "/api/me");
    const cu = me.data?.user ?? me.data;
    record(
      "1. Customer Sign-up",
      "Email/password registration",
      "role=customer, isApproved=true",
      `role=${cu?.role}, isApproved=${cu?.isApproved}`,
      cu?.role === "customer" && cu?.isApproved === true ? "PASS" : "FAIL"
    );
  } catch (e: any) {
    record("1. Customer Sign-up", "Email/password registration", "success", e.message, "FAIL");
    return finish();
  }

  // ── 2. Create technician + admin approve ─────────────────────────────────
  try {
    const t = await authSignUp(TECH_EMAIL, "QA Technician");
    techToken = t.token;
    techId = t.userId;

    const rolePatch = await api(techToken, "PATCH", "/api/users/me", { role: "technician" });
    record(
      "2. Technician Sign-up",
      "Register then PATCH role=technician",
      "role=technician, isApproved=false",
      `status=${rolePatch.status}, role=${rolePatch.data?.user?.role}, approved=${rolePatch.data?.user?.isApproved}`,
      rolePatch.data?.user?.role === "technician" && rolePatch.data?.user?.isApproved === false
        ? "PASS"
        : "FAIL",
      "Simulates app flow — public cannot be technician without admin approval"
    );

    await prismaApproveTechnician(techId);
    const meAfter = await api(techToken, "GET", "/api/me");
    const tu = meAfter.data?.user ?? meAfter.data;
    record(
      "2. Technician Sign-up",
      "Admin approves technician (DB)",
      "isApproved=true",
      `isApproved=${tu?.isApproved}`,
      tu?.isApproved === true ? "PASS" : "FAIL",
      "Admin dashboard or manual DB approve required in production"
    );
  } catch (e: any) {
    record("2. Technician Sign-up", "Full technician setup", "success", e.message, "FAIL");
    return finish();
  }

  // ── 3. Technician available + location ───────────────────────────────────
  const profile = await api(techToken, "PATCH", "/api/technicians/profile", {
    isAvailable: true,
    currentLocationLat: TLV.lat,
    currentLocationLng: TLV.lng,
    vehicleType: "אופנוע",
    serviceRadius: 40,
    basePrice: 150,
    phone: "0501234567",
  });
  record(
    "3. Technician Available",
    "Set isAvailable=true + TLV location",
    "status 200, isAvailable=true",
    `status=${profile.status}, isAvailable=${profile.data?.user?.isAvailable ?? profile.data?.isAvailable}`,
    profile.status === 200 ? "PASS" : "FAIL"
  );

  const availPatch = await api(techToken, "PATCH", "/api/technicians/availability", {
    isAvailable: true,
  });
  record(
    "3. Technician Available",
    "PATCH /technicians/availability",
    "status 200",
    `status=${availPatch.status}`,
    availPatch.status === 200 ? "PASS" : "FAIL"
  );

  // ── 4. Customer creates order ──────────────────────────────────────────────
  const available = await api(customerToken, "GET", `/api/technicians/available?lat=${TLV.lat}&lng=${TLV.lng}`);
  const techs = available.data?.technicians ?? [];
  const foundTech = techs.find((t: any) => t.id === techId);
  record(
    "4. Create Order",
    "Customer sees QA technician in available list",
    "technician in list",
    `count=${techs.length}, found=${!!foundTech}`,
    foundTech ? "PASS" : "FAIL"
  );

  const createJob = await api(customerToken, "POST", "/api/jobs", {
    technicianId: techId,
    description: "QA test — brake issue",
    bikeType: "electric",
    category: "brake_issue",
    estimatedPriceMin: 120,
    estimatedPriceMax: 200,
    customerLocationLat: TLV.lat,
    customerLocationLng: TLV.lng,
    customerAddress: "תל אביב, רחוב הרצל 1",
    customerName: "QA Customer",
    customerPhone: "0509876543",
  });
  jobId = createJob.data?.job?.id ?? "";
  jobNumber = createJob.data?.job?.jobNumber ?? 0;
  jobReference = createJob.data?.job?.jobReference ?? "";
  record(
    "4. Create Order",
    "POST /api/jobs creates pending job",
    "status 200/201, status=pending, jobReference EB-XXXXXX",
    `status=${createJob.status}, jobId=${jobId}, ref=${jobReference}, dbStatus=${createJob.data?.job?.status}`,
    createJob.status >= 200 &&
      createJob.status < 300 &&
      createJob.data?.job?.status === "pending" &&
      /^EB-\d{6}$/.test(jobReference)
      ? "PASS"
      : "FAIL"
  );

  const byNumber = await api(customerToken, "GET", `/api/jobs/by-number/${jobNumber}`);
  record(
    "4. Create Order",
    "Job backed in DB with serial lookup",
    `GET by-number returns same job`,
    `status=${byNumber.status}, id=${byNumber.data?.job?.id}`,
    byNumber.status === 200 && byNumber.data?.job?.id === jobId ? "PASS" : "FAIL"
  );

  // ── 5. Technician accepts ──────────────────────────────────────────────────
  const accept = await api(techToken, "PATCH", `/api/jobs/${jobId}/status`, { status: "accepted" });
  record(
    "5. Accept Job",
    "Technician accepts → status=accepted",
    "status=accepted, paymentStatus!=paid",
    `http=${accept.status}, status=${accept.data?.job?.status}, pay=${accept.data?.job?.paymentStatus}`,
    accept.status === 200 && accept.data?.job?.status === "accepted" ? "PASS" : "FAIL"
  );

  // ── Payment gate: cannot go on_way before pay ────────────────────────────────
  const onWayBeforePay = await api(techToken, "PATCH", `/api/jobs/${jobId}/status`, { status: "on_way" });
  record(
    "5. Payment Gate",
    "Technician BLOCKED from on_way before customer pays",
    "HTTP 402 or error",
    `status=${onWayBeforePay.status}, msg=${onWayBeforePay.data?.message ?? onWayBeforePay.data?.error ?? ""}`,
    onWayBeforePay.status === 402 || onWayBeforePay.status === 400 ? "PASS" : "FAIL",
    "Critical business rule"
  );

  const simulatePay = await api(customerToken, "POST", `/api/payments/simulate-paid/${jobId}`);
  record(
    "5. Customer Pays",
    "Customer pays (simulate) after accept",
    "success, paymentStatus=paid",
    `status=${simulatePay.status}, success=${simulatePay.data?.success}`,
    simulatePay.status === 200 && simulatePay.data?.success ? "PASS" : "WARN",
    simulatePay.status !== 200 ? "MOCK_PAYMENTS may be off on this backend" : ""
  );

  const jobAfterPay = await api(customerToken, "GET", `/api/jobs/${jobId}`);
  record(
    "5. Customer Pays",
    "Job paymentStatus=paid in DB",
    "paymentStatus=paid",
    `paymentStatus=${jobAfterPay.data?.job?.paymentStatus}`,
    jobAfterPay.data?.job?.paymentStatus === "paid" ? "PASS" : "FAIL"
  );

  // ── 6. Technician goes to customer + finishes ──────────────────────────────
  const onWay = await api(techToken, "PATCH", `/api/jobs/${jobId}/status`, { status: "on_way" });
  record(
    "6. Go to Customer",
    "on_way AFTER payment",
    "status=on_way",
    `status=${onWay.status}, jobStatus=${onWay.data?.job?.status}`,
    onWay.status === 200 && onWay.data?.job?.status === "on_way" ? "PASS" : "FAIL"
  );

  const arrived = await api(techToken, "PATCH", `/api/jobs/${jobId}/status`, { status: "arrived" });
  record(
    "6. Go to Customer",
    "arrived at customer",
    "status=arrived",
    `status=${arrived.data?.job?.status}`,
    arrived.status === 200 && arrived.data?.job?.status === "arrived" ? "PASS" : "FAIL"
  );

  const inProgress = await api(techToken, "PATCH", `/api/jobs/${jobId}/status`, { status: "in_progress" });
  record(
    "6. Go to Customer",
    "in_progress repair",
    "status=in_progress",
    `status=${inProgress.data?.job?.status}`,
    inProgress.status === 200 && inProgress.data?.job?.status === "in_progress" ? "PASS" : "FAIL"
  );

  const completed = await api(techToken, "PATCH", `/api/jobs/${jobId}/status`, {
    status: "completed",
    finalPrice: 180,
  });
  record(
    "6. Finish Job",
    "Technician completes job",
    "status=completed, finalPrice set",
    `status=${completed.data?.job?.status}, price=${completed.data?.job?.finalPrice}`,
    completed.status === 200 && completed.data?.job?.status === "completed" ? "PASS" : "FAIL"
  );

  const finalJob = await api(customerToken, "GET", `/api/jobs/${jobId}`);
  record(
    "6. Finish Job",
    "Final job persisted in backend",
    "completed + jobReference + jobNumber",
    `ref=${finalJob.data?.job?.jobReference}, num=${finalJob.data?.job?.jobNumber}, status=${finalJob.data?.job?.status}`,
    finalJob.data?.job?.status === "completed" &&
      finalJob.data?.job?.jobNumber === jobNumber &&
      finalJob.data?.job?.jobReference === jobReference
      ? "PASS"
      : "FAIL"
  );

  const customerOrders = await api(customerToken, "GET", "/api/jobs");
  const inList = (customerOrders.data?.jobs ?? []).some((j: any) => j.id === jobId);
  record(
    "6. Finish Job",
    "Job appears in customer order history",
    "job in GET /api/jobs",
    `inList=${inList}, total=${customerOrders.data?.jobs?.length ?? 0}`,
    inList ? "PASS" : "FAIL"
  );

  return finish({ customerId, techId, jobId, jobReference, customerEmail: CUSTOMER_EMAIL, techEmail: TECH_EMAIL });
}

function finish(meta?: Record<string, string | number>) {
  const outDir = join(import.meta.dir, "output");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "qa-results.json");
  const summary = {
    runAt: new Date().toISOString(),
    backend: BASE,
    meta,
    totals: {
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      warn: results.filter((r) => r.status === "WARN").length,
      skip: results.filter((r) => r.status === "SKIP").length,
    },
    results,
  };
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`\n=== Summary: ${summary.totals.pass} PASS, ${summary.totals.fail} FAIL, ${summary.totals.warn} WARN ===`);
  console.log(`Results: ${jsonPath}`);
  return summary;
}

main().catch((e) => {
  console.error(e);
  record("Fatal", "Script error", "no error", String(e), "FAIL");
  finish();
  process.exit(1);
});