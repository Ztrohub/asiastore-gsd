import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function upsertUser(
  username: string,
  rawPassword: string,
  role: "OWNER" | "CASHIER",
) {
  const passwordHash = await hashPassword(rawPassword);

  await prisma.user.upsert({
    where: { username },
    update: {
      role,
      passwordHash,
      passwordVersion: 1,
      isActive: true,
      lastCredentialChangeAt: new Date(),
    },
    create: {
      username,
      role,
      passwordHash,
    },
  });
}

async function main() {
  const ownerUsername = process.env.SEED_OWNER_USERNAME ?? "owner";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "owner12345";
  const cashierUsername = process.env.SEED_CASHIER_USERNAME ?? "cashier";
  const cashierPassword = process.env.SEED_CASHIER_PASSWORD ?? "cashier12345";

  await upsertUser(ownerUsername, ownerPassword, "OWNER");
  await upsertUser(cashierUsername, cashierPassword, "CASHIER");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
