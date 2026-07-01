# Inventory Package Bundles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inventory `Paket` flow where bundle products derive stock and price from component products, can be sold in POS, participate in marketplace stock export, and correctly reconcile component stock during checkout, transaction edit, delete, and restore.

**Architecture:** Keep `Product` as the single catalog header and introduce a `product_kind` discriminator plus a `ProductPackageItem` recipe table. Resolve package stock and price through shared pure helpers that are reused by inventory, POS, and marketplace export, then record a `stock_effect_snapshot` per transaction line so checkout and transaction-history corrections always mutate component stock deterministically even after a package recipe changes.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Prisma/PostgreSQL, Dexie offline store

---

## File Structure

### Create

- `src/lib/inventory/package.ts`
  Responsibility: package type definitions, recipe validation, derived package stock/price calculation, package marketplace listing resolution.
- `src/features/inventory/components/package-form-dialog.tsx`
  Responsibility: create/edit package UI with component row editor and marketplace sku-only fields.
- `src/features/inventory/components/package-table.tsx`
  Responsibility: package list table separate from normal product table.
- `src/features/pos/lib/stock-effects.ts`
  Responsibility: expand a normal product or package line into component-level stock effects, diff old/new effects, and build deterministic adjustment batches.
- `tests/inventory/package-products.spec.ts`
  Responsibility: pure derivation tests for package stock, price, and marketplace stock lookup.
- `prisma/migrations/20260701130000_add_package_products/migration.sql`
  Responsibility: additive schema change for `ProductKind`, `ProductPackageItem`, and `PosTransactionLine.stock_effect_snapshot`.

### Modify

- `prisma/schema.prisma`
  Responsibility: declare `ProductKind`, `ProductPackageItem`, and `stock_effect_snapshot`.
- `src/lib/offline/db.ts`
  Responsibility: extend `ProductRecord`, `PosTransactionLineRecord`, and Dexie schema version for package fields and stock effect snapshots.
- `src/lib/inventory/uom.ts`
  Responsibility: keep normalization safe for package rows and preserve derived/cached fields.
- `src/lib/inventory/marketplace.ts`
  Responsibility: generate marketplace listings from normal products and packages with sku-only matching.
- `src/lib/db/product-catalog.ts`
  Responsibility: upsert/list package rows plus recipe items transactionally and reject nested/self-referential packages.
- `src/app/api/inventory/products/route.ts`
  Responsibility: validate package payloads, sku-only marketplace rules, and package recipe constraints.
- `src/features/inventory/hooks/use-product-catalog.ts`
  Responsibility: persist/sync `product_kind` and `package_items`, then resolve package display rows before exposing catalog state.
- `src/lib/offline/inventory-sync-transport.ts`
  Responsibility: serialize package fields in product sync transport.
- `src/features/inventory/components/inventory-tabs.tsx`
  Responsibility: add `Paket` tab, route normal products to `Produk`, and wire package dialog/table.
- `src/features/inventory/components/marketplace-stock-tab.tsx`
  Responsibility: include derived package rows in export counts and workbook updates.
- `src/features/inventory/lib/marketplace-stock-template.ts`
  Responsibility: write derived package stock values when a marketplace SKU belongs to a package.
- `src/features/pos/lib/product-units.ts`
  Responsibility: expose a single fixed sell unit for packages.
- `src/features/pos/components/pos-qty-dialog.tsx`
  Responsibility: support integer-only qty mode for package sales.
- `src/features/pos/components/pos-product-table.tsx`
  Responsibility: render package stock/price labels from derived rows without breaking normal products.
- `src/features/pos/components/pos-screen.tsx`
  Responsibility: pass package metadata into qty dialog and checkout flow.
- `src/features/pos/hooks/use-pos-cart.ts`
  Responsibility: carry `product_kind`, `package_items`, and `stock_effect_snapshot`-friendly metadata in draft cart lines.
- `src/features/pos/hooks/use-pos-checkout.ts`
  Responsibility: expand package lines into component stock mutations and persist line-level stock effect snapshots.
- `src/features/pos/lib/transaction-history-update.ts`
  Responsibility: compute stock deltas for edit/delete/restore using stored snapshots and write `STOCK_ADJUSTMENT` mutations.
- `src/features/pos/components/transaction-edit-dialog.tsx`
  Responsibility: preserve `stock_effect_snapshot` across edits and block package qty edits to integers.
- `src/lib/offline/pos-transaction-history.ts`
  Responsibility: normalize `stock_effect_snapshot` when syncing and reading local transaction history.
- `src/lib/db/pos-transactions.ts`
  Responsibility: serialize/deserialize `stock_effect_snapshot` in Prisma transaction sync batches.
- `src/app/api/sync/pos-transactions/route.ts`
  Responsibility: accept package line snapshots in transaction sync payloads.

### Tests To Modify

- `tests/inventory/product-route-validation.spec.ts`
- `tests/inventory/product-catalog-upsert-server.spec.ts`
- `tests/inventory/product-catalog-sync.spec.ts`
- `tests/inventory/inventory-product-tab.spec.tsx`
- `tests/inventory/marketplace-stock-template.spec.ts`
- `tests/pos/checkout-payment.spec.tsx`
- `tests/pos/transaction-history-update.spec.ts`
- `tests/pos/transaction-edit-dialog.spec.tsx`
- `tests/pos/pos-transaction-sync.spec.ts`

---

### Task 1: Add Package Derivation Helpers

**Files:**
- Create: `src/lib/inventory/package.ts`
- Modify: `src/lib/offline/db.ts`
- Modify: `src/lib/inventory/uom.ts`
- Modify: `src/features/pos/lib/product-units.ts`
- Test: `tests/inventory/package-products.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  derivePackageCatalogRow,
  getPackageMarketplaceListings,
} from "@/lib/inventory/package";

describe("package product derivation", () => {
  it("derives package stock from the limiting component across small and large units", () => {
    const rows = new Map([
      [
        "prod-a",
        {
          id_produk: "prod-a",
          nama_produk: "Produk A",
          harga_jual: 10000,
          stok_saat_ini: 8,
          is_active: true,
          product_kind: "NORMAL",
          unit_small_name: "pcs",
          allow_sell_in_small: true,
          updatedAt: 1782896400000,
        },
      ],
      [
        "prod-b",
        {
          id_produk: "prod-b",
          nama_produk: "Produk B",
          harga_jual: 12000,
          stok_saat_ini: 8,
          is_active: true,
          product_kind: "NORMAL",
          unit_small_name: "pcs",
          allow_sell_in_small: true,
          updatedAt: 1782896400000,
        },
      ],
      [
        "prod-c",
        {
          id_produk: "prod-c",
          nama_produk: "Produk C",
          harga_jual: 9000,
          harga_jual_unit_besar: 45000,
          stok_saat_ini: 20,
          stok_unit_besar_saat_ini: 5,
          is_active: true,
          product_kind: "NORMAL",
          unit_small_name: "pcs",
          unit_large_name: "dus",
          unit_large_to_small: 5,
          allow_sell_in_small: true,
          allow_sell_in_large: true,
          updatedAt: 1782896400000,
        },
      ],
    ]);

    const pkg = derivePackageCatalogRow(
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        sku: "PKT-A",
        harga_jual: 0,
        stok_saat_ini: 0,
        is_active: true,
        is_marketplace: true,
        marketplace_product_name: "Paket A Marketplace",
        marketplace_sku_id: "SKU-PKT-A",
        product_kind: "PACKAGE",
        package_items: [
          { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
          { component_product_id: "prod-b", component_unit: "SMALL", component_qty: 2 },
          { component_product_id: "prod-c", component_unit: "LARGE", component_qty: 1 },
        ],
        updatedAt: 1782896400000,
      },
      rows,
    );

    expect(pkg.harga_jual).toBe(79000);
    expect(pkg.stok_saat_ini).toBe(4);
    expect(pkg.unit_small_name).toBe("paket");
    expect(pkg.allow_sell_in_large).toBe(false);
  });

  it("exposes package marketplace listing from derived stock and sku-only marketplace fields", () => {
    const listings = getPackageMarketplaceListings({
      id_produk: "pkg-1",
      nama_produk: "Paket A",
      harga_jual: 79000,
      stok_saat_ini: 4,
      is_active: true,
      is_marketplace: true,
      marketplace_product_name: "Paket A Marketplace",
      marketplace_sku_id: "SKU-PKT-A",
      product_kind: "PACKAGE",
      unit_small_name: "paket",
      allow_sell_in_small: true,
      updatedAt: 1782896400000,
    });

    expect(listings).toEqual([
      { unit: "small", marketplace_sku_id: "SKU-PKT-A", stock: 4 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/package-products.spec.ts --reporter=verbose`

Expected: FAIL with `Cannot find module "@/lib/inventory/package"` and TypeScript errors for missing `product_kind` / `package_items`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/offline/db.ts
export type ProductKind = "NORMAL" | "PACKAGE";

export type PackageItemRecord = {
  component_product_id: string;
  component_unit: InventoryMutationUnit;
  component_qty: number;
};

export type ProductRecord = {
  id_produk: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini?: number;
  is_active: boolean;
  product_kind?: ProductKind;
  package_items?: PackageItemRecord[];
  // existing marketplace + uom fields stay here
  updatedAt: number;
};
```

```ts
// src/lib/inventory/package.ts
import type { InventoryMutationUnit, ProductRecord } from "@/lib/offline/db";

function getComponentUnitPrice(product: ProductRecord, unit: InventoryMutationUnit) {
  return unit === "LARGE" ? product.harga_jual_unit_besar ?? 0 : product.harga_jual;
}

function getComponentUnitStock(product: ProductRecord, unit: InventoryMutationUnit) {
  return unit === "LARGE" ? product.stok_unit_besar_saat_ini ?? 0 : product.stok_saat_ini;
}

export function derivePackageCatalogRow(
  pkg: ProductRecord,
  rows: Map<string, ProductRecord>,
): ProductRecord {
  const items = pkg.package_items ?? [];
  if ((pkg.product_kind ?? "NORMAL") !== "PACKAGE" || items.length === 0) {
    return pkg;
  }

  let derivedPrice = 0;
  let derivedStock = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const component = rows.get(item.component_product_id);
    if (!component || (component.product_kind ?? "NORMAL") !== "NORMAL") {
      derivedStock = 0;
      continue;
    }

    derivedPrice += getComponentUnitPrice(component, item.component_unit) * item.component_qty;
    derivedStock = Math.min(
      derivedStock,
      Math.floor(getComponentUnitStock(component, item.component_unit) / item.component_qty),
    );
  }

  return {
    ...pkg,
    harga_jual: derivedPrice,
    stok_saat_ini: Number.isFinite(derivedStock) ? Math.max(0, derivedStock) : 0,
    unit_small_name: "paket",
    unit_large_name: undefined,
    unit_large_to_small: undefined,
    allow_sell_in_small: true,
    allow_sell_in_large: false,
    allow_buy_in_small: false,
    allow_buy_in_large: false,
    stok_unit_besar_saat_ini: 0,
    harga_jual_unit_besar: undefined,
  };
}

export function getPackageMarketplaceListings(pkg: ProductRecord) {
  if ((pkg.product_kind ?? "NORMAL") !== "PACKAGE" || !pkg.marketplace_sku_id) {
    return [];
  }

  return [
    {
      unit: "small" as const,
      marketplace_sku_id: pkg.marketplace_sku_id,
      stock: Math.max(0, pkg.stok_saat_ini),
    },
  ];
}
```

```ts
// src/features/pos/lib/product-units.ts
if ((product.product_kind ?? "NORMAL") === "PACKAGE") {
  return [
    {
      unit_mutasi: "SMALL",
      unit_label: product.unit_small_name?.trim() || "paket",
      unit_price: product.harga_jual,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/inventory/package-products.spec.ts --reporter=verbose`

Expected: PASS for both package derivation assertions.

- [ ] **Step 5: Commit**

```bash
git add tests/inventory/package-products.spec.ts src/lib/offline/db.ts src/lib/inventory/package.ts src/lib/inventory/uom.ts src/features/pos/lib/product-units.ts
git commit -m "feat: add package derivation helpers"
```

### Task 2: Add Prisma Schema and Server Product Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260701130000_add_package_products/migration.sql`
- Modify: `src/lib/db/product-catalog.ts`
- Modify: `src/app/api/inventory/products/route.ts`
- Test: `tests/inventory/product-route-validation.spec.ts`
- Test: `tests/inventory/product-catalog-upsert-server.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/inventory/product-route-validation.spec.ts
it("accepts package payloads with sku-only marketplace fields and recipe items", async () => {
  const { POST } = await import("@/app/api/inventory/products/route");

  const request = new Request("http://localhost/api/inventory/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          id_produk: "pkg-1",
          nama_produk: "Paket A",
          sku: "PKT-A",
          harga_jual: 0,
          stok_saat_ini: 0,
          is_active: true,
          product_kind: "PACKAGE",
          is_marketplace: true,
          marketplace_product_name: "Paket A Marketplace",
          marketplace_sku_id: "SKU-PKT-A",
          package_items: [
            { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
            { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
          ],
          updatedAt: 1782896400000,
        },
      ],
    }),
  });

  const response = await POST(request as never);
  expect(response.status).toBe(200);
  expect(upsertProductMock).toHaveBeenCalledWith(
    expect.objectContaining({
      product_kind: "PACKAGE",
      package_items: [
        { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
        { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
      ],
      marketplace_sku_id: "SKU-PKT-A",
    }),
  );
});

it("rejects package payloads that try to send marketplace_large_sku_id", async () => {
  const { POST } = await import("@/app/api/inventory/products/route");
  const response = await POST(
    new Request("http://localhost/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        products: [
          {
            nama_produk: "Paket Invalid",
            harga_jual: 0,
            stok_saat_ini: 0,
            is_active: true,
            product_kind: "PACKAGE",
            marketplace_large_sku_id: "SKU-LARGE",
            package_items: [{ component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 }],
          },
        ],
      }),
    }) as never,
  );

  expect(response.status).toBe(400);
});
```

```ts
// tests/inventory/product-catalog-upsert-server.spec.ts
it("replaces package recipe rows transactionally when a package product is upserted", async () => {
  findUnique.mockResolvedValueOnce({
    id_produk: "pkg-1",
    last_synced_at: null,
    is_marketplace: false,
    product_kind: "PACKAGE",
  });
  upsert.mockResolvedValue({ id_produk: "pkg-1" });

  const deleteManyPackageItems = vi.fn().mockResolvedValue({ count: 2 });
  const createManyPackageItems = vi.fn().mockResolvedValue({ count: 2 });
  transaction.mockImplementation(async (callback) =>
    callback({
      product: { findMany, findUnique, upsert, update, create },
      productSpecialPrice: { deleteMany, createMany },
      productPackageItem: { deleteMany: deleteManyPackageItems, createMany: createManyPackageItems },
    }),
  );

  const { upsertProduct } = await import("@/lib/db/product-catalog");
  await upsertProduct({
    id_produk: "pkg-1",
    nama_produk: "Paket A",
    harga_jual: 0,
    stok_saat_ini: 0,
    is_active: true,
    product_kind: "PACKAGE",
    package_items: [
      { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
      { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
    ],
  } as never);

  expect(deleteManyPackageItems).toHaveBeenCalledWith({ where: { package_product_id: "pkg-1" } });
  expect(createManyPackageItems).toHaveBeenCalledWith({
    data: [
      { package_product_id: "pkg-1", component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
      { package_product_id: "pkg-1", component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
    ],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts --reporter=verbose`

Expected: FAIL because route payload type rejects `product_kind` / `package_items` and server upsert does not touch `productPackageItem`.

- [ ] **Step 3: Write minimal implementation**

```prisma
// prisma/schema.prisma
enum ProductKind {
  NORMAL
  PACKAGE
}

model Product {
  id_produk       String      @id @default(cuid())
  nama_produk     String
  sku             String?     @unique
  harga_jual      Int
  stok_saat_ini   Float       @default(0)
  product_kind    ProductKind @default(NORMAL)
  package_items   ProductPackageItem[] @relation("PackageRecipe")
  package_used_by ProductPackageItem[] @relation("PackageComponent")
  // existing fields stay in place
}

model ProductPackageItem {
  id                   String                @id @default(cuid())
  package_product_id   String
  component_product_id String
  component_unit       InventoryMutationUnit
  component_qty        Float
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  package_product   Product @relation("PackageRecipe", fields: [package_product_id], references: [id_produk], onDelete: Cascade)
  component_product Product @relation("PackageComponent", fields: [component_product_id], references: [id_produk], onDelete: Restrict)

  @@unique([package_product_id, component_product_id, component_unit])
  @@index([package_product_id])
  @@index([component_product_id])
}

model PosTransactionLine {
  id                   String @id @default(cuid())
  stock_effect_snapshot Json?
  // existing fields stay here
}
```

```sql
-- prisma/migrations/20260701130000_add_package_products/migration.sql
CREATE TYPE "ProductKind" AS ENUM ('NORMAL', 'PACKAGE');

ALTER TABLE "Product"
  ADD COLUMN "product_kind" "ProductKind" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "ProductPackageItem" (
  "id" TEXT NOT NULL,
  "package_product_id" TEXT NOT NULL,
  "component_product_id" TEXT NOT NULL,
  "component_unit" "InventoryMutationUnit" NOT NULL,
  "component_qty" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductPackageItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductPackageItem_package_product_id_component_product_id_component_unit_key"
  ON "ProductPackageItem"("package_product_id", "component_product_id", "component_unit");
CREATE INDEX "ProductPackageItem_package_product_id_idx" ON "ProductPackageItem"("package_product_id");
CREATE INDEX "ProductPackageItem_component_product_id_idx" ON "ProductPackageItem"("component_product_id");

ALTER TABLE "ProductPackageItem"
  ADD CONSTRAINT "ProductPackageItem_package_product_id_fkey"
  FOREIGN KEY ("package_product_id") REFERENCES "Product"("id_produk") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPackageItem"
  ADD CONSTRAINT "ProductPackageItem_component_product_id_fkey"
  FOREIGN KEY ("component_product_id") REFERENCES "Product"("id_produk") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosTransactionLine"
  ADD COLUMN "stock_effect_snapshot" JSONB;
```

```ts
// src/lib/db/product-catalog.ts
export type ProductUpsertInput = {
  // existing fields
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: Array<{
    component_product_id: string;
    component_unit: "SMALL" | "LARGE";
    component_qty: number;
  }>;
};

async function syncPackageItems(
  db: ProductCatalogDbClient & Pick<typeof prisma, "productPackageItem">,
  package_product_id: string,
  product_kind: "NORMAL" | "PACKAGE",
  items: ProductUpsertInput["package_items"],
) {
  await db.productPackageItem.deleteMany({ where: { package_product_id } });
  if (product_kind !== "PACKAGE") return;
  if (!items || items.length === 0) {
    throw new Error("PACKAGE_REQUIRES_ITEMS");
  }
  await db.productPackageItem.createMany({
    data: items.map((item) => ({
      package_product_id,
      component_product_id: item.component_product_id,
      component_unit: item.component_unit,
      component_qty: item.component_qty,
    })),
  });
}
```

```ts
// src/app/api/inventory/products/route.ts
type ProductPayload = {
  // existing fields
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: Array<{
    component_product_id?: string;
    component_unit?: "SMALL" | "LARGE";
    component_qty?: number;
  }>;
};

if (product.product_kind === "PACKAGE") {
  if (product.marketplace_large_sku_id) return false;
  if (!Array.isArray(product.package_items) || product.package_items.length === 0) return false;
  if (product.package_items.some((item) =>
    !item.component_product_id ||
    (item.component_unit !== "SMALL" && item.component_unit !== "LARGE") ||
    typeof item.component_qty !== "number" ||
    item.component_qty <= 0,
  )) {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts --reporter=verbose`

Expected: PASS for package payload acceptance/rejection and recipe replacement behavior.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260701130000_add_package_products/migration.sql src/lib/db/product-catalog.ts src/app/api/inventory/products/route.ts tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts
git commit -m "feat: persist package products and recipes"
```

### Task 3: Extend Offline Catalog Sync for Packages

**Files:**
- Modify: `src/lib/offline/db.ts`
- Modify: `src/lib/offline/inventory-sync-transport.ts`
- Modify: `src/features/inventory/hooks/use-product-catalog.ts`
- Modify: `src/lib/inventory/marketplace.ts`
- Test: `tests/inventory/product-catalog-sync.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("stores package kind and recipe rows in local cache and queued sync payload", async () => {
  const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
  await persistProductCatalog({
    nama_produk: "Paket A",
    sku: "PKT-A",
    harga_jual: 0,
    stok_saat_ini: 0,
    is_active: true,
    product_kind: "PACKAGE",
    is_marketplace: true,
    marketplace_product_name: "Paket A Marketplace",
    marketplace_sku_id: "SKU-PKT-A",
    package_items: [
      { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
      { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
    ],
  } as never);

  const saved = putProduct.mock.calls[0][0];
  const queued = JSON.parse(addQueue.mock.calls[0][0].deltaPayload);

  expect(saved.product_kind).toBe("PACKAGE");
  expect(saved.package_items).toEqual([
    { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
    { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
  ]);
  expect(queued.product_kind).toBe("PACKAGE");
  expect(queued.package_items).toEqual(saved.package_items);
});

it("keeps package rows visible after sync by deriving stock from component products", async () => {
  productsToArray.mockResolvedValueOnce([
    {
      id_produk: "prod-a",
      nama_produk: "Produk A",
      harga_jual: 10000,
      stok_saat_ini: 8,
      is_active: true,
      product_kind: "NORMAL",
      updatedAt: 1782896400000,
    },
    {
      id_produk: "pkg-1",
      nama_produk: "Paket A",
      harga_jual: 0,
      stok_saat_ini: 0,
      is_active: true,
      product_kind: "PACKAGE",
      package_items: [{ component_product_id: "prod-a", component_unit: "SMALL", component_qty: 2 }],
      updatedAt: 1782896400000,
    },
  ]);

  const { useProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");
  const { result } = renderHook(() => useProductCatalog());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.products.find((item) => item.id_produk === "pkg-1")).toMatchObject({
    harga_jual: 20000,
    stok_saat_ini: 4,
    product_kind: "PACKAGE",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/product-catalog-sync.spec.ts --reporter=verbose`

Expected: FAIL because `persistProductCatalog` strips package fields and `useProductCatalog` returns raw package rows with `harga_jual: 0` / `stok_saat_ini: 0`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/offline/db.ts
this.version(8).stores({
  credentialCache: "username, userId, updatedAt, passwordVersion, role",
  localSessions: "key, username, lastActivityAt, mustReloginAt",
  syncQueue: "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
  appMeta: "key",
  inventoryMutationEvents: "id_queue, id_transaksi, id_produk, id_user, jenis_mutasi, unit_mutasi, client_timestamp, logical_clock",
  products: "id_produk, nama_produk, sku, product_kind, harga_jual, harga_jual_unit_besar, stok_saat_ini, stok_unit_besar_saat_ini, is_active, updatedAt",
  posTransactions: "id_transaksi, short_id, payment_method, counts_for_cash, is_deleted, client_timestamp, createdAt",
});
```

```ts
// src/lib/offline/inventory-sync-transport.ts
type ProductSyncRecord = {
  id_produk: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  stok_saat_ini: number;
  is_active: boolean;
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: Array<{
    component_product_id: string;
    component_unit: "SMALL" | "LARGE";
    component_qty: number;
  }>;
  updatedAt: number;
  // existing fields remain
};
```

```ts
// src/features/inventory/hooks/use-product-catalog.ts
type ProductInput = {
  // existing fields
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: ProductRecord["package_items"];
};

function resolveCatalogProducts(rows: ProductRecord[]) {
  const map = new Map(rows.map((row) => [row.id_produk, normalizeProductUom(row)]));
  return rows.map((row) =>
    (row.product_kind ?? "NORMAL") === "PACKAGE"
      ? derivePackageCatalogRow(normalizeProductUom(row), map)
      : normalizeProductUom(row),
  );
}

const product: ProductRecord = {
  ...(existing ?? { id_produk: input.id_produk ?? crypto.randomUUID(), nama_produk: "", harga_jual: input.harga_jual, stok_saat_ini: 0, is_active: true, updatedAt: now }),
  product_kind: input.product_kind ?? existing?.product_kind ?? "NORMAL",
  package_items: input.product_kind === "PACKAGE" ? input.package_items ?? existing?.package_items ?? [] : undefined,
  // existing normalized fields remain
};

const refreshLocal = useCallback(async () => {
  const rows = await offlineDb.products.orderBy("nama_produk").toArray();
  setProducts(resolveCatalogProducts(rows.filter((item) => item.is_active)));
}, []);
```

```ts
// src/lib/inventory/marketplace.ts
import { getPackageMarketplaceListings } from "@/lib/inventory/package";

export function getProductMarketplaceListings(input: ProductMarketplaceInput & { product_kind?: string }) {
  if ((input.product_kind ?? "NORMAL") === "PACKAGE") {
    return getPackageMarketplaceListings(input as never);
  }
  // existing normal-product listing logic stays here
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/inventory/product-catalog-sync.spec.ts --reporter=verbose`

Expected: PASS for package queue payload persistence and derived package refresh behavior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/db.ts src/lib/offline/inventory-sync-transport.ts src/features/inventory/hooks/use-product-catalog.ts src/lib/inventory/marketplace.ts tests/inventory/product-catalog-sync.spec.ts
git commit -m "feat: sync package products through offline catalog"
```

### Task 4: Build the Inventory Paket Tab and Form

**Files:**
- Create: `src/features/inventory/components/package-form-dialog.tsx`
- Create: `src/features/inventory/components/package-table.tsx`
- Modify: `src/features/inventory/components/inventory-tabs.tsx`
- Test: `tests/inventory/inventory-product-tab.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows a Paket tab and keeps package rows out of the Produk tab", async () => {
  render(<InventoryTabs />);

  expect(screen.getByRole("tab", { name: "Paket" })).toBeInTheDocument();
  expect(screen.queryByText("Paket A")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: "Paket" }));
  expect(screen.getByText("Paket A")).toBeInTheDocument();
  expect(screen.queryByText("Kopi Tubruk")).not.toBeInTheDocument();
});

it("submits package payload with recipe rows and sku-only marketplace data", async () => {
  render(<InventoryTabs />);

  await userEvent.click(screen.getByRole("tab", { name: "Paket" }));
  await userEvent.click(screen.getByRole("button", { name: "Tambah Paket" }));

  const dialog = await screen.findByRole("dialog", { name: "Tambah Paket" });
  await userEvent.type(within(dialog).getByLabelText("Nama paket"), "Paket A");
  await userEvent.type(within(dialog).getByLabelText("SKU internal"), "PKT-A");
  await userEvent.click(within(dialog).getByLabelText("Jual di marketplace"));
  await userEvent.type(within(dialog).getByLabelText("Nama produk marketplace"), "Paket A Marketplace");
  await userEvent.type(within(dialog).getByLabelText("ID SKU marketplace"), "SKU-PKT-A");
  await userEvent.selectOptions(within(dialog).getByLabelText("Produk komponen 1"), "prod-a");
  await userEvent.selectOptions(within(dialog).getByLabelText("Unit komponen 1"), "SMALL");
  await userEvent.clear(within(dialog).getByLabelText("Qty komponen 1"));
  await userEvent.type(within(dialog).getByLabelText("Qty komponen 1"), "2");
  await userEvent.click(within(dialog).getByRole("button", { name: "Simpan Paket" }));

  await waitFor(() => {
    expect(saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        product_kind: "PACKAGE",
        marketplace_sku_id: "SKU-PKT-A",
        package_items: [{ component_product_id: "prod-a", component_unit: "SMALL", component_qty: 2 }],
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: FAIL because there is no `Paket` tab, no package dialog, and `InventoryTabs` still treats every catalog row as a normal product.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/inventory/components/inventory-tabs.tsx
type TabKey = "produk" | "paket" | "stock-in" | "marketplace";

const productRows = useMemo(
  () => products.filter((product) => (product.product_kind ?? "NORMAL") === "NORMAL"),
  [products],
);
const packageRows = useMemo(
  () => products.filter((product) => (product.product_kind ?? "NORMAL") === "PACKAGE"),
  [products],
);

<Button
  aria-selected={activeTab === "paket"}
  onClick={() => setActiveTab("paket")}
  role="tab"
  variant={activeTab === "paket" ? "default" : "outline"}
>
  Paket
</Button>
```

```tsx
// src/features/inventory/components/package-table.tsx
export function PackageTable({ packages, onEdit, query }: {
  packages: ProductRecord[];
  onEdit: (pkg: ProductRecord) => void;
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const rows = packages.filter((pkg) =>
    !normalizedQuery ||
    pkg.nama_produk.toLowerCase().includes(normalizedQuery) ||
    pkg.sku?.toLowerCase().includes(normalizedQuery),
  );

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((pkg) => (
          <tr key={pkg.id_produk}>
            <td>{pkg.nama_produk}</td>
            <td>{pkg.sku ?? "-"}</td>
            <td>{pkg.stok_saat_ini}</td>
            <td>Rp{pkg.harga_jual.toLocaleString("id-ID")}</td>
            <td><Button onClick={() => onEdit(pkg)} size="sm" variant="outline">Edit</Button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// src/features/inventory/components/package-form-dialog.tsx
type PackageSubmitPayload = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  stok_saat_ini: number;
  is_active: boolean;
  product_kind: "PACKAGE";
  is_marketplace: boolean;
  marketplace_product_name?: string;
  marketplace_sku_id?: string;
  package_items: Array<{
    component_product_id: string;
    component_unit: "SMALL" | "LARGE";
    component_qty: number;
  }>;
};

await onSubmit({
  id_produk: editingPackage?.id_produk,
  nama_produk,
  sku: sku.trim() || undefined,
  harga_jual: 0,
  stok_saat_ini: 0,
  is_active,
  product_kind: "PACKAGE",
  is_marketplace,
  marketplace_product_name: isMarketplace ? marketplaceProductName.trim() : undefined,
  marketplace_sku_id: isMarketplace ? marketplaceSkuId.trim() : undefined,
  package_items: componentRows.map((row) => ({
    component_product_id: row.component_product_id,
    component_unit: row.component_unit,
    component_qty: Number(row.component_qty),
  })),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: PASS for `Paket` tab visibility, package-only list rendering, and package form submission payload.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/components/inventory-tabs.tsx src/features/inventory/components/package-form-dialog.tsx src/features/inventory/components/package-table.tsx tests/inventory/inventory-product-tab.spec.tsx
git commit -m "feat: add inventory paket tab and form"
```

### Task 5: Wire Packages Into Marketplace Export and POS Entry

**Files:**
- Modify: `src/features/inventory/lib/marketplace-stock-template.ts`
- Modify: `src/features/inventory/components/marketplace-stock-tab.tsx`
- Modify: `src/features/pos/components/pos-qty-dialog.tsx`
- Modify: `src/features/pos/components/pos-product-table.tsx`
- Modify: `src/features/pos/components/pos-screen.tsx`
- Modify: `src/features/pos/hooks/use-pos-cart.ts`
- Test: `tests/inventory/marketplace-stock-template.spec.ts`
- Test: `tests/pos/checkout-payment.spec.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/inventory/marketplace-stock-template.spec.ts
it("uses derived package stock when marketplace sku belongs to a package", () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");
  sheet.addRow(["header 1"]);
  sheet.addRow(["header 2"]);
  sheet.addRow(["header 3"]);
  sheet.addRow([null, null, null, null, "SKU-PKT-A", null, null, null, 0]);

  const result = updateMarketplaceWorkbookStock(
    workbook,
    { skuIdColumn: "E", stockColumn: "I", startRow: 4, percentage: 30 },
    [
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        harga_jual: 79000,
        stok_saat_ini: 4,
        is_active: true,
        is_marketplace: true,
        marketplace_product_name: "Paket A Marketplace",
        marketplace_sku_id: "SKU-PKT-A",
        product_kind: "PACKAGE",
        unit_small_name: "paket",
        updatedAt: Date.now(),
      },
    ] as never,
  );

  expect(result.workbook.getWorksheet("Template")?.getCell("I4").value).toBe(2);
});
```

```ts
// tests/pos/checkout-payment.spec.tsx
it("keeps package qty integer-only before checkout persists the line", async () => {
  const { normalizePackageQtyInput } = await import("@/features/pos/hooks/use-pos-checkout");
  expect(() => normalizePackageQtyInput("1.5")).toThrow("Qty paket harus bilangan bulat.");
  expect(normalizePackageQtyInput("3")).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/marketplace-stock-template.spec.ts tests/pos/checkout-payment.spec.tsx --reporter=verbose`

Expected: FAIL because export helper only understands normal listings and POS has no integer-only package qty helper.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inventory/lib/marketplace-stock-template.ts
function buildMarketplaceLookup(products: ProductRecord[]) {
  return new Map(
    products.flatMap((product) =>
      getProductMarketplaceListings(product).map((listing) => [
        listing.marketplace_sku_id.trim(),
        listing,
      ] as const),
    ),
  );
}
```

```ts
// src/features/pos/components/pos-qty-dialog.tsx
type Props = {
  open: boolean;
  defaultQty?: string;
  productName?: string;
  unitOptions: ProductSellUnitOption[];
  defaultUnitMutasi: InventoryMutationUnit;
  integerOnly?: boolean;
  onClose: () => void;
  onConfirm: (payload: { qty: string; unit_mutasi: InventoryMutationUnit }) => void;
};

<Input
  aria-label="Qty"
  inputMode={integerOnly ? "numeric" : "decimal"}
  onChange={(event) => setQty(event.target.value)}
  // remaining props stay the same
/>
```

```ts
// src/features/pos/hooks/use-pos-cart.ts
export type PosCartLine = {
  id_produk: string;
  nama_produk: string;
  nama_produk_dasar: string;
  harga_jual: number;
  qty: number;
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: ProductRecord["package_items"];
  line_discount: number;
  unit_mutasi: InventoryMutationUnit;
  unit_label: string;
  pricing_snapshot: PosLinePricingSnapshot;
};
```

```tsx
// src/features/pos/components/pos-screen.tsx
const activeProduct = filteredProducts[safeProductIndex];
const activeProductIsPackage = (activeProduct?.product_kind ?? "NORMAL") === "PACKAGE";

<PosQtyDialog
  key={`qty-${qtyDialogKey}`}
  defaultQty="1"
  defaultUnitMutasi={qtyDefaultUnit}
  integerOnly={activeProductIsPackage}
  onClose={() => setQtyOpen(false)}
  onConfirm={(payload) => {
    const qty = activeProductIsPackage
      ? normalizePackageQtyInput(payload.qty)
      : normalizeQuantityInput(payload.qty);
    // existing upsert flow stays here
  }}
  open={qtyOpen}
  productName={activeProduct?.nama_produk}
  unitOptions={activeProduct ? getEffectiveUnitOptions(activeProduct) : []}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/inventory/marketplace-stock-template.spec.ts tests/pos/checkout-payment.spec.tsx --reporter=verbose`

Expected: PASS for derived package marketplace stock and integer-only package qty normalization.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/lib/marketplace-stock-template.ts src/features/inventory/components/marketplace-stock-tab.tsx src/features/pos/components/pos-qty-dialog.tsx src/features/pos/components/pos-product-table.tsx src/features/pos/components/pos-screen.tsx src/features/pos/hooks/use-pos-cart.ts tests/inventory/marketplace-stock-template.spec.ts tests/pos/checkout-payment.spec.tsx
git commit -m "feat: surface packages in export and pos entry"
```

### Task 6: Expand Package Lines Into Component Stock Effects on Checkout

**Files:**
- Create: `src/features/pos/lib/stock-effects.ts`
- Modify: `src/features/pos/hooks/use-pos-checkout.ts`
- Modify: `src/lib/offline/db.ts`
- Test: `tests/pos/checkout-payment.spec.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("expands a package checkout line into component stock-out mutations and stores a stock effect snapshot", async () => {
  const { persistPosTransaction } = await import("@/features/pos/hooks/use-pos-checkout");

  await persistPosTransaction({
    lines: [
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        unit_price: 79000,
        qty: 2,
        unit_mutasi: "SMALL",
        unit_label: "paket",
        product_kind: "PACKAGE",
        package_items: [
          { component_product_id: "prod-a", component_unit: "SMALL", component_qty: 1 },
          { component_product_id: "prod-b", component_unit: "LARGE", component_qty: 2 },
        ],
      },
    ],
    payment_method: "cash",
  } as never);

  const saved = putTx.mock.calls[0][0];
  expect(saved.lines[0].stock_effect_snapshot).toEqual({
    source_kind: "PACKAGE",
    effects: [
      { id_produk: "prod-a", nama_produk_snapshot: "prod-a", unit_mutasi: "SMALL", qty_delta: -2 },
      { id_produk: "prod-b", nama_produk_snapshot: "prod-b", unit_mutasi: "LARGE", qty_delta: -4 },
    ],
  });

  expect(persistStockOutMutation).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ id_produk: "prod-a", delta_qty: 2, unit_mutasi: "SMALL", logical_clock: 1 }),
  );
  expect(persistStockOutMutation).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ id_produk: "prod-b", delta_qty: 4, unit_mutasi: "LARGE", logical_clock: 2 }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/pos/checkout-payment.spec.tsx --reporter=verbose`

Expected: FAIL because checkout stores no `stock_effect_snapshot` and writes stock-out only for `id_produk: "pkg-1"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/offline/db.ts
export type StockEffectSnapshot = {
  source_kind: "NORMAL" | "PACKAGE";
  effects: Array<{
    id_produk: string;
    nama_produk_snapshot: string;
    unit_mutasi: InventoryMutationUnit;
    qty_delta: number;
  }>;
};

export type PosTransactionLineRecord = {
  id_produk: string;
  nama_produk: string;
  unit_price: number;
  qty: number;
  unit_mutasi?: InventoryMutationUnit;
  unit_label?: string;
  line_discount: number;
  line_total: number;
  pricing_snapshot?: PosLinePricingSnapshot;
  stock_effect_snapshot?: StockEffectSnapshot;
};
```

```ts
// src/features/pos/lib/stock-effects.ts
import type { InventoryMutationUnit, ProductRecord, StockEffectSnapshot } from "@/lib/offline/db";

type CheckoutLikeLine = {
  id_produk: string;
  nama_produk: string;
  qty: number;
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: ProductRecord["package_items"];
  unit_mutasi?: InventoryMutationUnit;
};

export function buildLineStockEffectSnapshot(line: CheckoutLikeLine): StockEffectSnapshot {
  if ((line.product_kind ?? "NORMAL") !== "PACKAGE") {
    return {
      source_kind: "NORMAL",
      effects: [
        {
          id_produk: line.id_produk,
          nama_produk_snapshot: line.nama_produk,
          unit_mutasi: line.unit_mutasi ?? "SMALL",
          qty_delta: -line.qty,
        },
      ],
    };
  }

  return {
    source_kind: "PACKAGE",
    effects: (line.package_items ?? []).map((item) => ({
      id_produk: item.component_product_id,
      nama_produk_snapshot: item.component_product_id,
      unit_mutasi: item.component_unit,
      qty_delta: -(line.qty * item.component_qty),
    })),
  };
}
```

```ts
// src/features/pos/hooks/use-pos-checkout.ts
export function normalizePackageQtyInput(raw: string) {
  const parsed = Number(raw.trim().replace(",", "."));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Qty paket harus bilangan bulat.");
  }
  return parsed;
}

const normalizedLines = input.lines.map((line) => {
  const baseTotal = line.pricing_snapshot?.automatic_subtotal ?? line.unit_price * line.qty;
  const discount = Math.max(0, Math.min(line.line_discount ?? 0, baseTotal));
  return {
    ...line,
    line_discount: discount,
    line_total: Math.max(0, baseTotal - discount),
    stock_effect_snapshot: buildLineStockEffectSnapshot(line as never),
  };
});

let logicalClock = 1;
for (const line of normalizedLines) {
  for (const effect of line.stock_effect_snapshot?.effects ?? []) {
    await persistStockOutMutation({
      id_transaksi: payload.id_transaksi,
      id_produk: effect.id_produk,
      delta_qty: Math.abs(effect.qty_delta),
      unit_mutasi: effect.unit_mutasi,
      logical_clock: logicalClock,
    });
    logicalClock += 1;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/pos/checkout-payment.spec.tsx --reporter=verbose`

Expected: PASS for stored package snapshots and component-level `persistStockOutMutation` calls.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/db.ts src/features/pos/lib/stock-effects.ts src/features/pos/hooks/use-pos-checkout.ts tests/pos/checkout-payment.spec.tsx
git commit -m "feat: expand package checkout into component stock effects"
```

### Task 7: Reconcile Component Stock During Transaction Edit/Delete/Restore

**Files:**
- Modify: `src/features/pos/lib/stock-effects.ts`
- Modify: `src/features/pos/lib/transaction-history-update.ts`
- Modify: `src/features/pos/components/transaction-edit-dialog.tsx`
- Test: `tests/pos/transaction-history-update.spec.ts`
- Test: `tests/pos/transaction-edit-dialog.spec.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pos/transaction-history-update.spec.ts
it("reverses stored package stock effects when soft deleting a transaction", async () => {
  getTransaction.mockResolvedValueOnce({
    id_transaksi: "tx-1",
    short_id: "TRX-001",
    kasir_user_id: "cashier-1",
    kasir_username: "cashier",
    payment_method: "cash",
    subtotal_amount: 79000,
    item_discount: 0,
    order_discount: 0,
    total_amount: 79000,
    amount_received: 80000,
    change_amount: 1000,
    counts_for_cash: true,
    is_deleted: false,
    lines: [
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        unit_price: 79000,
        qty: 2,
        unit_mutasi: "SMALL",
        unit_label: "paket",
        line_discount: 0,
        line_total: 79000,
        stock_effect_snapshot: {
          source_kind: "PACKAGE",
          effects: [
            { id_produk: "prod-a", nama_produk_snapshot: "Produk A", unit_mutasi: "SMALL", qty_delta: -2 },
            { id_produk: "prod-b", nama_produk_snapshot: "Produk B", unit_mutasi: "LARGE", qty_delta: -4 },
          ],
        },
      },
    ],
    client_timestamp: Date.parse("2026-06-09T09:00:00.000Z"),
    createdAt: Date.parse("2026-06-09T09:00:00.000Z"),
  });

  const persistStockMutation = vi.fn().mockResolvedValue({});
  vi.doMock("@/features/inventory/hooks/use-stock-mutation", () => ({ persistStockMutation }));

  const { softDeleteTransactionHistory } = await import("@/features/pos/lib/transaction-history-update");
  await softDeleteTransactionHistory("tx-1");

  expect(persistStockMutation).toHaveBeenCalledWith(
    expect.objectContaining({ jenis_mutasi: "STOCK_ADJUSTMENT", id_produk: "prod-a", delta_qty: 2, unit_mutasi: "SMALL" }),
  );
  expect(persistStockMutation).toHaveBeenCalledWith(
    expect.objectContaining({ jenis_mutasi: "STOCK_ADJUSTMENT", id_produk: "prod-b", delta_qty: 4, unit_mutasi: "LARGE" }),
  );
});

it("preserves stock effect snapshots when re-saving a transaction draft", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(
    <TransactionEditDialog
      onClose={() => undefined}
      onDelete={async () => undefined}
      onRestore={async () => undefined}
      onSave={onSave}
      open
      transaction={{
        id_transaksi: "tx-1",
        short_id: "TRX-001",
        kasir_user_id: "cashier-1",
        kasir_username: "kasir",
        payment_method: "cash",
        subtotal_amount: 79000,
        item_discount: 0,
        order_discount: 0,
        total_amount: 79000,
        amount_received: 80000,
        change_amount: 1000,
        counts_for_cash: true,
        note: "catatan",
        is_deleted: false,
        lines: [
          {
            id_produk: "pkg-1",
            nama_produk: "Paket A",
            unit_price: 79000,
            qty: 2,
            unit_mutasi: "SMALL",
            unit_label: "paket",
            line_discount: 0,
            line_total: 79000,
            stock_effect_snapshot: {
              source_kind: "PACKAGE",
              effects: [
                { id_produk: "prod-a", nama_produk_snapshot: "Produk A", unit_mutasi: "SMALL", qty_delta: -2 },
              ],
            },
          },
        ],
        client_timestamp: Date.parse("2026-06-09T09:00:00.000Z"),
        createdAt: Date.parse("2026-06-09T09:00:00.000Z"),
      }}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));
  const confirmDialog = await screen.findByRole("dialog", {
    name: "Simpan perubahan transaksi?",
  });
  await user.click(within(confirmDialog).getByRole("button", { name: "Simpan" }));

  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            stock_effect_snapshot: {
              source_kind: "PACKAGE",
              effects: [
                { id_produk: "prod-a", nama_produk_snapshot: "Produk A", unit_mutasi: "SMALL", qty_delta: -2 },
              ],
            },
          }),
        ],
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/pos/transaction-history-update.spec.ts tests/pos/transaction-edit-dialog.spec.tsx --reporter=verbose`

Expected: FAIL because transaction update/delete/restore only rewrites the transaction row and queue payload; it does not emit component `STOCK_ADJUSTMENT` mutations or preserve snapshots in dialog save payloads.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/pos/lib/stock-effects.ts
import type { InventoryMutationUnit, PosTransactionLineRecord, StockEffectSnapshot } from "@/lib/offline/db";

type StockEffectKey = `${string}:${InventoryMutationUnit}`;

function toEffectMap(lines: Array<Pick<PosTransactionLineRecord, "id_produk" | "nama_produk" | "qty" | "unit_mutasi" | "stock_effect_snapshot">>) {
  const map = new Map<StockEffectKey, { id_produk: string; unit_mutasi: InventoryMutationUnit; qty_delta: number }>();

  for (const line of lines) {
    const snapshot: StockEffectSnapshot =
      line.stock_effect_snapshot ?? {
        source_kind: "NORMAL",
        effects: [
          {
            id_produk: line.id_produk,
            nama_produk_snapshot: line.nama_produk,
            unit_mutasi: line.unit_mutasi ?? "SMALL",
            qty_delta: -line.qty,
          },
        ],
      };

    for (const effect of snapshot.effects) {
      const key = `${effect.id_produk}:${effect.unit_mutasi}`;
      const current = map.get(key) ?? { id_produk: effect.id_produk, unit_mutasi: effect.unit_mutasi, qty_delta: 0 };
      current.qty_delta += effect.qty_delta;
      map.set(key, current);
    }
  }

  return map;
}

export function diffStockEffectMaps(oldLines: PosTransactionLineRecord[], newLines: PosTransactionLineRecord[]) {
  const previous = toEffectMap(oldLines);
  const next = toEffectMap(newLines);
  const keys = new Set([...previous.keys(), ...next.keys()]);

  return [...keys].flatMap((key) => {
    const before = previous.get(key)?.qty_delta ?? 0;
    const after = next.get(key)?.qty_delta ?? 0;
    const delta = after - before;
    if (delta === 0) return [];
    const seed = next.get(key) ?? previous.get(key)!;
    return [{ id_produk: seed.id_produk, unit_mutasi: seed.unit_mutasi, qty_delta: delta }];
  });
}
```

```ts
// src/features/pos/lib/transaction-history-update.ts
import { persistStockMutation } from "@/features/inventory/hooks/use-stock-mutation";
import { buildLineStockEffectSnapshot, diffStockEffectMaps } from "@/features/pos/lib/stock-effects";

async function applyStockAdjustments(
  id_transaksi: string,
  deltas: Array<{ id_produk: string; unit_mutasi: "SMALL" | "LARGE"; qty_delta: number }>,
) {
  let logicalClock = 1;
  for (const delta of deltas) {
    await persistStockMutation({
      id_transaksi,
      id_produk: delta.id_produk,
      unit_mutasi: delta.unit_mutasi,
      delta_qty: delta.qty_delta,
      jenis_mutasi: "STOCK_ADJUSTMENT",
      logical_clock: logicalClock,
    });
    logicalClock += 1;
  }
}

const normalizedLines = input.lines.map((line) => ({
  ...normalizeLine(line),
  stock_effect_snapshot: line.stock_effect_snapshot ?? buildLineStockEffectSnapshot(line as never),
}));

await applyStockAdjustments(
  input.id_transaksi,
  diffStockEffectMaps(current.lines as never, normalizedLines as never),
);
```

```ts
// soft delete uses reverse deltas
await applyStockAdjustments(
  id_transaksi,
  diffStockEffectMaps(current.lines as never, []),
);
```

```ts
// restore uses forward deltas
await applyStockAdjustments(
  id_transaksi,
  diffStockEffectMaps([], current.lines as never),
);
```

```tsx
// src/features/pos/components/transaction-edit-dialog.tsx
function toStoredLine(line: PosCartLine): StoredTransactionLine {
  return {
    id_produk: line.id_produk,
    nama_produk: line.nama_produk,
    unit_price: line.harga_jual,
    qty: line.qty,
    unit_mutasi: line.unit_mutasi,
    unit_label: line.unit_label,
    line_discount: line.line_discount,
    line_total: Math.max(0, line.pricing_snapshot.automatic_subtotal - line.line_discount),
    pricing_snapshot: line.pricing_snapshot,
    stock_effect_snapshot: line.stock_effect_snapshot,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/pos/transaction-history-update.spec.ts tests/pos/transaction-edit-dialog.spec.tsx --reporter=verbose`

Expected: PASS for package component stock reconciliation and snapshot preservation during dialog save.

- [ ] **Step 5: Commit**

```bash
git add src/features/pos/lib/stock-effects.ts src/features/pos/lib/transaction-history-update.ts src/features/pos/components/transaction-edit-dialog.tsx tests/pos/transaction-history-update.spec.ts tests/pos/transaction-edit-dialog.spec.tsx
git commit -m "feat: reconcile package stock during transaction history changes"
```

### Task 8: Persist Package Snapshots Through POS Sync and Run Regression Verification

**Files:**
- Modify: `src/lib/offline/pos-transaction-history.ts`
- Modify: `src/lib/db/pos-transactions.ts`
- Modify: `src/app/api/sync/pos-transactions/route.ts`
- Test: `tests/pos/pos-transaction-sync.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("submits stock effect snapshots from queued package transactions without stripping the payload", async () => {
  const payload = {
    id_transaksi: "tx-1",
    lines: [
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        unit_price: 79000,
        qty: 2,
        line_discount: 0,
        line_total: 158000,
        stock_effect_snapshot: {
          source_kind: "PACKAGE",
          effects: [
            { id_produk: "prod-a", nama_produk_snapshot: "Produk A", unit_mutasi: "SMALL", qty_delta: -2 },
            { id_produk: "prod-b", nama_produk_snapshot: "Produk B", unit_mutasi: "LARGE", qty_delta: -4 },
          ],
        },
      },
    ],
  };

  getRetryableQueueByEntity.mockResolvedValue([{ id: 10, deltaPayload: JSON.stringify(payload) }]);
  postPosTransactions.mockResolvedValue({ results: [{ id_transaksi: "tx-1", status: "acked" }] });

  const { runPosSyncPass } = await import("@/lib/offline/pos-sync");
  await runPosSyncPass();

  expect(postPosTransactions).toHaveBeenCalledWith([
    expect.objectContaining({
      lines: [expect.objectContaining({ stock_effect_snapshot: payload.lines[0].stock_effect_snapshot })],
    }),
  ]);
});

it("persists and re-reads stock effect snapshots in the server transaction batch mapping", async () => {
  vi.resetModules();

  const stockEffectSnapshot = {
    source_kind: "PACKAGE" as const,
    effects: [
      { id_produk: "prod-a", nama_produk_snapshot: "Produk A", unit_mutasi: "SMALL" as const, qty_delta: -2 },
    ],
  };
  const upsert = vi.fn().mockResolvedValue(undefined);
  const deleteMany = vi.fn().mockResolvedValue(undefined);
  const createMany = vi.fn().mockResolvedValue(undefined);
  const queryRaw = vi.fn().mockResolvedValue([{ id_transaksi: "tx-remote-1", sync_at: new Date("2026-06-01T01:00:00.000Z") }]);
  const findMany = vi.fn().mockResolvedValue([
    {
      id_transaksi: "tx-remote-1",
      short_id: "TRX-001",
      kasir_user_id: "user-1",
      kasir_username: "kasir",
      payment_method: "CASH",
      subtotal_amount: 79000,
      item_discount: 0,
      order_discount: 0,
      total_amount: 79000,
      amount_received: 80000,
      change_amount: 1000,
      counts_for_cash: true,
      note: "catatan",
      is_deleted: false,
      editedAt: null,
      editedByUserId: null,
      editedByUsername: null,
      deletedAt: null,
      deletedByUserId: null,
      deletedByUsername: null,
      client_timestamp: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date("2026-06-01T01:00:00.000Z"),
      lines: [
        {
          id_produk: "pkg-1",
          nama_produk: "Paket A",
          unit_price: 79000,
          qty: 2,
          unit_mutasi: "SMALL",
          unit_label: "paket",
          line_discount: 0,
          line_total: 79000,
          pricing_snapshot: null,
          stock_effect_snapshot: stockEffectSnapshot,
        },
      ],
    },
  ]);

  vi.doMock("@/lib/db/prisma", () => ({
    prisma: {
      $queryRaw: queryRaw,
      $transaction: vi.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
        callback({
          posTransaction: { upsert },
          posTransactionLine: { deleteMany, createMany },
        }),
      ),
      posTransaction: { findMany },
    },
  }));
  vi.doMock("@/lib/sync/pos-transaction-sync-cursor", () => ({
    parsePosTransactionSyncCursor: vi.fn().mockReturnValue(undefined),
  }));

  const { createPosTransactionBatch, listPosTransactionsForSync } = await import("@/lib/db/pos-transactions");

  await createPosTransactionBatch([
    {
      id_transaksi: "tx-remote-1",
      short_id: "TRX-001",
      kasir_user_id: "user-1",
      kasir_username: "kasir",
      payment_method: "cash",
      subtotal_amount: 79000,
      item_discount: 0,
      order_discount: 0,
      total_amount: 79000,
      amount_received: 80000,
      change_amount: 1000,
      counts_for_cash: true,
      note: "catatan",
      client_timestamp: Date.parse("2026-06-01T00:00:00.000Z"),
      lines: [
        {
          id_produk: "pkg-1",
          nama_produk: "Paket A",
          unit_price: 79000,
          qty: 2,
          unit_mutasi: "SMALL",
          unit_label: "paket",
          line_discount: 0,
          line_total: 79000,
          stock_effect_snapshot: stockEffectSnapshot,
        },
      ],
    },
  ] as never);

  expect(createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        stock_effect_snapshot: stockEffectSnapshot,
      }),
    ],
  });

  const rows = await listPosTransactionsForSync();
  expect(rows[0]?.lines[0]).toMatchObject({
    stock_effect_snapshot: stockEffectSnapshot,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/pos/pos-transaction-sync.spec.ts --reporter=verbose`

Expected: FAIL because queue normalization and Prisma batch mapping do not serialize `stock_effect_snapshot`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/offline/pos-transaction-history.ts
function normalizeLocalTransaction(record: PosTransactionRecord): PosTransactionRecord {
  return {
    ...record,
    lines: record.lines.map((line) => ({
      ...line,
      unit_mutasi: line.unit_mutasi ?? undefined,
      unit_label: line.unit_label?.trim() || undefined,
      pricing_snapshot: normalizePricingSnapshot(line.pricing_snapshot),
      stock_effect_snapshot: line.stock_effect_snapshot ?? undefined,
    })),
  };
}
```

```ts
// src/lib/db/pos-transactions.ts
await trx.posTransactionLine.createMany({
  data: tx.lines.map((line) => ({
    id_transaksi: tx.id_transaksi,
    id_produk: line.id_produk,
    nama_produk: line.nama_produk,
    unit_price: Math.trunc(line.unit_price),
    qty: line.qty,
    unit_mutasi: line.unit_mutasi ?? null,
    unit_label: line.unit_label ?? null,
    line_discount: Math.trunc(line.line_discount),
    line_total: Math.trunc(line.line_total),
    pricing_snapshot: serializePricingSnapshot(line.pricing_snapshot),
    stock_effect_snapshot: line.stock_effect_snapshot ?? Prisma.DbNull,
  })),
});
```

```ts
// listPosTransactionsForSync mapper
lines: row.lines.map((line) => ({
  id_produk: line.id_produk,
  nama_produk: line.nama_produk,
  unit_price: line.unit_price,
  qty: line.qty,
  unit_mutasi: line.unit_mutasi ?? undefined,
  unit_label: line.unit_label ?? undefined,
  line_discount: line.line_discount,
  line_total: line.line_total,
  pricing_snapshot: deserializePricingSnapshot(line.pricing_snapshot),
  stock_effect_snapshot: (line.stock_effect_snapshot as PosTransactionLineRecord["stock_effect_snapshot"]) ?? undefined,
})),
```

```ts
// src/app/api/sync/pos-transactions/route.ts
type Body = {
  transactions?: Array<{
    id_transaksi: string;
    // existing fields
    lines: Array<{
      id_produk: string;
      nama_produk: string;
      unit_price: number;
      qty: number;
      line_discount: number;
      line_total: number;
      stock_effect_snapshot?: {
        source_kind: "NORMAL" | "PACKAGE";
        effects: Array<{
          id_produk: string;
          nama_produk_snapshot: string;
          unit_mutasi: "SMALL" | "LARGE";
          qty_delta: number;
        }>;
      };
    }>;
  }>;
};
```

- [ ] **Step 4: Run tests and regression verification**

Run:

```bash
pnpm exec vitest run tests/inventory/package-products.spec.ts tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/inventory-product-tab.spec.tsx tests/inventory/marketplace-stock-template.spec.ts tests/pos/checkout-payment.spec.tsx tests/pos/transaction-history-update.spec.ts tests/pos/transaction-edit-dialog.spec.tsx tests/pos/pos-transaction-sync.spec.ts --reporter=verbose
pnpm exec prisma validate
pnpm exec eslint src/lib/inventory/package.ts src/lib/db/product-catalog.ts src/app/api/inventory/products/route.ts src/features/inventory/hooks/use-product-catalog.ts src/features/inventory/components/inventory-tabs.tsx src/features/inventory/components/package-form-dialog.tsx src/features/inventory/components/package-table.tsx src/features/inventory/lib/marketplace-stock-template.ts src/features/pos/lib/stock-effects.ts src/features/pos/hooks/use-pos-checkout.ts src/features/pos/lib/transaction-history-update.ts src/features/pos/components/transaction-edit-dialog.tsx src/lib/db/pos-transactions.ts src/lib/offline/pos-transaction-history.ts tests/inventory/package-products.spec.ts tests/inventory/inventory-product-tab.spec.tsx tests/pos/checkout-payment.spec.tsx tests/pos/transaction-history-update.spec.ts tests/pos/pos-transaction-sync.spec.ts
```

Expected: All targeted Vitest suites PASS and ESLint exits with code `0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/pos-transaction-history.ts src/lib/db/pos-transactions.ts src/app/api/sync/pos-transactions/route.ts tests/pos/pos-transaction-sync.spec.ts
git commit -m "feat: sync package stock snapshots through pos history"
```

## Self-Review

### Spec Coverage

- Inventory tab split (`Produk` vs `Paket`) is covered by Task 4.
- Package recipe persistence, sku-only marketplace rules, and additive Prisma migration are covered by Tasks 2 and 3.
- Derived package stock and price logic plus marketplace export behavior are covered by Tasks 1 and 5.
- POS package sale flow and integer package qty are covered by Tasks 5 and 6.
- Component stock mutation on checkout is covered by Task 6.
- Transaction edit/delete/restore reconciliation using stored snapshots is covered by Task 7.
- POS transaction sync and legacy compatibility for `stock_effect_snapshot` are covered by Task 8.

### Placeholder Scan

- No `TODO`, `TBD`, or “similar to Task N” references remain.
- Every code-writing step includes concrete snippets and exact commands.
- Migration path is explicit and additive-only.

### Type Consistency

- `product_kind` is consistently `"NORMAL" | "PACKAGE"` across Prisma payloads, offline records, and UI.
- `package_items` consistently uses `{ component_product_id, component_unit, component_qty }`.
- `stock_effect_snapshot` consistently uses `{ source_kind, effects[] }`.
