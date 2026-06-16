import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const updateProfileSchema = z.object({
  phone: z.string().max(20).optional(),
  bio: z.string().max(500).optional(),
  vehicleType: z.string().max(100).optional(),
  serviceRadius: z.number().min(1).max(200).optional(),
  isAvailable: z.boolean().optional(),
  currentLocationLat: z.number().min(-90).max(90).optional(),
  currentLocationLng: z.number().min(-180).max(180).optional(),
  basePrice: z.number().min(0).max(50000).optional(),
});

const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

type HonoEnv = {
  Variables: {
    user: any;
    session: any;
  };
};

export const techniciansRouter = new Hono<HonoEnv>();

const availableQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

// Get available technicians (requires authentication — phone numbers are PII)
techniciansRouter.get("/available", zValidator("query", availableQuerySchema), async (c) => {
  // S07 FIX: Require authentication. Phone numbers are PII and should not be public.
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  try {
    const { lat, lng } = c.req.valid("query");

    // Get all approved technicians with required profile fields
    const technicians = await prisma.user.findMany({
      where: {
        role: "technician",
        isApproved: true,
        isAvailable: true,
        currentLocationLat: { not: null },
        currentLocationLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        image: true,
        // phone intentionally excluded — only revealed after a job is accepted
        bio: true,
        rating: true,
        totalReviews: true,
        vehicleType: true,
        serviceRadius: true,
        isAvailable: true,
        currentLocationLat: true,
        currentLocationLng: true,
        basePrice: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate distance if customer location provided
    let techniciansWithDistance = technicians;
    if (lat !== undefined && lng !== undefined) {
      const customerLat = lat;
      const customerLng = lng;

      techniciansWithDistance = technicians
        .map((tech) => {
          const distance = calculateDistance(
            customerLat,
            customerLng,
            tech.currentLocationLat!,
            tech.currentLocationLng!
          );

          // Filter by service radius (minimum 1km)
          if (distance > Math.max(tech.serviceRadius || 15, 1)) {
            return null;
          }

          const eta = estimateArrivalTime(distance);

          return {
            ...tech,
            distance,
            eta,
          };
        })
        .filter((tech) => tech !== null);
    }

    return c.json({ technicians: techniciansWithDistance });
  } catch (error) {
    console.error("Error fetching technicians:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get technician by ID (requires authentication; phone only revealed to assigned customer)
techniciansRouter.get("/:id", async (c) => {
  // S07 FIX: Require authentication
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");

  try {
    // Check if requesting user is the customer/technician of an active job with this tech
    const hasActiveJob = user.role === "customer"
      ? await prisma.job.findFirst({
          where: {
            customerId: user.id,
            technicianId: id,
            status: { in: ["accepted", "on_way", "arrived", "in_progress"] },
          },
          select: { id: true },
        })
      : null;
    const canSeePhone = hasActiveJob !== null || user.id === id;

    const technician = await prisma.user.findUnique({
      where: { id, role: "technician" },
      select: {
        id: true,
        name: true,
        image: true,
        phone: canSeePhone, // S07: phone only when customer has active job with this tech
        bio: true,
        rating: true,
        totalReviews: true,
        vehicleType: true,
        serviceRadius: true,
        isAvailable: true,
        currentLocationLat: true,
        currentLocationLng: true,
        basePrice: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!technician) {
      return c.json({ message: "Technician not found" }, 404);
    }

    return c.json({ technician });
  } catch (error) {
    console.error("Error fetching technician:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Update technician profile (only for authenticated technician)
techniciansRouter.patch("/profile", zValidator("json", updateProfileSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  try {
    const {
      phone,
      bio,
      vehicleType,
      serviceRadius,
      isAvailable,
      currentLocationLat,
      currentLocationLng,
      basePrice,
    } = c.req.valid("json");

    const updatedTechnician = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        bio,
        vehicleType,
        serviceRadius,
        isAvailable,
        currentLocationLat,
        currentLocationLng,
        basePrice,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        bio: true,
        rating: true,
        totalReviews: true,
        vehicleType: true,
        serviceRadius: true,
        isAvailable: true,
        currentLocationLat: true,
        currentLocationLng: true,
        basePrice: true,
        totalEarnings: true,
      },
    });

    return c.json({ technician: updatedTechnician });
  } catch (error) {
    console.error("Error updating technician profile:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Update technician availability
techniciansRouter.patch("/availability", zValidator("json", updateAvailabilitySchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  if (!user.isApproved) {
    return c.json({ message: "Technician not approved yet" }, 403);
  }

  try {
    const { isAvailable } = c.req.valid("json");

    const updatedTechnician = await prisma.user.update({
      where: { id: user.id },
      data: { isAvailable },
      select: {
        id: true,
        isAvailable: true,
      },
    });

    return c.json({ technician: updatedTechnician });
  } catch (error) {
    console.error("Error updating technician availability:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Update technician location
techniciansRouter.patch("/location", zValidator("json", updateLocationSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  if (!user.isApproved) {
    return c.json({ message: "Technician not approved yet" }, 403);
  }

  try {
    const { lat, lng } = c.req.valid("json");

    const updatedTechnician = await prisma.user.update({
      where: { id: user.id },
      data: {
        currentLocationLat: lat,
        currentLocationLng: lng,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        currentLocationLat: true,
        currentLocationLng: true,
      },
    });

    return c.json({ technician: updatedTechnician });
  } catch (error) {
    console.error("Error updating technician location:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to estimate arrival time based on distance
function estimateArrivalTime(distanceKm: number): number {
  // Assume average speed of 25 km/h in city
  const baseMinutes = Math.ceil((distanceKm / 25) * 60);
  // Add 5 minutes for preparation
  return baseMinutes + 5;
}
