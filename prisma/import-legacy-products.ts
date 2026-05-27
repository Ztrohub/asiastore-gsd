import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

type LegacyProduct = {
  nama_produk: string;
  harga_jual: number;
  stok_saat_ini: number;
};

const prisma = new PrismaClient();

function parseLegacyProducts(sqlDump: string): LegacyProduct[] {
  const insertBlockRegex =
    /INSERT INTO `barang` \(`b_id`, `b_name`, `b_amount`, `b_sell`\) VALUES([\s\S]*?);/g;
  const tupleRegex = /\('((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*(NULL|-?\d+),\s*(NULL|-?\d+)\)/g;
  const products: LegacyProduct[] = [];

  const blocks = [...sqlDump.matchAll(insertBlockRegex)];
  if (blocks.length === 0) {
    throw new Error("Bagian INSERT tabel barang tidak ditemukan di db_asiastok.sql");
  }

  for (const block of blocks) {
    const valuesBlock = block[1] ?? "";
    let match: RegExpExecArray | null;

    while ((match = tupleRegex.exec(valuesBlock)) !== null) {
      const rawName = match[2] ?? "";
      const rawStock = match[3] ?? "0";
      const rawPrice = match[4] ?? "0";

      const namaProduk = rawName.replace(/\\'/g, "'").trim();
      const stok = rawStock === "NULL" ? 0 : Number.parseInt(rawStock, 10);
      const harga = rawPrice === "NULL" ? 0 : Number.parseInt(rawPrice, 10);

      products.push({
        nama_produk: namaProduk,
        stok_saat_ini: Number.isFinite(stok) ? stok : 0,
        harga_jual: Number.isFinite(harga) ? harga : 0,
      });
    }

    tupleRegex.lastIndex = 0;
  }

  return products;
}

async function main() {
  const shouldTruncate = process.argv.includes("--truncate");
  const offsetArg = process.argv.find((arg) => arg.startsWith("--sync-offset-minutes="));
  const offsetMinutesRaw = offsetArg?.split("=")[1];
  const parsedOffset =
    offsetMinutesRaw === undefined ? 10 : Number.parseInt(offsetMinutesRaw, 10);
  const syncOffsetMinutes = Number.isFinite(parsedOffset) ? parsedOffset : 10;
  const dumpPath = path.resolve(process.cwd(), "db_asiastok.sql");
  const syncedAt = new Date(Date.now() + syncOffsetMinutes * 60_000);

  const dump = await readFile(dumpPath, "utf8");
  const products = parseLegacyProducts(dump);

  if (products.length === 0) {
    throw new Error("Tidak ada produk yang berhasil diparse dari db_asiastok.sql");
  }

  if (shouldTruncate) {
    await prisma.product.deleteMany({});
  }

  const chunkSize = 500;
  let inserted = 0;

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    const result = await prisma.product.createMany({
      data: chunk.map((item) => ({
        nama_produk: item.nama_produk,
        sku: null,
        harga_jual: item.harga_jual,
        stok_saat_ini: item.stok_saat_ini,
        updatedAt: syncedAt,
        last_synced_at: syncedAt,
      })),
    });
    inserted += result.count;
  }

  console.log(
    JSON.stringify(
      {
        source_rows: products.length,
        inserted_rows: inserted,
        truncate_before_import: shouldTruncate,
        sync_timestamp_iso: syncedAt.toISOString(),
        sync_offset_minutes: syncOffsetMinutes,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
