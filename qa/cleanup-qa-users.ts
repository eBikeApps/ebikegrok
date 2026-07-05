/**
 * Remove QA test accounts from production DB.
 * Run: bun run qa/cleanup-qa-users.ts
 * Keeps: tech-test@ebike.com, a@abc.com, maortest@ebike.com, arielyakobov@gmail.com
 */
import { prisma } from "../backend/src/prisma";

const KEEP_EMAILS = new Set([
  "tech-test@ebike.com",
  "a@abc.com",
  "maortest@ebike.com",
  "arielyakobov@gmail.com",
  "maort@ebike.com",
  "ebikelandapp@gmail.com",
]);

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@ebike.test" } },
        { name: { in: ["QA Technician", "QA Customer", "QA Tech", "Flow Customer", "Probe User"] } },
        { email: { startsWith: "qa-" } },
        { email: { startsWith: "flow-" } },
        { email: { startsWith: "probe-" } },
      ],
    },
    select: { id: true, email: true, name: true, role: true },
  });

  const toDelete = candidates.filter((u) => !KEEP_EMAILS.has(u.email ?? ""));
  console.log(`Found ${candidates.length} QA candidates, deleting ${toDelete.length}:`);
  for (const u of toDelete) {
    console.log(`  - ${u.email} (${u.name}, ${u.role})`);
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const ids = toDelete.map((u) => u.id);
  const deleted = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${deleted.count} users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());