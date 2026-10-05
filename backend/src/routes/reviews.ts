import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { reviewGate } from "../lib/review-rules";

type HonoEnv = {
  Variables: {
    user: any;
    session: any;
  };
};

export const reviewsRouter = new Hono<HonoEnv>();

function firstName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

const reviewListInclude = {
  customer: { select: { id: true, name: true, image: true } },
  technician: { select: { id: true, name: true, image: true, rating: true, totalReviews: true } },
} as const;

function serializeReview<T extends { customer?: { name: string | null } | null }>(review: T) {
  if (!review.customer) return review;
  return {
    ...review,
    customer: {
      ...review.customer,
      name: firstName(review.customer.name) ?? review.customer.name,
    },
  };
}

const createReviewSchema = z.object({
  jobId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

async function recomputeTechnicianRating(tx: Prisma.TransactionClient, technicianId: string) {
  const stats = await tx.review.aggregate({
    where: { technicianId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const total = stats._count.rating;
  const rating = total > 0 ? Math.round((stats._avg.rating ?? 0) * 10) / 10 : 0;
  await tx.user.update({
    where: { id: technicianId },
    data: { rating, totalReviews: total },
  });
}

// Submit a review for a completed repair. One review per job, customer only.
reviewsRouter.post("/", zValidator("json", createReviewSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  try {
    const { jobId, rating, comment } = c.req.valid("json");
    const trimmedComment = comment?.trim() || null;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, technicianId: true, status: true },
    });
    const existing = job
      ? await prisma.review.findUnique({ where: { jobId }, select: { id: true } })
      : null;
    const gate = reviewGate({
      role: user.role,
      userId: user.id,
      job,
      alreadyReviewed: !!existing,
    });
    if (!gate.ok) return c.json({ message: gate.message }, gate.status);

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          jobId,
          customerId: user.id,
          technicianId: gate.technicianId,
          rating,
          comment: trimmedComment,
        },
        include: {
          customer: { select: { id: true, name: true, image: true } },
        },
      });
      await recomputeTechnicianRating(tx, gate.technicianId);
      return newReview;
    });

    return c.json({ review: serializeReview(review) }, 201);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return c.json({ message: "כבר השארת ביקורת על התיקון הזה" }, 409);
    }
    console.error("Error creating review:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Latest reviews across technicians — public social proof for customers
reviewsRouter.get("/recent", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? 40);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 80) : 40;

  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: reviewListInclude,
    });
    return c.json({ reviews: reviews.map(serializeReview) });
  } catch (error) {
    console.error("Error fetching recent reviews:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get reviews for a technician
reviewsRouter.get("/technician/:technicianId", async (c) => {
  const technicianId = c.req.param("technicianId");

  try {
    const [reviews, stats] = await Promise.all([
      prisma.review.findMany({
        where: { technicianId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: reviewListInclude,
      }),
      prisma.review.aggregate({
        where: { technicianId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    const total = stats._count.rating;
    const averageRating =
      total > 0 ? Math.round((stats._avg.rating ?? 0) * 10) / 10 : 0;

    return c.json({
      reviews: reviews.map(serializeReview),
      averageRating,
      totalReviews: total,
    });
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
