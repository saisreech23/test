import bcrypt from "bcryptjs";
import { prisma } from "./db";

async function seed() {
  const password = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "analyst@logsentry.com" },
    update: {},
    create: {
      email: "analyst@logsentry.com",
      password,
      name: "SOC Analyst",
    },
  });

  console.log("Seed complete. Demo user: analyst@logsentry.com / password123");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
