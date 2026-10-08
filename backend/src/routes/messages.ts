import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { sendPushNotification } from "../lib/push-notifications";

type HonoEnv = {
  Variables: { user: any; session: any };
};

export const messagesRouter = new Hono<HonoEnv>();

// GET /api/jobs/:jobId/messages — list all messages for a job
messagesRouter.get("/:jobId/messages", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const jobId = c.req.param("jobId");

  // Verify user is a participant in this job
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      OR: [{ customerId: user.id }, { technicianId: user.id }],
    },
    select: { id: true },
  });

  if (!job) return c.json({ message: "Job not found" }, 404);

  const messages = await prisma.message.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, image: true, role: true } },
    },
  });

  return c.json({ messages });
});

// POST /api/jobs/:jobId/messages — send a message
messagesRouter.post(
  "/:jobId/messages",
  zValidator("json", z.object({ text: z.string().min(1).max(1000) })),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);

    const jobId = c.req.param("jobId");
    const { text } = c.req.valid("json");

    // Verify user is a participant
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        OR: [{ customerId: user.id }, { technicianId: user.id }],
      },
      select: { id: true, customerId: true, technicianId: true, secondaryTechnicianId: true },
    });

    if (!job) return c.json({ message: "Job not found" }, 404);

    const message = await prisma.message.create({
      data: { jobId, senderId: user.id, text },
      include: {
        sender: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    try {
      const recipientIds = [job.customerId, job.technicianId, job.secondaryTechnicianId].filter(
        (recipientId): recipientId is string => !!recipientId && recipientId !== user.id
      );
      const senderName = message.sender?.name?.trim() || "הודעה חדשה";
      const preview = text.trim().replace(/\s+/g, " ").slice(0, 80);
      await Promise.all(
        recipientIds.map(async (recipientId) => {
          const recipient = await prisma.user.findUnique({
            where: { id: recipientId },
            select: { expoPushToken: true, role: true },
          });
          if (!recipient?.expoPushToken) return;
          await sendPushNotification(
            recipient.expoPushToken,
            senderName,
            preview,
            { jobId, screen: recipient.role === "technician" ? "active-job" : "job-tracking" }
          );
        })
      );
    } catch (error) {
      console.error("[Push] chat notification error:", error);
    }

    return c.json({ message }, 201);
  }
);
