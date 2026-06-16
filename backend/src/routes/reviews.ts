import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

type HonoEnv = {
  Variables: {
    user: any;
    session: any;
  };
};

export const reviewsRouter = new Hono<HonoEnv>();

const createReviewSchema = z.object({
  jobId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Submit a review for a completed job
reviewsRouter.post("/", zValidator("json", createReviewSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  if (user.role !== "customer") return c.json({ message: "Only customers can submit reviews" }, 403);

  try {
    const { jobId, rating, comment } = c.req.valid("json");

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return c.json({ message: "Job not found" }, 404);
    if (job.customerId !== user.id) return c.json({ message: "Not authorized" }, 403);
    if (job.status !== "completed") return c.json({ message: "Can only review completed jobs" }, 400);
    if (!job.technicianId) return c.json({ message: "No technician assigned to this job" }, 400);

    const existing = await prisma.review.findUnique({ where: { jobId } });
    if (existing) return c.json({ message: "Review already submitted for this job" }, 409);

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          jobId,
          customerId: user.id,
          technicianId: job.technicianId!,
          rating,
          comment: comment || null,
        },
        include: {
          customer: { select: { id: true, name: true, image: true } },
        },
      });

      const allReviews = await tx.review.findMany({
        where: { technicianId: job.technicianId! },
        select: { rating: true },
      });
      const avgRating = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : rating;
      await tx.user.update({
        where: { id: job.technicianId! },
        data: { rating: avgRating, totalReviews: allReviews.length },
      });

      return newReview;
    });

    return c.json({ review }, 201);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return c.json({ message: "Review already submitted for this job" }, 409);
    }
    console.error("Error creating review:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get reviews for a technician
reviewsRouter.get("/technician/:technicianId", async (c) => {
  const technicianId = c.req.param("technicianId");

  try {
    const reviews = await prisma.review.findMany({
      where: { technicianId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { id: true, name: true, image: true } },
      },
    });

    return c.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Check if a job has been reviewed
reviewsRouter.get("/job/:jobId", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const jobId = c.req.param("jobId");

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { customerId: true, technicianId: true } });
    if (!job) return c.json({ review: null });
    if (job.customerId !== user.id && job.technicianId !== user.id) {
      return c.json({ message: "Not authorized" }, 403);
    }
    const review = await prisma.review.findUnique({
      where: { jobId },
      include: {
        customer: { select: { id: true, name: true, image: true } },
      },
    });

    return c.json({ review: review || null });
  } catch (error) {
    console.error("Error fetching review:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});
