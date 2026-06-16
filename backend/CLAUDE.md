<stack>
  Bun runtime, Hono web framework, Zod validation.
</stack>

<structure>
  src/index.ts     — App entry, middleware, route mounting
  src/routes/      — Route modules (create as needed)
</structure>

<routes>
  Create routes in src/routes/ and mount them in src/index.ts.

  Example route file (src/routes/todos.ts):
  ```typescript
  import { Hono } from "hono";
  import { zValidator } from "@hono/zod-validator";
  import { z } from "zod";

  const todosRouter = new Hono();

  todosRouter.get("/", (c) => {
    return c.json({ todos: [] });
  });

  todosRouter.post(
    "/",
    zValidator("json", z.object({ title: z.string() })),
    (c) => {
      const { title } = c.req.valid("json");
      return c.json({ todo: { id: "1", title } });
    }
  );

  export { todosRouter };
  ```

  Mount in src/index.ts:
  ```typescript
  import { todosRouter } from "./routes/todos";
  app.route("/api/todos", todosRouter);
  ```

  IMPORTANT: Make sure all endpoints and routes are prefixed with `/api/`
</routes>

<database>
  No database is configured by default.
  If the user needs to persist data or have user accounts, use the database-auth skill and then update this file to reflect the changes.
</database>

<package_management>
  CRITICAL: After using `bun add` to install any package, you MUST immediately commit the updated package.json:

  ```bash
  bun add some-package
  git add package.json bun.lock
  git commit -m "chore: add some-package dependency"
  ```

  Why: If package.json is not committed, the package will be lost when the sandbox restarts,
  causing "Cannot find package" errors on the next session.
</package_management>

<workflow>
  Project-wide strict workflow (MANDATORY, see root MEMORY.md for full details):

  1. Planning first — Always start in Plan Mode (or write a detailed plan). Never write code before the plan is approved.
  2. TDD — Write failing tests BEFORE any implementation (red → green). Only implement code that makes tests pass.
  3. Small vertical slices — Break every feature into tiny, independent, testable pieces.
  4. Update memory — After each piece, update CLAUDE.md / MEMORY.md with architecture decisions, constraints, and lessons.
  5. Self-review — After implementation, review your own code for simplicity, security, and maintainability.

  Never skip planning or tests on production features.
</workflow>

<payment-flow>
  NON-NEGOTIABLE (user spec): Customer MUST pay AFTER the technician accepts the job and BEFORE the technician can drive ("on_way") to the customer.

  - Backend /api/payments/create: rejects (400) unless job.status === "accepted" && paymentStatus !== "paid". Uses canCreatePayment helper.
  - Backend PATCH /api/jobs/:id/status "on_way": atomic updateMany claim (where status=accepted AND paymentStatus=paid) + pre-check. Returns 402/409 on violation. Matches webhook atomic style.
  - Pure helpers in src/lib/payment-gates.ts (TDD covered by backend/tests/payment-gates.test.ts).
  - DEV bulletproofing: POST /api/payments/simulate-paid/:jobId — only works if NO real GROW keys configured. Marks paid, notifies tech, for local testing the full flow. UI button in customer pay screen (clear "DEV" red warning).
  - Tech client (active-job): disables on_way button + shows waiting banner when accepted + !paid. Fast refetch (800ms). Early guard in handler.
  - Customer client: dedicated pay screen blocks tracking UI until paid. Polling detects real or simulated pay and flips state.
  - Tech cannot easily bypass (backend 402/409 + client); customer cannot pay early/double.
  - Update CLAUDE + MEMORY after any change touching this flow.
</payment-flow>

<qa>
  Deep QA specification for the complete customer + technician workflows (with fresh test accounts) lives in docs/QA-FULL-CUSTOMER-TECHNICIAN-WORKFLOWS.md (created while emulator built).
  - Section 1: Exact steps to provision brand-new Customer account and brand-new Technician account (sign-up Google/Apple → role-select cards → tech profile fields + isAvailable + isApproved + location so visible in customer searches).
  - Full happy path + every money-gate assertion (pre-accept pay blocked, on_way before paid blocked at pure + atomic + UI layers, 409 active-job redirect to payment page, real Grow payment via /payment WebView + poll, full lifecycle, reviews, earnings).
  - Dedicated edges section (races, cold starts, extra-repair, withdrawals atomics, RTL, photo mandatory, role routing verification, etc.).
  - Code inspection notes + self-review included. Run this doc end-to-end in the simulator with the two fresh accounts once the app launches.
  - Existing unit: only backend/tests/payment-gates.test.ts (must stay green with `bun test`).
</qa>

<admin-dashboard>
  Standalone HTML admin dashboard (outside the mobile app) added at GET /admin.
  - Protected by ADMIN_DASHBOARD_SECRET (set in env + Render).
  - Access: /admin?secret=... or bookmark /admin + in-page secret prompt (stored in sessionStorage).
  - Reuses all existing /api/admin/* routes (approve, revoke, pending, all technicians, delete).
  - The admin routes now also trust x-admin-secret header for calls coming from the dashboard HTML.
  - Current features (Slice 1): technician management (pending/approved lists, approve/revoke/delete), basic stats, Hebrew/RTL, Tailwind CDN, refresh, clean confirmations.
  - The in-app mobile admin screen and CLI script remain fully functional.
  - Future slices (per plan): richer stats, recent jobs view, CSV export.
  - Set ADMIN_DASHBOARD_SECRET in backend/.env and on Render (never commit the value).
</admin-dashboard>