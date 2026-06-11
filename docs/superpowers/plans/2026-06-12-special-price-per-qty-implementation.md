# Special Price Per Qty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan harga khusus per qty di master produk yang otomatis dipakai di POS, tampil sebagai breakdown item di POS dan receipt, tetap offline-first, dan dimigrasikan lewat Prisma migration.

**Architecture:** Simpan rule harga khusus di level produk per unit jual dengan representasi integer `qty_tenths` agar tidak bergantung pada float untuk pembandingan qty. Hitungan POS dipusatkan di resolver baru yang menghasilkan `pricing_snapshot` per line transaksi; snapshot itu lalu menjadi sumber kebenaran untuk checkout total, edit histori, sync, dan reprint receipt.

**Tech Stack:** Prisma/PostgreSQL, Dexie offline cache, Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

## File Map

- Create: `src/lib/pricing/special-price.ts` — shared special-price types, validation, normalization, and snapshot shapes
- Create: `src/features/pos/lib/special-pricing.ts` — exact-first pricing resolver and breakdown builder
- Create: `tests/pos/special-pricing.spec.ts` — regression coverage for the resolver
- Create: `tests/inventory/product-form-special-prices.spec.tsx` — form contract for special-price master data
- Modify: `prisma/schema.prisma` — `ProductSpecialPrice` model and `pricing_snapshot` JSON field on `PosTransactionLine`
- Create via command: `prisma/migrations/*_add_special_price_per_qty/migration.sql` — generated Prisma migration
- Modify: `src/lib/db/product-catalog.ts` — persist and list product special-price rows
- Modify: `src/app/api/inventory/products/route.ts` — accept and validate `special_prices`
- Modify: `src/lib/offline/db.ts` — extend local product and transaction line records with special-price metadata
- Modify: `src/lib/offline/inventory-sync-transport.ts` — send special-price rules in product sync payloads
- Modify: `src/features/inventory/hooks/use-product-catalog.ts` — normalize, persist, and sync `special_prices`
- Modify: `src/lib/inventory/uom.ts` — preserve normalized special-price arrays on product records
- Modify: `src/features/inventory/components/product-form-dialog.tsx` — master-product editor for special-price rows
- Modify: `src/features/pos/hooks/use-pos-cart.ts` — build line pricing snapshots on add/edit
- Modify: `src/features/pos/hooks/use-pos-checkout.ts` — compute totals from automatic subtotals instead of `qty * unit_price`
- Modify: `src/features/pos/components/pos-screen.tsx` — pass special-price-aware product data into the cart
- Modify: `src/features/pos/components/pos-cart-panel.tsx` — render breakdown rows like `1.1 x 10.000` and `0.5 x 6.000`
- Modify: `src/features/pos/components/pos-cart-item-dialog.tsx` — show automatic subtotal and keep manual override capped by the resolver result
- Modify: `src/features/pos/components/pos-payment-dialog.tsx` — render the same breakdown in the payment confirmation modal
- Modify: `src/features/pos/components/transaction-edit-dialog.tsx` — recalc existing-line pricing from stored snapshot, use current master data only for newly added lines
- Modify: `src/features/pos/lib/transaction-history-update.ts` — persist recalculated `pricing_snapshot` and line totals
- Modify: `src/lib/db/pos-transactions.ts` — persist `pricing_snapshot` to Prisma and return it on sync reads
- Modify: `src/app/api/sync/pos-transactions/route.ts` — accept `pricing_snapshot` in sync payloads
- Modify: `src/lib/offline/pos-transaction-history.ts` — normalize synced `pricing_snapshot` values
- Modify: `src/features/pos/lib/receipt-format.ts` — print breakdown lines before `Sub`
- Modify: `src/features/pos/components/pos-transactions-screen.tsx` — show breakdown rows in expanded transaction detail
- Modify: `tests/inventory/product-route-validation.spec.ts` — route validation coverage for special-price rules
- Modify: `tests/inventory/product-catalog-sync.spec.ts` — offline product sync coverage for special-price rules
- Modify: `tests/pos/checkout-payment.spec.tsx` — totals now derive from `pricing_snapshot`
- Modify: `tests/pos/keyboard-cart-flow.spec.tsx` — cart UI breakdown contract
- Modify: `tests/pos/transaction-history-update.spec.ts` — snapshot-aware history recalculation
- Modify: `tests/pos/pos-transaction-sync.spec.ts` — sync payload coverage for `pricing_snapshot`
- Modify: `tests/pos/pos-transaction-screen.spec.tsx` — transaction detail breakdown contract
- Modify: `tests/pos/receipt-formatting.spec.ts` — receipt breakdown layout contract

### Task 1: Build the shared special-price contract and resolver

**Files:**
- Create: `src/lib/pricing/special-price.ts`
- Create: `src/features/pos/lib/special-pricing.ts`
- Create: `tests/pos/special-pricing.spec.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveLinePricing } from "@/features/pos/lib/special-pricing";

describe("special price resolver", () => {
  it("uses an exact special-price rule before smaller chunks", () => {
    const resolved = resolveLinePricing({
      qty: 0.4,
      unit_mutasi: "SMALL",
      baseUnitPrice: 10000,
      rules: [
        { unit_mutasi: "SMALL", qty_tenths: 4, harga: 4700 },
        { unit_mutasi: "SMALL", qty_tenths: 2, harga: 2500 },
      ],
    });

    expect(resolved.automatic_subtotal).toBe(4700);
    expect(resolved.breakdown).toEqual([
      { qty: 0.4, unit_price: 4700, total: 4700, source: "special" },
    ]);
  });

  it("mixes base quantity and exact special chunks for fractional remainders", () => {
    const resolved = resolveLinePricing({
      qty: 1.6,
      unit_mutasi: "SMALL",
      baseUnitPrice: 10000,
      rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    });

    expect(resolved.automatic_subtotal).toBe(17000);
    expect(resolved.breakdown).toEqual([
      { qty: 1.1, unit_price: 10000, total: 11000, source: "base" },
      { qty: 0.5, unit_price: 6000, total: 6000, source: "special" },
    ]);
  });

  it("falls back to base remainder after using the best non-exact special coverage", () => {
    const resolved = resolveLinePricing({
      qty: 0.3,
      unit_mutasi: "SMALL",
      baseUnitPrice: 10000,
      rules: [{ unit_mutasi: "SMALL", qty_tenths: 2, harga: 2500 }],
    });

    expect(resolved.automatic_subtotal).toBe(3500);
    expect(resolved.breakdown).toEqual([
      { qty: 0.1, unit_price: 10000, total: 1000, source: "base" },
      { qty: 0.2, unit_price: 2500, total: 2500, source: "special" },
    ]);
  });
});
```

- [ ] **Step 2: Run the resolver test and verify it fails**

Run: `pnpm exec vitest run tests/pos/special-pricing.spec.ts --reporter=verbose`

Expected: FAIL because `resolveLinePricing` and the shared special-price types do not exist yet.

- [ ] **Step 3: Add the shared rule contract and the resolver**

```ts
// src/lib/pricing/special-price.ts
import type { InventoryMutationUnit } from "@/lib/offline/db";

export type ProductSpecialPriceRecord = {
  unit_mutasi: InventoryMutationUnit;
  qty_tenths: number;
  harga: number;
};

export type PricingBreakdownRow = {
  qty: number;
  unit_price: number;
  total: number;
  source: "base" | "special";
};

export type PosLinePricingSnapshot = {
  base_unit_price: number;
  automatic_subtotal: number;
  rules: ProductSpecialPriceRecord[];
  breakdown: PricingBreakdownRow[];
};

export function assertValidSpecialPriceRules(rules: ProductSpecialPriceRecord[]) {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!Number.isInteger(rule.qty_tenths) || rule.qty_tenths < 1 || rule.qty_tenths > 9) {
      throw new Error("Qty harga khusus harus kelipatan 0.1 antara 0.1 sampai 0.9.");
    }
    if (!Number.isInteger(rule.harga) || rule.harga < 100 || rule.harga > 999999999) {
      throw new Error("Harga khusus harus integer IDR yang valid.");
    }
    const key = `${rule.unit_mutasi}:${rule.qty_tenths}`;
    if (seen.has(key)) {
      throw new Error("Qty harga khusus untuk unit yang sama tidak boleh duplikat.");
    }
    seen.add(key);
  }
}

export function sortSpecialPriceRules(rules: ProductSpecialPriceRecord[]) {
  return [...rules].sort((a, b) => {
    if (a.unit_mutasi !== b.unit_mutasi) {
      return a.unit_mutasi.localeCompare(b.unit_mutasi);
    }
    return b.qty_tenths - a.qty_tenths;
  });
}
```

```ts
// src/features/pos/lib/special-pricing.ts
import type { InventoryMutationUnit } from "@/lib/offline/db";
import type { PosLinePricingSnapshot, ProductSpecialPriceRecord, PricingBreakdownRow } from "@/lib/pricing/special-price";

function toQty(tenths: number) {
  return tenths / 10;
}

function pickBestFractionalRules(remainingTenths: number, rules: ProductSpecialPriceRecord[]) {
  let best: ProductSpecialPriceRecord[] = [];

  function visit(availableTenths: number, picked: ProductSpecialPriceRecord[]) {
    if (picked.length > 0) {
      const pickedTenths = picked.reduce((sum, rule) => sum + rule.qty_tenths, 0);
      const bestTenths = best.reduce((sum, rule) => sum + rule.qty_tenths, 0);
      const shouldReplace =
        pickedTenths > bestTenths ||
        (pickedTenths === bestTenths && picked.length < best.length) ||
        (pickedTenths === bestTenths &&
          picked.length === best.length &&
          picked.some((rule, index) => rule.qty_tenths > (best[index]?.qty_tenths ?? 0)));
      if (shouldReplace) {
        best = [...picked].sort((a, b) => b.qty_tenths - a.qty_tenths);
      }
    }

    for (const rule of rules) {
      if (rule.qty_tenths > availableTenths) continue;
      visit(availableTenths - rule.qty_tenths, [...picked, rule]);
    }
  }

  visit(remainingTenths, []);
  return best;
}

export function resolveLinePricing(params: {
  qty: number;
  unit_mutasi: InventoryMutationUnit;
  baseUnitPrice: number;
  rules: ProductSpecialPriceRecord[];
}): PosLinePricingSnapshot {
  const totalTenths = Math.round(params.qty * 10);
  const wholeUnits = Math.floor(totalTenths / 10);
  const fractionalTenths = totalTenths % 10;
  const unitRules = params.rules
    .filter((rule) => rule.unit_mutasi === params.unit_mutasi)
    .sort((a, b) => b.qty_tenths - a.qty_tenths);

  const exactRule = unitRules.find((rule) => rule.qty_tenths === fractionalTenths);
  const chosenRules =
    fractionalTenths === 0 ? [] : exactRule ? [exactRule] : pickBestFractionalRules(fractionalTenths, unitRules);
  const coveredTenths = chosenRules.reduce((sum, rule) => sum + rule.qty_tenths, 0);
  const baseTenths = wholeUnits * 10 + Math.max(0, fractionalTenths - coveredTenths);
  const baseTotal = Math.round((baseTenths / 10) * params.baseUnitPrice);
  const specialRows: PricingBreakdownRow[] = chosenRules.map((rule) => ({
    qty: toQty(rule.qty_tenths),
    unit_price: rule.harga,
    total: rule.harga,
    source: "special",
  }));

  const breakdown: PricingBreakdownRow[] = [];
  if (baseTenths > 0) {
    breakdown.push({
      qty: toQty(baseTenths),
      unit_price: params.baseUnitPrice,
      total: baseTotal,
      source: "base",
    });
  }
  breakdown.push(...specialRows);

  return {
    base_unit_price: params.baseUnitPrice,
    automatic_subtotal: baseTotal + specialRows.reduce((sum, row) => sum + row.total, 0),
    rules: unitRules,
    breakdown,
  };
}
```

- [ ] **Step 4: Re-run the resolver test and verify it passes**

Run: `pnpm exec vitest run tests/pos/special-pricing.spec.ts --reporter=verbose`

Expected: PASS with all three pricing-resolution cases green.

- [ ] **Step 5: Commit the resolver foundation**

```bash
git add src/lib/pricing/special-price.ts src/features/pos/lib/special-pricing.ts tests/pos/special-pricing.spec.ts
git commit -m "feat: add special price qty resolver"
```

### Task 2: Persist special-price rules in Prisma and the product catalog API

**Files:**
- Modify: `prisma/schema.prisma`
- Create via command: `prisma/migrations/*_add_special_price_per_qty/migration.sql`
- Modify: `src/lib/db/product-catalog.ts`
- Modify: `src/app/api/inventory/products/route.ts`
- Modify: `tests/inventory/product-route-validation.spec.ts`

- [ ] **Step 1: Write the failing route validation tests**

```ts
it("accepts special price rules and forwards them to the product catalog upsert", async () => {
  const { POST } = await import("@/app/api/inventory/products/route");

  const request = new Request("http://localhost/api/inventory/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          id_produk: "prod-special",
          nama_produk: "Produk Special",
          harga_jual: 10000,
          stok_saat_ini: 4,
          is_active: true,
          unit_small_name: "pcs",
          allow_buy_in_small: true,
          allow_buy_in_large: false,
          allow_sell_in_small: true,
          allow_sell_in_large: false,
          special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
          updatedAt: 1781070003000,
        },
      ],
    }),
  });

  const response = await POST(request as never);
  expect(response.status).toBe(200);
  expect(upsertProductMock).toHaveBeenCalledWith(
    expect.objectContaining({
      special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    }),
  );
});

it("rejects duplicate special price rules for the same unit and qty", async () => {
  const { POST } = await import("@/app/api/inventory/products/route");

  const request = new Request("http://localhost/api/inventory/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          id_produk: "prod-special",
          nama_produk: "Produk Special",
          harga_jual: 10000,
          stok_saat_ini: 4,
          is_active: true,
          unit_small_name: "pcs",
          allow_buy_in_small: true,
          allow_buy_in_large: false,
          allow_sell_in_small: true,
          allow_sell_in_large: false,
          special_prices: [
            { unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 },
            { unit_mutasi: "SMALL", qty_tenths: 5, harga: 6200 },
          ],
          updatedAt: 1781070003000,
        },
      ],
    }),
  });

  const response = await POST(request as never);
  expect(response.status).toBe(400);
  expect(upsertProductMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the route validation test and verify it fails**

Run: `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts --reporter=verbose`

Expected: FAIL because the route does not accept `special_prices` and the catalog input type ignores it.

- [ ] **Step 3: Add the Prisma schema and generated migration**

```prisma
model Product {
  id_produk         String                @id @default(cuid())
  nama_produk       String
  sku               String?               @unique
  harga_jual        Int
  harga_jual_unit_besar Int?
  stok_saat_ini     Float                 @default(0)
  stok_unit_besar_saat_ini Float          @default(0)
  is_active         Boolean               @default(true)
  special_prices    ProductSpecialPrice[]
  // keep the existing marketplace and unit fields unchanged
}

model ProductSpecialPrice {
  id          String                @id @default(cuid())
  id_produk   String
  unit_mutasi InventoryMutationUnit
  qty_tenths  Int
  harga       Int
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt
  product     Product               @relation(fields: [id_produk], references: [id_produk], onDelete: Cascade)

  @@unique([id_produk, unit_mutasi, qty_tenths])
  @@index([id_produk, unit_mutasi])
}

model PosTransactionLine {
  id               String         @id @default(cuid())
  id_transaksi     String
  id_produk        String
  nama_produk      String
  unit_price       Int
  qty              Float
  unit_mutasi      InventoryMutationUnit?
  unit_label       String?
  line_discount    Int            @default(0)
  line_total       Int
  pricing_snapshot Json?
  createdAt        DateTime       @default(now())
  transaction      PosTransaction @relation(fields: [id_transaksi], references: [id_transaksi], onDelete: Cascade)
}
```

Run: `pnpm exec prisma migrate dev --name add_special_price_per_qty`

Expected: PASS with a new Prisma migration directory and generated client updates. Do not use `db push`.

- [ ] **Step 4: Implement catalog persistence and API validation**

```ts
// src/lib/db/product-catalog.ts
export type ProductUpsertInput = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini?: number;
  is_active: boolean;
  special_prices?: ProductSpecialPriceRecord[];
  // keep the existing marketplace and unit fields
};

function filterRulesByEnabledUnits(
  rules: ProductSpecialPriceRecord[],
  flags: { allowSmall: boolean; allowLarge: boolean },
) {
  return rules.filter((rule) =>
    rule.unit_mutasi === "SMALL" ? flags.allowSmall : flags.allowLarge,
  );
}

export async function upsertProduct(input: ProductUpsertInput) {
  const normalizedUom = normalizeUomInput(input);
  const normalizedRules = filterRulesByEnabledUnits(
    input.special_prices ?? [],
    {
      allowSmall: normalizedUom.allow_sell_in_small,
      allowLarge: normalizedUom.allow_sell_in_large,
    },
  );
  assertValidSpecialPriceRules(normalizedRules);

  return prisma.$transaction(async (trx) => {
    const payload = {
      ...basePayload,
      ...toDatabaseProductMarketplace(input, marketplaceFallback),
      last_synced_at: incomingSyncedAt,
    };
    const product = await trx.product.upsert({
      where: { id_produk: targetId },
      update: payload,
      create: { id_produk: targetId, ...payload },
    });

    await trx.productSpecialPrice.deleteMany({ where: { id_produk: product.id_produk } });
    if (normalizedRules.length > 0) {
      await trx.productSpecialPrice.createMany({
        data: normalizedRules.map((rule) => ({
          id_produk: product.id_produk,
          unit_mutasi: rule.unit_mutasi,
          qty_tenths: rule.qty_tenths,
          harga: rule.harga,
        })),
      });
    }

    return trx.product.findUnique({
      where: { id_produk: product.id_produk },
      include: { special_prices: true },
    });
  });
}
```

```ts
// src/app/api/inventory/products/route.ts
type ProductPayload = {
  id_produk?: string;
  nama_produk?: string;
  harga_jual?: number;
  stok_saat_ini?: number;
  is_active?: boolean;
  special_prices?: Array<{
    unit_mutasi?: "SMALL" | "LARGE";
    qty_tenths?: number;
    harga?: number;
  }>;
  // keep the existing fields
};

function isValidSpecialPricePayload(rules: ProductPayload["special_prices"]) {
  if (rules === undefined) return true;
  if (!Array.isArray(rules)) return false;
  try {
    assertValidSpecialPriceRules(
      rules.map((rule) => ({
        unit_mutasi: rule.unit_mutasi ?? "SMALL",
        qty_tenths: Number(rule.qty_tenths),
        harga: Number(rule.harga),
      })),
    );
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Re-run the route validation test and verify it passes**

Run: `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts --reporter=verbose`

Expected: PASS with valid `special_prices` accepted and duplicates rejected.

- [ ] **Step 6: Commit the schema and route changes**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/db/product-catalog.ts src/app/api/inventory/products/route.ts tests/inventory/product-route-validation.spec.ts
git commit -m "feat: persist product special prices"
```

### Task 3: Wire special-price rules into the offline product cache and the product form

**Files:**
- Modify: `src/lib/offline/db.ts`
- Modify: `src/lib/offline/inventory-sync-transport.ts`
- Modify: `src/features/inventory/hooks/use-product-catalog.ts`
- Modify: `src/lib/inventory/uom.ts`
- Modify: `src/features/inventory/components/product-form-dialog.tsx`
- Create: `tests/inventory/product-form-special-prices.spec.tsx`
- Modify: `tests/inventory/product-catalog-sync.spec.ts`

- [ ] **Step 1: Write the failing offline and form tests**

```ts
// tests/inventory/product-catalog-sync.spec.ts
it("stores special price rules locally and includes them in the queued product payload", async () => {
  const { persistProductCatalog } = await import("@/features/inventory/hooks/use-product-catalog");

  await persistProductCatalog({
    nama_produk: "Kopi Susu",
    harga_jual: 10000,
    stok_saat_ini: 10,
    is_active: true,
    special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
  });

  const product = putProduct.mock.calls[0][0];
  const queueRow = addQueue.mock.calls[0][0];
  const queuedPayload = JSON.parse(queueRow.deltaPayload);

  expect(product.special_prices).toEqual([{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }]);
  expect(queuedPayload.special_prices).toEqual([{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }]);
});
```

```tsx
// tests/inventory/product-form-special-prices.spec.tsx
it("submits special price rows from the product dialog", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(<ProductFormDialog open onClose={vi.fn()} onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Nama produk"), "Kopi Susu");
  await user.type(screen.getByLabelText("Harga jual unit kecil"), "10000");
  await user.click(screen.getByRole("button", { name: "Tambah harga khusus" }));
  await user.selectOptions(screen.getByLabelText("Unit harga khusus 1"), "SMALL");
  await user.selectOptions(screen.getByLabelText("Qty harga khusus 1"), "0.5");
  await user.type(screen.getByLabelText("Harga khusus 1"), "6000");
  await user.click(screen.getByRole("button", { name: "Simpan Produk" }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    }),
  );
});
```

- [ ] **Step 2: Run the offline and form tests and verify they fail**

Run: `pnpm exec vitest run tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-form-special-prices.spec.tsx --reporter=verbose`

Expected: FAIL because the local product record, product sync transport, and product dialog do not yet expose `special_prices`.

- [ ] **Step 3: Extend the local product contract and product form UI**

```ts
// src/lib/offline/db.ts
export type ProductRecord = {
  id_produk: string;
  nama_produk: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini?: number;
  is_active: boolean;
  special_prices?: ProductSpecialPriceRecord[];
  updatedAt: number;
  // keep the existing marketplace and unit fields
};
```

```ts
// src/features/inventory/hooks/use-product-catalog.ts
type ProductInput = {
  nama_produk: string;
  harga_jual: number;
  special_prices?: ProductSpecialPriceRecord[];
  // keep the existing fields
};

const product: ProductRecord = normalizeProductUom({
  ...(existing ?? {
    id_produk: input.id_produk ?? crypto.randomUUID(),
    nama_produk: "",
    harga_jual: input.harga_jual,
    stok_saat_ini: 0,
    is_active: true,
    updatedAt: now,
  }),
  nama_produk: input.nama_produk.trim(),
  sku: input.sku === undefined ? existing?.sku : input.sku.trim() || undefined,
  harga_jual: input.harga_jual,
  harga_jual_unit_besar: input.harga_jual_unit_besar ?? existing?.harga_jual_unit_besar,
  stok_saat_ini: Math.max(0, Math.trunc(input.stok_saat_ini ?? existing?.stok_saat_ini ?? 0)),
  stok_unit_besar_saat_ini: Math.max(
    0,
    Math.trunc(input.stok_unit_besar_saat_ini ?? existing?.stok_unit_besar_saat_ini ?? 0),
  ),
  is_active: input.is_active ?? existing?.is_active ?? true,
  special_prices: sortSpecialPriceRules(input.special_prices ?? existing?.special_prices ?? []),
  updatedAt: now,
});
```

```tsx
// src/features/inventory/components/product-form-dialog.tsx
type SpecialPriceDraft = {
  key: string;
  unit_mutasi: "SMALL" | "LARGE";
  qty_tenths: number;
  harga: string;
};

const [specialPrices, setSpecialPrices] = useState<SpecialPriceDraft[]>(
  (editingProduct?.special_prices ?? []).map((rule, index) => ({
    key: `${rule.unit_mutasi}-${rule.qty_tenths}-${index}`,
    unit_mutasi: rule.unit_mutasi,
    qty_tenths: rule.qty_tenths,
    harga: String(rule.harga),
  })),
);

function serializeSpecialPrices() {
  const normalized = specialPrices.map((rule) => ({
    unit_mutasi: rule.unit_mutasi,
    qty_tenths: rule.qty_tenths,
    harga: parseRawPrice(rule.harga),
  }));
  assertValidSpecialPriceRules(normalized);
  return normalized;
}
```

```tsx
<section className="space-y-3 rounded-md border border-border p-3">
  <div className="flex items-center justify-between">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Harga Khusus Qty
    </p>
    <Button
      onClick={() =>
        setSpecialPrices((current) => [
          ...current,
          { key: crypto.randomUUID(), unit_mutasi: "SMALL", qty_tenths: 1, harga: "" },
        ])
      }
      type="button"
      variant="outline"
    >
      Tambah harga khusus
    </Button>
  </div>

  {specialPrices.map((rule, index) => (
    <div
      className="grid gap-2 md:grid-cols-[140px_120px_minmax(0,1fr)_auto]"
      key={rule.key}
    >
      <select
        aria-label={`Unit harga khusus ${index + 1}`}
        value={rule.unit_mutasi}
        onChange={(event) => updateRule(index, { unit_mutasi: event.target.value as "SMALL" | "LARGE" })}
      >
        <option value="SMALL">Unit kecil</option>
        <option value="LARGE">Unit besar</option>
      </select>
      <select
        aria-label={`Qty harga khusus ${index + 1}`}
        value={String(rule.qty_tenths)}
        onChange={(event) => updateRule(index, { qty_tenths: Number(event.target.value) })}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
          <option key={value} value={value}>
            {(value / 10).toFixed(1)}
          </option>
        ))}
      </select>
      <Input
        aria-label={`Harga khusus ${index + 1}`}
        inputMode="numeric"
        value={rule.harga}
        onChange={(event) => updateRule(index, { harga: event.target.value })}
      />
      <Button aria-label={`Hapus harga khusus ${index + 1}`} onClick={() => removeRule(index)} type="button" variant="destructive">
        Hapus
      </Button>
    </div>
  ))}
</section>
```

- [ ] **Step 4: Re-run the offline and form tests and verify they pass**

Run: `pnpm exec vitest run tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-form-special-prices.spec.tsx --reporter=verbose`

Expected: PASS with local cache, queue payloads, and dialog submission all carrying `special_prices`.

- [ ] **Step 5: Commit the client-side product changes**

```bash
git add src/lib/offline/db.ts src/lib/offline/inventory-sync-transport.ts src/features/inventory/hooks/use-product-catalog.ts src/lib/inventory/uom.ts src/features/inventory/components/product-form-dialog.tsx tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-form-special-prices.spec.tsx
git commit -m "feat: add special price product editor"
```

### Task 4: Apply the pricing resolver to cart lines, checkout totals, and the POS item dialogs

**Files:**
- Modify: `src/features/pos/hooks/use-pos-cart.ts`
- Modify: `src/features/pos/hooks/use-pos-checkout.ts`
- Modify: `src/features/pos/components/pos-screen.tsx`
- Modify: `src/features/pos/components/pos-cart-panel.tsx`
- Modify: `src/features/pos/components/pos-cart-item-dialog.tsx`
- Modify: `src/features/pos/components/pos-payment-dialog.tsx`
- Modify: `tests/pos/checkout-payment.spec.tsx`
- Modify: `tests/pos/keyboard-cart-flow.spec.tsx`

- [ ] **Step 1: Write the failing POS pricing tests**

```ts
// tests/pos/checkout-payment.spec.tsx
it("uses automatic subtotal from pricing snapshots before applying manual discounts", async () => {
  const { computeCheckoutTotals } = await import("@/features/pos/hooks/use-pos-checkout");

  const totals = computeCheckoutTotals(
    [
      {
        id_produk: "p1",
        nama_produk: "A",
        unit_price: 10000,
        qty: 1.6,
        line_discount: 0,
        pricing_snapshot: {
          base_unit_price: 10000,
          automatic_subtotal: 17000,
          rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
          breakdown: [
            { qty: 1.1, unit_price: 10000, total: 11000, source: "base" },
            { qty: 0.5, unit_price: 6000, total: 6000, source: "special" },
          ],
        },
      },
    ],
    0,
  );

  expect(totals.subtotal).toBe(17000);
  expect(totals.total).toBe(17000);
});
```

```tsx
// tests/pos/keyboard-cart-flow.spec.tsx
it("renders special-price breakdown rows in the cart after adding a fractional qty", async () => {
  const user = userEvent.setup();
  render(<PosScreen />);

  await user.keyboard("{Enter}");
  const qtyInput = await screen.findByLabelText("Qty");
  await user.clear(qtyInput);
  await user.keyboard("1.6");
  await user.keyboard("{Enter}");

  const cartRow = screen.getByTestId("cart-row-0");
  expect(within(cartRow).getByText(/1,1 x Rp\s*10\.000/)).toBeInTheDocument();
  expect(within(cartRow).getByText(/0,5 x Rp\s*6\.000/)).toBeInTheDocument();
  expect(within(cartRow).getByText(/Rp\s*17\.000/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted POS tests and verify they fail**

Run: `pnpm exec vitest run tests/pos/checkout-payment.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx --reporter=verbose`

Expected: FAIL because checkout totals still use `qty * unit_price` and the cart only renders a single `qty x harga` row.

- [ ] **Step 3: Integrate pricing snapshots into the cart and checkout**

```ts
// src/features/pos/hooks/use-pos-cart.ts
export type PosCartLine = {
  id_produk: string;
  nama_produk: string;
  nama_produk_dasar: string;
  harga_jual: number;
  qty: number;
  line_discount: number;
  unit_mutasi: InventoryMutationUnit;
  unit_label: string;
  pricing_snapshot: PosLinePricingSnapshot;
};

function buildSnapshot(product: ProductRecord, qty: number, selectedUnit: PosCartUnitOption) {
  return resolveLinePricing({
    qty,
    unit_mutasi: selectedUnit.unit_mutasi,
    baseUnitPrice: selectedUnit.unit_price,
    rules: product.special_prices ?? [],
  });
}

function updateLineBySubtotal(index: number, nextQty: number, nextFinalSubtotal: number) {
  setLines((current) => {
    const line = current[index];
    if (!line) return current;
    const nextSnapshot = resolveLinePricing({
      qty: nextQty,
      unit_mutasi: line.unit_mutasi,
      baseUnitPrice: line.harga_jual,
      rules: line.pricing_snapshot.rules,
    });
    const cappedSubtotal = Math.max(0, Math.min(nextFinalSubtotal, nextSnapshot.automatic_subtotal));
    const next = [...current];
    next[index] = {
      ...line,
      qty: nextQty,
      pricing_snapshot: nextSnapshot,
      line_discount: Math.max(0, nextSnapshot.automatic_subtotal - cappedSubtotal),
    };
    return next;
  });
}
```

```ts
// src/features/pos/hooks/use-pos-checkout.ts
export type CheckoutLineInput = {
  id_produk: string;
  nama_produk: string;
  unit_price: number;
  qty: number;
  line_discount?: number;
  pricing_snapshot?: PosLinePricingSnapshot;
  unit_mutasi?: InventoryMutationUnit;
  unit_label?: string;
};

function getAutomaticSubtotal(line: CheckoutLineInput) {
  return line.pricing_snapshot?.automatic_subtotal ?? Math.round(line.unit_price * line.qty);
}

export function computeCheckoutTotals(lines: CheckoutLineInput[], orderDiscount = 0) {
  const subtotal = lines.reduce((sum, line) => sum + getAutomaticSubtotal(line), 0);
  const itemDiscount = lines.reduce((sum, line) => {
    const maxDiscount = getAutomaticSubtotal(line);
    const value = Math.max(0, Math.min(line.line_discount ?? 0, maxDiscount));
    return sum + value;
  }, 0);
  // keep the rest of the total math unchanged
}
```

- [ ] **Step 4: Render the breakdown in the cart and payment dialog**

```tsx
// src/features/pos/components/pos-cart-panel.tsx
function renderBreakdownRows(line: PosCartLine) {
  const rows = line.pricing_snapshot.breakdown;
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {line.qty} x {formatCurrencyIdr(line.harga_jual)}
      </p>
    );
  }

  return rows.map((row, index) => (
    <p className="text-xs text-muted-foreground" key={`${line.id_produk}-breakdown-${index}`}>
      {row.qty.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} x{" "}
      {formatCurrencyIdr(row.unit_price)}
    </p>
  ));
}
```

```tsx
// src/features/pos/components/pos-cart-item-dialog.tsx
const automaticSubtotal = line?.pricing_snapshot.automatic_subtotal ?? Math.round(unitPrice * qtyPreview);

<div className="space-y-1 text-sm">
  <p>
    Harga dasar: <span className="font-medium">{formatCurrencyIdr(unitPrice)}</span>
  </p>
  {line?.pricing_snapshot.breakdown.map((row, index) => (
    <p className="text-xs text-muted-foreground" key={index}>
      {row.qty.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} x{" "}
      {formatCurrencyIdr(row.unit_price)}
    </p>
  ))}
  <p>
    Subtotal otomatis: <span className="font-medium">{formatCurrencyIdr(automaticSubtotal)}</span>
  </p>
</div>
```

- [ ] **Step 5: Re-run the targeted POS tests and verify they pass**

Run: `pnpm exec vitest run tests/pos/checkout-payment.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx --reporter=verbose`

Expected: PASS with automatic subtotals and breakdown rows rendered in the cart.

- [ ] **Step 6: Commit the POS cart and checkout integration**

```bash
git add src/features/pos/hooks/use-pos-cart.ts src/features/pos/hooks/use-pos-checkout.ts src/features/pos/components/pos-screen.tsx src/features/pos/components/pos-cart-panel.tsx src/features/pos/components/pos-cart-item-dialog.tsx src/features/pos/components/pos-payment-dialog.tsx tests/pos/checkout-payment.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx
git commit -m "feat: apply special price breakdown in pos cart"
```

### Task 5: Persist pricing snapshots through transaction history, sync, and receipts

**Files:**
- Modify: `src/features/pos/lib/transaction-history-update.ts`
- Modify: `src/lib/db/pos-transactions.ts`
- Modify: `src/app/api/sync/pos-transactions/route.ts`
- Modify: `src/lib/offline/pos-transaction-history.ts`
- Modify: `src/features/pos/lib/receipt-format.ts`
- Modify: `src/features/pos/components/transaction-edit-dialog.tsx`
- Modify: `src/features/pos/components/pos-transactions-screen.tsx`
- Modify: `tests/pos/transaction-history-update.spec.ts`
- Modify: `tests/pos/pos-transaction-sync.spec.ts`
- Modify: `tests/pos/receipt-formatting.spec.ts`
- Modify: `tests/pos/pos-transaction-screen.spec.tsx`

- [ ] **Step 1: Write the failing transaction-history, sync, and receipt tests**

```ts
// tests/pos/transaction-history-update.spec.ts
it("recalculates existing transaction lines from their stored pricing snapshot", async () => {
  const existingSnapshot = {
    base_unit_price: 10000,
    automatic_subtotal: 17000,
    rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    breakdown: [
      { qty: 1.1, unit_price: 10000, total: 11000, source: "base" },
      { qty: 0.5, unit_price: 6000, total: 6000, source: "special" },
    ],
  };

  getTransaction.mockResolvedValueOnce({
    id_transaksi: "tx-1",
    short_id: "TRX-001",
    kasir_user_id: "cashier-1",
    kasir_username: "cashier",
    payment_method: "cash",
    subtotal_amount: 17000,
    item_discount: 0,
    order_discount: 0,
    total_amount: 17000,
    amount_received: 17000,
    change_amount: 0,
    counts_for_cash: true,
    note: "catatan awal",
    is_deleted: false,
    client_timestamp: Date.parse("2026-06-09T09:00:00.000Z"),
    createdAt: Date.parse("2026-06-09T09:00:00.000Z"),
    lines: [
      {
        id_produk: "prod-1",
        nama_produk: "Produk 1",
        unit_price: 10000,
        qty: 1.6,
        unit_mutasi: "SMALL",
        unit_label: "pcs",
        line_discount: 0,
        line_total: 17000,
        pricing_snapshot: existingSnapshot,
      },
    ],
  });

  const { updateTransactionHistory } = await import("@/features/pos/lib/transaction-history-update");
  await updateTransactionHistory({
    id_transaksi: "tx-1",
    payment_method: "cash",
    lines: [
      {
        id_produk: "prod-1",
        nama_produk: "Produk 1",
        unit_price: 10000,
        qty: 1.6,
        unit_mutasi: "SMALL",
        unit_label: "pcs",
        line_discount: 500,
        line_total: 16500,
        pricing_snapshot: existingSnapshot,
      },
    ],
  });

  expect(putTransaction.mock.calls[0][0].lines[0].line_total).toBe(16500);
});
```

```ts
// tests/pos/pos-transaction-sync.spec.ts
it("keeps pricing snapshots in the queued pos_transaction payload", async () => {
  const { persistPosTransaction } = await import("@/features/pos/hooks/use-pos-checkout");

  await persistPosTransaction({
    lines: [
      {
        id_produk: "p1",
        nama_produk: "A",
        unit_price: 10000,
        qty: 1.6,
        pricing_snapshot: {
          base_unit_price: 10000,
          automatic_subtotal: 17000,
          rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
          breakdown: [
            { qty: 1.1, unit_price: 10000, total: 11000, source: "base" },
            { qty: 0.5, unit_price: 6000, total: 6000, source: "special" },
          ],
        },
      },
    ],
    payment_method: "cash",
  });

  expect(putTx.mock.calls[0][0].lines[0].pricing_snapshot).toBeDefined();
});
```

```ts
// tests/pos/receipt-formatting.spec.ts
it("prints special-price breakdown rows before the subtotal line", () => {
  const text = buildReceiptText(settings, {
    ...cashTransaction,
    lines: [
      {
        id_produk: "p1",
        nama_produk: "Kopi Susu",
        unit_price: 10000,
        qty: 1.6,
        line_discount: 0,
        line_total: 17000,
        pricing_snapshot: {
          base_unit_price: 10000,
          automatic_subtotal: 17000,
          rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
          breakdown: [
            { qty: 1.1, unit_price: 10000, total: 11000, source: "base" },
            { qty: 0.5, unit_price: 6000, total: 6000, source: "special" },
          ],
        },
      },
    ],
  });

  expect(text).toContain("1.1 x 10.000");
  expect(text).toContain("0.5 x 6.000");
  expect(text).toContain("Sub 17.000");
});
```

- [ ] **Step 2: Run the history, sync, and receipt tests and verify they fail**

Run: `pnpm exec vitest run tests/pos/transaction-history-update.spec.ts tests/pos/pos-transaction-sync.spec.ts tests/pos/receipt-formatting.spec.ts tests/pos/pos-transaction-screen.spec.tsx --reporter=verbose`

Expected: FAIL because `pricing_snapshot` is neither stored nor rendered yet.

- [ ] **Step 3: Persist and normalize pricing snapshots across the transaction pipeline**

```ts
// src/lib/offline/db.ts
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
};
```

```ts
// src/lib/db/pos-transactions.ts
lines: Array<{
  id_produk: string;
  nama_produk: string;
  unit_price: number;
  qty: number;
  unit_mutasi?: "SMALL" | "LARGE";
  unit_label?: string;
  line_discount: number;
  line_total: number;
  pricing_snapshot?: PosLinePricingSnapshot;
}>;

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
    pricing_snapshot: line.pricing_snapshot ?? undefined,
  })),
});
```

```ts
// src/features/pos/lib/transaction-history-update.ts
function getAutomaticSubtotal(line: PosTransactionLineRecord) {
  return line.pricing_snapshot?.automatic_subtotal ?? Math.round(line.unit_price * line.qty);
}

function normalizeLine(line: PosTransactionLineRecord): PosTransactionLineRecord {
  const automaticSubtotal = getAutomaticSubtotal(line);
  const lineDiscount = Math.max(0, Math.min(Math.trunc(line.line_discount), automaticSubtotal));

  return {
    ...line,
    line_discount: lineDiscount,
    line_total: Math.max(0, automaticSubtotal - lineDiscount),
  };
}
```

- [ ] **Step 4: Render the same breakdown in receipt and transaction history**

```ts
// src/features/pos/lib/receipt-format.ts
function buildItemDetailLines(item: PosTransactionRecord["lines"][number]) {
  const snapshotRows = item.pricing_snapshot?.breakdown;
  if (snapshotRows && snapshotRows.length > 0) {
    return [
      ...snapshotRows.map(
        (row) =>
          `${row.qty.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
          })} x ${formatCompactReceiptNumber(row.unit_price)}`,
      ),
      `Sub ${formatCompactReceiptNumber(item.line_total)}`,
    ];
  }

  return buildLegacyDetailLines(item.qty, item.unit_price, item.line_total, item.line_discount);
}
```

```tsx
// src/features/pos/components/pos-transactions-screen.tsx
function renderTransactionBreakdown(line: PosTransactionRecord["lines"][number]) {
  const rows = line.pricing_snapshot?.breakdown;
  if (!rows?.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {line.qty} x {formatCurrencyIdr(line.unit_price)}
        {line.unit_label ? ` / ${line.unit_label}` : ""}
      </p>
    );
  }

  return rows.map((row, index) => (
    <p className="text-xs text-muted-foreground" key={`${line.id_produk}-detail-${index}`}>
      {row.qty.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} x{" "}
      {formatCurrencyIdr(row.unit_price)}
    </p>
  ));
}
```

- [ ] **Step 5: Re-run the history, sync, and receipt tests and verify they pass**

Run: `pnpm exec vitest run tests/pos/transaction-history-update.spec.ts tests/pos/pos-transaction-sync.spec.ts tests/pos/receipt-formatting.spec.ts tests/pos/pos-transaction-screen.spec.tsx --reporter=verbose`

Expected: PASS with `pricing_snapshot` carried through local storage, sync payloads, history updates, and receipt output.

- [ ] **Step 6: Commit the transaction-pipeline changes**

```bash
git add src/features/pos/lib/transaction-history-update.ts src/lib/db/pos-transactions.ts src/app/api/sync/pos-transactions/route.ts src/lib/offline/pos-transaction-history.ts src/features/pos/lib/receipt-format.ts src/features/pos/components/transaction-edit-dialog.tsx src/features/pos/components/pos-transactions-screen.tsx tests/pos/transaction-history-update.spec.ts tests/pos/pos-transaction-sync.spec.ts tests/pos/receipt-formatting.spec.ts tests/pos/pos-transaction-screen.spec.tsx
git commit -m "feat: persist special price snapshots in transactions"
```

### Task 6: Run final verification and update quick-task artifacts

**Files:**
- Modify: `.planning/quick/260612-7i4-tambahkan-fitur-harga-khusus-per-qty-di-/260612-7i4-SUMMARY.md`
- Modify: `.planning/STATE.md`

- [ ] **Step 1: Run the targeted inventory and POS suites**

Run: `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-form-special-prices.spec.tsx tests/pos/special-pricing.spec.ts tests/pos/checkout-payment.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/pos/transaction-history-update.spec.ts tests/pos/pos-transaction-sync.spec.ts tests/pos/receipt-formatting.spec.ts tests/pos/pos-transaction-screen.spec.tsx --reporter=verbose`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Run lint on touched files**

Run: `pnpm exec eslint src/lib/pricing/special-price.ts src/features/pos/lib/special-pricing.ts src/features/inventory/components/product-form-dialog.tsx src/features/pos/hooks/use-pos-cart.ts src/features/pos/hooks/use-pos-checkout.ts src/features/pos/components/pos-cart-panel.tsx src/features/pos/components/pos-cart-item-dialog.tsx src/features/pos/components/pos-payment-dialog.tsx src/features/pos/lib/receipt-format.ts src/features/pos/components/transaction-edit-dialog.tsx src/features/pos/components/pos-transactions-screen.tsx tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-form-special-prices.spec.tsx tests/pos/special-pricing.spec.ts tests/pos/checkout-payment.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/pos/transaction-history-update.spec.ts tests/pos/pos-transaction-sync.spec.ts tests/pos/receipt-formatting.spec.ts tests/pos/pos-transaction-screen.spec.tsx`

Expected: PASS with zero lint errors.

- [ ] **Step 3: Run Prisma generate and the production build**

Run: `pnpm exec prisma validate`

Expected: PASS with a valid Prisma schema and generated migration history.

Run: `pnpm exec prisma generate`

Expected: PASS with an updated Prisma client.

Run: `pnpm build`

Expected: PASS with a successful Next.js production build.

- [ ] **Step 4: Write the quick-task summary**

```md
---
status: complete
quick_task: 260612-7i4
completed_on: 2026-06-12
code_commit: 4d3c2b1
---

# Quick Task 260612-7i4 Summary

## Outcome

- Menambahkan harga khusus per qty di master produk dengan Prisma migration.
- Menghitung subtotal POS secara otomatis dengan exact-first special-price resolver.
- Menampilkan breakdown harga campuran di POS, histori transaksi, dan receipt.

## Verification

- `pnpm exec vitest run ...`
- `pnpm exec eslint ...`
- `pnpm exec prisma generate`
- `pnpm build`
```

Capture the real final code hash with `git rev-parse --short HEAD` and replace `4d3c2b1` with that exact value when writing the summary file.

- [ ] **Step 5: Commit the verification artifacts**

```bash
git add .planning/quick/260612-7i4-tambahkan-fitur-harga-khusus-per-qty-di-/260612-7i4-SUMMARY.md .planning/STATE.md
git commit -m "docs(quick-260612-7i4): record special price per qty completion"
```
