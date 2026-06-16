#!/usr/bin/env bun

/**
 * Script to manage technicians
 *
 * Usage:
 *   bun scripts/manage-technicians.ts list     # List all pending technicians
 *   bun scripts/manage-technicians.ts approve <email>  # Approve a technician by email
 */

import { prisma } from "../src/prisma";

async function listPendingTechnicians() {
  const technicians = await prisma.user.findMany({
    where: {
      role: "technician",
      isApproved: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (technicians.length === 0) {
    console.log("✓ No pending technicians");
    return;
  }

  console.log(`\n📋 Pending Technicians (${technicians.length}):\n`);
  technicians.forEach((tech, index) => {
    console.log(`${index + 1}. ${tech.name}`);
    console.log(`   Email: ${tech.email}`);
    console.log(`   ID: ${tech.id}`);
    console.log(`   Created: ${tech.createdAt.toLocaleDateString()}`);
    console.log("");
  });
}

async function approveTechnician(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User with email ${email} not found`);
    process.exit(1);
  }

  if (user.role !== "technician") {
    console.error(`❌ User ${email} is not a technician (role: ${user.role})`);
    process.exit(1);
  }

  if (user.isApproved) {
    console.log(`✓ Technician ${email} is already approved`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: { isApproved: true },
  });

  console.log(`✓ Technician ${user.name} (${email}) has been approved!`);
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case "list":
      await listPendingTechnicians();
      break;
    case "approve":
      if (!arg) {
        console.error("❌ Please provide an email address");
        console.log("\nUsage: bun scripts/manage-technicians.ts approve <email>");
        process.exit(1);
      }
      await approveTechnician(arg);
      break;
    default:
      console.log("Technician Management");
      console.log("====================\n");
      console.log("Commands:");
      console.log("  list              List all pending technicians");
      console.log("  approve <email>   Approve a technician by email\n");
      console.log("Examples:");
      console.log("  bun scripts/manage-technicians.ts list");
      console.log("  bun scripts/manage-technicians.ts approve tech@example.com");
      break;
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
