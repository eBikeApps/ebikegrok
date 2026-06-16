import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { sendPushNotification, sendPushNotificationToMany } from "../lib/push-notifications";
import { canTransitionToOnWay } from "../lib/payment-gates";
import { createJobSchema } from "../lib/job-create-schema";

const updateStatusSchema = z.object({
  status: z.enum(["accepted", "on_way", "arrived", "in_progress", "completed", "cancelled"]),
  finalPrice: z.number().min(0).max(50000).optional(),
});

type HonoEnv = {
  Variables: {
    user: any;
    session: any;
  };
};

export const jobsRouter = new Hono<HonoEnv>();

// Create a new job (customer only)
jobsRouter.post("/", zValidator("json", createJobSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "customer") {
    return c.json({ message: "Only customers can create jobs" }, 403);
  }

  try {
    const {
      technicianId,
      photoUrl,
      description,
      bikeType,
      category,
      estimatedPriceMin,
      estimatedPriceMax,
      customerLocationLat,
      customerLocationLng,
      customerAddress,
      customerName,
      customerPhone,
    } = c.req.valid("json");

    if (customerName?.trim() || customerPhone?.trim()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(customerName?.trim() ? { name: customerName.trim() } : {}),
          ...(customerPhone?.trim() ? { phone: customerPhone.trim() } : {}),
        },
      });
    }

    const jobDescription = description || `תיקון ${bikeType === 'electric' ? 'אופניים חשמליים' : 'קורקינט'} - ${category}`;

    // Block creating a new job if the customer already has an active one
    const existingActive = await prisma.job.findFirst({
      where: {
        customerId: user.id,
        status: { in: ["pending", "accepted", "on_way", "arrived", "in_progress"] },
      },
      select: { id: true, status: true },
    });
    if (existingActive) {
      return c.json(
        {
          message: "כבר יש לך הזמנה פעילה. סיים או בטל אותה לפני יצירת הזמנה חדשה.",
          activeJobId: existingActive.id,
          activeJobStatus: existingActive.status,
        },
        409
      );
    }

    // If a technician is specified, verify they exist and are available
    if (technicianId) {
      const technician = await prisma.user.findUnique({
        where: { id: technicianId, role: "technician", isApproved: true },
      });
      if (!technician) {
        return c.json({ message: "Technician not found or not available" }, 404);
      }
    }

    const job = await prisma.job.create({
      data: {
        customerId: user.id,
        technicianId: technicianId || null,
        status: "pending",
        photoUrl: photoUrl || null,
        description: jobDescription,
        bikeType,
        category,
        estimatedPriceMin: estimatedPriceMin || 0,
        estimatedPriceMax: estimatedPriceMax || 0,
        customerLocationLat,
        customerLocationLng,
        customerAddress: customerAddress || null,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, image: true, phone: true },
        },
        technician: {
          select: {
            id: true, name: true, email: true, image: true, phone: true,
            rating: true, totalReviews: true, vehicleType: true, basePrice: true,
            currentLocationLat: true, currentLocationLng: true,
          },
        },
      },
    });

    // Notify technician(s) about the new job
    try {
      const bikeLabel = bikeType === "electric" ? "אופניים חשמליים" : "אופניים רגילים";
      const customerName = job.customer?.name ?? "לקוח";

      if (technicianId) {
        // Notify the specific assigned technician
        const techWithToken = await prisma.user.findUnique({
          where: { id: technicianId },
          select: { expoPushToken: true },
        });
        if (techWithToken?.expoPushToken) {
          await sendPushNotification(
            techWithToken.expoPushToken,
            "🔔 בקשת תיקון חדשה!",
            `${customerName} מחכה לעזרה עם ${bikeLabel}`,
            { jobId: job.id, screen: "/(technician)/(tabs)" }
          );
        }
      } else {
        // Broadcast to ALL approved available technicians
        const technicians = await prisma.user.findMany({
          where: { role: "technician", isApproved: true, expoPushToken: { not: null } },
          select: { expoPushToken: true },
        });
        const tokens = technicians.map((t) => t.expoPushToken).filter(Boolean) as string[];
        if (tokens.length > 0) {
          await sendPushNotificationToMany(
            tokens,
            "🔔 הזמנה חדשה!",
            `${customerName} צריך עזרה עם ${bikeLabel} - לחץ לקבל`,
            { jobId: job.id, screen: "/(technician)/(tabs)" }
          );
        }
      }
    } catch (pushErr) {
      console.error("[Push] Error sending job notification:", pushErr);
    }

    return c.json({ job }, 201);
  } catch (error) {
    console.error("Error creating job:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get a single job by ID
jobsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");

  try {
    const job = await prisma.job.findFirst({
      where: {
        id,
        OR: [{ customerId: user.id }, { technicianId: user.id }],
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, image: true, phone: true },
        },
        technician: {
          select: {
            id: true, name: true, email: true, image: true, phone: true,
            rating: true, totalReviews: true, vehicleType: true, basePrice: true,
            currentLocationLat: true, currentLocationLng: true,
          },
        },
      },
    });

    if (!job) return c.json({ message: "Job not found" }, 404);

    return c.json({ job });
  } catch (error) {
    console.error("Error fetching job:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// List jobs for the authenticated user
jobsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  try {
    const where =
      user.role === "customer"
        ? { customerId: user.id }
        : {
            OR: [
              { technicianId: user.id },
              { status: "pending", technicianId: null },
            ],
          };

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: {
          select: { id: true, name: true, email: true, image: true, phone: true },
        },
        technician: {
          select: {
            id: true, name: true, email: true, image: true, phone: true,
            rating: true, totalReviews: true, vehicleType: true, basePrice: true,
            currentLocationLat: true, currentLocationLng: true,
          },
        },
      },
    });

    return c.json({ jobs });
  } catch (error) {
    console.error("Error listing jobs:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get the customer's currently active job (if any)
jobsRouter.get("/customer/active", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "customer") {
    return c.json({ job: null });
  }

  try {
    const job = await prisma.job.findFirst({
      where: {
        customerId: user.id,
        status: { in: ["pending", "accepted", "on_way", "arrived", "in_progress"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true, image: true, phone: true },
        },
        technician: {
          select: {
            id: true, name: true, email: true, image: true, phone: true,
            rating: true, totalReviews: true, vehicleType: true, basePrice: true,
            currentLocationLat: true, currentLocationLng: true,
          },
        },
      },
    });

    return c.json({ job: job || null });
  } catch (error) {
    console.error("Error fetching customer active job:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get pending jobs for a technician (for polling)
jobsRouter.get("/technician/pending", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  try {
    // Find pending jobs assigned to this technician
    const job = await prisma.job.findFirst({
      where: {
        technicianId: user.id,
        status: "pending",
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: {
          // B08 FIX: do NOT expose customer phone/email until the technician
          // has accepted. Pre-acceptance the technician shouldn't be able to
          // contact the customer out-of-band.
          select: { id: true, name: true, image: true },
        },
      },
    });

    return c.json({ job: job || null });
  } catch (error) {
    console.error("Error fetching pending job:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Update job status (technician accepts/declines/progresses, customer cancels)
jobsRouter.patch("/:id/status", zValidator("json", updateStatusSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");

  try {
    const { status, finalPrice } = c.req.valid("json");

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ message: "Job not found" }, 404);

    // Authorization: customer can only cancel, technician can progress
    if (user.role === "customer" && job.customerId !== user.id) {
      return c.json({ message: "Not authorized" }, 403);
    }
    // Technician can act on their assigned job, OR accept an unassigned pending job
    if (user.role === "technician" && job.technicianId !== null && job.technicianId !== user.id) {
      return c.json({ message: "Not authorized" }, 403);
    }

    // State machine: validate allowed transitions
    const validTransitions: Record<string, string[]> = {
      pending:     ["accepted", "cancelled"],
      accepted:    ["on_way", "cancelled"],
      on_way:      ["arrived", "cancelled"],
      arrived:     ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed:   [],
      cancelled:   [],
    };
    const allowed = validTransitions[job.status] ?? [];
    if (!allowed.includes(status)) {
      return c.json({ message: `לא ניתן לעבור מ-${job.status} ל-${status}` }, 400);
    }

    // Validate status transitions
    const customerAllowed = ["cancelled", "in_progress"];

    if (user.role === "customer" && !customerAllowed.includes(status)) {
      return c.json({ message: "Customers can only cancel jobs or confirm arrival" }, 400);
    }

    // Customer can only confirm arrival (arrived → in_progress)
    if (user.role === "customer" && status === "in_progress" && job.status !== "arrived") {
      return c.json({ message: "ניתן לאשר הגעה רק כאשר הטכנאי הגיע" }, 400);
    }

    const updateData: any = { status };

    if (status === "accepted") {
      updateData.acceptedAt = new Date();
      // Store technician location at time of acceptance
      const tech = await prisma.user.findUnique({
        where: { id: user.id },
        select: { currentLocationLat: true, currentLocationLng: true, name: true },
      });
      if (tech?.currentLocationLat) {
        updateData.technicianLocationLat = tech.currentLocationLat;
        updateData.technicianLocationLng = tech.currentLocationLng;
      }

      // S02 FIX: Atomic claim to prevent race condition - two technicians cannot
      // accept the same job. updateMany with status='pending' acts as an optimistic lock.
      if (!job.technicianId) {
        const claimResult = await prisma.job.updateMany({
          where: { id, status: "pending", technicianId: null },
          data: { ...updateData, technicianId: user.id },
        });
        if (claimResult.count === 0) {
          return c.json({ message: "העבודה כבר נלקחה על ידי טכנאי אחר" }, 409);
        }
        // Mark technician unavailable so they don't receive new job requests
        await prisma.user.update({
          where: { id: user.id },
          data: { isAvailable: false },
        });
        // Send push notification to customer asking them to pay
        try {
          const customerWithToken = await prisma.user.findUnique({
            where: { id: job.customerId },
            select: { expoPushToken: true },
          });
          if (customerWithToken?.expoPushToken) {
            const techName = tech?.name || 'הטכנאי';
            await sendPushNotification(
              customerWithToken.expoPushToken,
              '✅ הטכנאי מוכן לצאת אליך!',
              `${techName} מחכה לתשלום - שלם עכשיו כדי לאשר את הביקור`,
              { jobId: id, screen: 'job-tracking' }
            );
          }
        } catch (pushErr) {
          console.error('[Push] Error sending acceptance notification to customer:', pushErr);
        }
        // Return early - claim already applied via updateMany
        const updatedJob = await prisma.job.findUnique({ where: { id } });
        return c.json({ job: updatedJob });
      }

      // Notify the customer that their job was accepted (already-assigned path)
      try {
        const customerWithToken = await prisma.user.findUnique({
          where: { id: job.customerId },
          select: { expoPushToken: true },
        });
        if (customerWithToken?.expoPushToken) {
          const techName = tech?.name || 'הטכנאי';
          await sendPushNotification(
            customerWithToken.expoPushToken,
            '✅ הטכנאי מוכן לצאת אליך!',
            `${techName} מחכה לתשלום - שלם עכשיו כדי לאשר את הביקור`,
            { jobId: id, screen: 'job-tracking' }
          );
        }
      } catch (pushErr) {
        console.error('[Push] Error sending acceptance notification to customer:', pushErr);
      }
    }

    if (status === "on_way") {
      // Slice 1: Pre-check using the pure helper (clear error) + atomic claim below.
      const gate = canTransitionToOnWay({
        id: job.id,
        status: job.status,
        paymentStatus: job.paymentStatus,
      });
      if (!gate.ok) {
        return c.json({ message: gate.error }, 402);
      }

      // Atomic "paid before drive" gate (customer must pay after accept, before technician drives).
      // Use updateMany with the exact predicate (accepted + paid) so concurrent attempts are safe
      // (only one succeeds; mirrors the webhook paid claim pattern).
      const onWayClaim = await prisma.job.updateMany({
        where: {
          id,
          status: "accepted",
          paymentStatus: "paid",
        },
        data: {
          status: "on_way",
          onWayAt: new Date(),
        },
      });
      if (onWayClaim.count === 0) {
        // Either not in the right state, not paid, or already moved. Return a clear client-friendly error.
        return c.json({ message: "לא ניתן לצאת לדרך לפני שהלקוח שילם או שההזמנה כבר התקדמה" }, 409);
      }
      // Success: the atomic update already set on_way. Skip the later generic update for this path.
      // Re-fetch for response (include relations like the normal path).
      const updated = await prisma.job.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, name: true, email: true, image: true, phone: true } },
          technician: {
            select: {
              id: true, name: true, email: true, image: true, phone: true,
              rating: true, totalReviews: true, vehicleType: true, basePrice: true,
              currentLocationLat: true, currentLocationLng: true,
            },
          },
        },
      });
      return c.json({ job: updated });
    }

    if (status === "arrived") {
      updateData.arrivedAt = new Date();
    }

    if (status === "in_progress") {
      updateData.inProgressAt = new Date();
    }

    if (status === "completed") {
      updateData.completedAt = new Date();
      if (finalPrice !== undefined) updateData.finalPrice = finalPrice;

      if (job.technicianId) {
        const price = finalPrice !== undefined ? finalPrice : (job.estimatedPriceMin ?? 0);
        const jobWithSecondary = await prisma.job.findUnique({
          where: { id: job.id },
          select: { secondaryTechnicianId: true },
        });
        const secondaryTechId = jobWithSecondary?.secondaryTechnicianId;

        if (secondaryTechId) {
          // Split earnings: 50/50, call-out fee deducted from primary's share.
          // B07 FIX: clamp callOutFee so primaryEarning can never go negative.
          // Without this, a secondary tech with a huge callOutFee + small job
          // produces negative earnings for the primary and overpays secondary.
          const secondaryTech = await prisma.user.findUnique({
            where: { id: secondaryTechId },
            select: { callOutFee: true },
          });
          const half = Math.floor(price / 2);
          const callOutFee = Math.max(0, Math.min(secondaryTech?.callOutFee ?? 50, half));
          const primaryEarning = Math.max(0, half - callOutFee);
          const secondaryEarning = price - primaryEarning;

          await prisma.$transaction([
            prisma.transaction.create({
              data: { technicianId: job.technicianId, jobId: job.id, type: "earning", amount: primaryEarning, status: "completed" },
            }),
            prisma.user.update({
              where: { id: job.technicianId },
              data: { totalEarnings: { increment: primaryEarning } },
            }),
            prisma.transaction.create({
              data: { technicianId: secondaryTechId, jobId: job.id, type: "earning", amount: secondaryEarning, status: "completed" },
            }),
            prisma.user.update({
              where: { id: secondaryTechId },
              data: { totalEarnings: { increment: secondaryEarning } },
            }),
          ]);
        } else {
          // Single technician - full earnings
          await prisma.$transaction([
            prisma.transaction.create({
              data: { technicianId: job.technicianId, jobId: job.id, type: "earning", amount: price, status: "completed" },
            }),
            prisma.user.update({
              where: { id: job.technicianId },
              data: { totalEarnings: { increment: price } },
            }),
          ]);
        }
      }
    }

    // Block customer from cancelling after payment has been made
    if (status === "cancelled" && user.role === "customer" && job.paymentStatus === "paid") {
      return c.json({ message: "לא ניתן לבטל הזמנה לאחר ביצוע תשלום" }, 400);
    }

    if (status === "cancelled") {
      updateData.cancelledAt = new Date();

      // Notify the other party about the cancellation
      try {
        if (user.role === "customer" && job.technicianId) {
          // Customer cancelled — notify the technician
          const tech = await prisma.user.findUnique({
            where: { id: job.technicianId },
            select: { expoPushToken: true },
          });
          if (tech?.expoPushToken) {
            await sendPushNotification(
              tech.expoPushToken,
              "❌ ההזמנה בוטלה",
              "הלקוח ביטל את ההזמנה",
              { jobId: id, screen: "/(technician)/(tabs)" }
            );
          }
        } else if (user.role === "technician") {
          // Technician cancelled — notify the customer
          const customer = await prisma.user.findUnique({
            where: { id: job.customerId },
            select: { expoPushToken: true },
          });
          if (customer?.expoPushToken) {
            await sendPushNotification(
              customer.expoPushToken,
              "❌ הטכנאי ביטל",
              "הטכנאי לא יכול להגיע. מחפש טכנאי אחר...",
              { jobId: id, screen: "job-tracking" }
            );
          }
        }
      } catch (pushErr) {
        console.error("[Push] Error sending cancellation notification:", pushErr);
      }
    }

    const updatedJob = await prisma.job.update({

      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true, email: true, image: true, phone: true },
        },
        technician: {
          select: {
            id: true, name: true, email: true, image: true, phone: true,
            rating: true, totalReviews: true, vehicleType: true, basePrice: true,
            currentLocationLat: true, currentLocationLng: true,
          },
        },
      },
    });

    return c.json({ job: updatedJob });
  } catch (error) {
    console.error("Error updating job status:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// ── Job Invitations ──────────────────────────────────────────────────────────

// POST /api/jobs/:id/invite — primary technician invites another technician
jobsRouter.post("/:id/invite", zValidator("json", z.object({ inviteeId: z.string() })), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  if (user.role !== "technician") return c.json({ message: "Only technicians can invite" }, 403);

  const jobId = c.req.param("id");
  const { inviteeId } = c.req.valid("json");

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return c.json({ message: "Job not found" }, 404);
    if (job.technicianId !== user.id) return c.json({ message: "Only the assigned technician can invite" }, 403);
    if (!["in_progress", "arrived", "accepted", "on_way"].includes(job.status)) {
      return c.json({ message: "Can only invite during an active job" }, 400);
    }
    if (job.secondaryTechnicianId) return c.json({ message: "A secondary technician is already assigned" }, 400);

    const invitee = await prisma.user.findUnique({
      where: { id: inviteeId, role: "technician", isApproved: true },
      select: { id: true, name: true, expoPushToken: true, callOutFee: true },
    });
    if (!invitee) return c.json({ message: "Technician not found" }, 404);

    // Remove any existing pending invitations for this job
    await prisma.jobInvitation.deleteMany({
      where: { jobId, status: "pending" },
    });

    const invitation = await prisma.jobInvitation.create({
      data: { jobId, inviterId: user.id, inviteeId, status: "pending" },
      include: {
        job: { select: { description: true, category: true, bikeType: true } },
        inviter: { select: { name: true } },
        invitee: { select: { name: true, callOutFee: true } },
      },
    });

    // Push notification to invitee
    if (invitee.expoPushToken) {
      await sendPushNotification(
        invitee.expoPushToken,
        "🤝 הזמנה לשיתוף עבודה",
        `${user.name} מזמין אותך לעזור בתיקון - דמי יציאה: ₪${invitee.callOutFee ?? 50}`,
        { invitationId: invitation.id, screen: "/(technician)/invitations" }
      ).catch(console.error);
    }

    return c.json({ invitation }, 201);
  } catch (error) {
    console.error("Error creating invitation:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// GET /api/jobs/invitations — get pending invitations for current technician
jobsRouter.get("/invitations/pending", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  if (user.role !== "technician") return c.json({ message: "Not authorized" }, 403);

  try {
    const invitations = await prisma.jobInvitation.findMany({
      where: { inviteeId: user.id, status: "pending" },
      include: {
        job: {
          include: {
            customer: { select: { id: true, name: true, image: true } },
            technician: { select: { id: true, name: true, image: true, rating: true } },
          },
        },
        inviter: { select: { id: true, name: true, image: true, rating: true, callOutFee: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ invitations });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// PATCH /api/jobs/invitations/:invitationId — accept or reject
jobsRouter.patch("/invitations/:invitationId", zValidator("json", z.object({ action: z.enum(["accepted", "rejected"]) })), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  if (user.role !== "technician") return c.json({ message: "Not authorized" }, 403);

  const invitationId = c.req.param("invitationId");
  const { action } = c.req.valid("json");

  try {
    const invitation = await prisma.jobInvitation.findUnique({
      where: { id: invitationId },
      include: {
        job: true,
        inviter: { select: { name: true, expoPushToken: true } },
      },
    });
    if (!invitation) return c.json({ message: "Invitation not found" }, 404);
    if (invitation.inviteeId !== user.id) return c.json({ message: "Not authorized" }, 403);
    if (invitation.status !== "pending") return c.json({ message: "Invitation already responded to" }, 400);

    await prisma.jobInvitation.update({ where: { id: invitationId }, data: { status: action } });

    if (action === "accepted") {
      await prisma.job.update({
        where: { id: invitation.jobId },
        data: { secondaryTechnicianId: user.id },
      });
    }

    // Notify the inviter
    if (invitation.inviter.expoPushToken) {
      const msg = action === "accepted"
        ? `${user.name} קיבל את ההזמנה ובדרך אליך!`
        : `${user.name} דחה את ההזמנה`;
      await sendPushNotification(
        invitation.inviter.expoPushToken,
        action === "accepted" ? "✅ הטכנאי הצטרף!" : "❌ ההזמנה נדחתה",
        msg,
        { jobId: invitation.jobId, screen: "/(technician)/active-job" }
      ).catch(console.error);
    }

    return c.json({ success: true, action });
  } catch (error) {
    console.error("Error responding to invitation:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});
