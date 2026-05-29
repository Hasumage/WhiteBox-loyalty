import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { seedProfileStatuses } from "./profile-status-seed-data.mjs";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await seedProfileStatuses(prisma);
    await prisma.platformCounter.upsert({
      where: { key: "top100_client_registrations" },
      create: { key: "top100_client_registrations", value: 0 },
      update: {},
    });
    console.log("Profile statuses seeded.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
