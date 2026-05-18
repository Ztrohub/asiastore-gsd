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

  await prisma.product.upsert({
    where: { sku: "BRG-CONTOH-001" },
    update: {
      nama_produk: "Produk Contoh",
      harga_jual: 15000,
      harga_jual_unit_besar: 165000,
      stok_saat_ini: 25,
      stok_unit_besar_saat_ini: 4,
      is_active: true,
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_buy_in_small: true,
      allow_buy_in_large: true,
      allow_sell_in_small: true,
      allow_sell_in_large: true,
    },
    create: {
      nama_produk: "Produk Contoh",
      sku: "BRG-CONTOH-001",
      harga_jual: 15000,
      harga_jual_unit_besar: 165000,
      stok_saat_ini: 25,
      stok_unit_besar_saat_ini: 4,
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_buy_in_small: true,
      allow_buy_in_large: true,
      allow_sell_in_small: true,
      allow_sell_in_large: true,
    },
  });
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
