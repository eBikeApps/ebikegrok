import { prisma } from "../src/prisma";

async function seedTechnicians() {
  console.log("Starting to seed technicians...");

  const technicians = [
    {
      id: "tech-seed-1",
      name: "יוסי כהן",
      email: "yossi.cohen@example.com",
      role: "technician",
      isApproved: true,
      phone: "+972501234567",
      bio: "טכנאי אופניים מקצועי עם 10 שנות ניסיון. מתמחה באופניים חשמליים ותיקוני חירום.",
      rating: 4.8,
      totalReviews: 127,
      vehicleType: "אופנוע + ציוד נייד",
      serviceRadius: 15,
      isAvailable: true,
      currentLocationLat: 32.0853,
      currentLocationLng: 34.7818,
      basePrice: 50,
      totalEarnings: 0,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    },
    {
      id: "tech-seed-2",
      name: "דוד לוי",
      email: "david.levy@example.com",
      role: "technician",
      isApproved: true,
      phone: "+972502345678",
      bio: "מומחה לתיקוני פנצ'רים ובלמים. שירות מהיר ואמין.",
      rating: 4.6,
      totalReviews: 89,
      vehicleType: "רכב + ציוד מלא",
      serviceRadius: 20,
      isAvailable: true,
      currentLocationLat: 32.0789,
      currentLocationLng: 34.7723,
      basePrice: 45,
      totalEarnings: 0,
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
    },
    {
      id: "tech-seed-3",
      name: "משה אברהם",
      email: "moshe.abraham@example.com",
      role: "technician",
      isApproved: true,
      phone: "+972503456789",
      bio: "טכנאי מוסמך לאופניים חשמליים. מתמחה בבעיות סוללה ומנוע.",
      rating: 4.9,
      totalReviews: 156,
      vehicleType: "אופנוע",
      serviceRadius: 12,
      isAvailable: true,
      currentLocationLat: 32.0921,
      currentLocationLng: 34.7896,
      basePrice: 60,
      totalEarnings: 0,
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    },
  ];

  for (const tech of technicians) {
    try {
      // Check if technician already exists
      const existing = await prisma.user.findUnique({
        where: { id: tech.id },
      });

      if (existing) {
        console.log(`Technician ${tech.name} already exists, updating...`);
        await prisma.user.update({
          where: { id: tech.id },
          data: tech,
        });
      } else {
        console.log(`Creating technician ${tech.name}...`);
        await prisma.user.create({
          data: tech,
        });
      }
    } catch (error) {
      console.error(`Error seeding technician ${tech.name}:`, error);
    }
  }

  console.log("Finished seeding technicians!");
}

seedTechnicians()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding technicians:", error);
    process.exit(1);
  });
