# POS Three-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the POS desktop layout into product, cart, and summary/action panes without changing keyboard flow, cursor flow, shortcut behavior, or fuzzy-search behavior.

**Architecture:** Keep `PosScreen` as the owner of search state, focus mode, dialog state, and checkout state, but move discount, totals, note, and action buttons into a dedicated summary component. Make the product list and cart list the only repeating scroll bodies, then let responsive grid placement decide whether the summary panel appears in a third desktop column or below the cart on tablet landscape.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Playwright

---

## File Map

- Modify: `src/app/app/pos/page.tsx`
  Purpose: Extend the constrained-height workspace from `xl` to `lg` so tablet landscape can also use internal list scrolling.
- Modify: `src/features/pos/components/pos-screen.tsx`
  Purpose: Own the new 3/2/1 responsive pane composition while preserving the existing keyboard contract.
- Modify: `src/features/pos/components/pos-cart-panel.tsx`
  Purpose: Reduce this component to a cart-list-only pane and compact each cart row.
- Create: `src/features/pos/components/pos-transaction-summary-panel.tsx`
  Purpose: Hold order discount, totals, transaction note, and `Tunai` / `Transfer` / `Void` actions in one dedicated pane.
- Modify: `src/features/pos/components/pos-product-table.tsx`
  Purpose: Keep the product pane's list body as an explicitly testable internal scroll region.
- Modify: `tests/pos/keyboard-cart-flow.spec.tsx`
  Purpose: Freeze the layout refactor against existing keyboard and checkout behavior while pointing transaction-control assertions at the new summary pane.
- Modify: `tests/e2e/pos-keyboard-cart.spec.ts`
  Purpose: Guard the new desktop 3-column layout, tablet landscape 2-column layout, and no-page-scroll behavior without changing the seeded keyboard flow.

### Task 1: Lock the Refactor Behind Failing Contract Tests

**Files:**
- Modify: `tests/pos/keyboard-cart-flow.spec.tsx`
- Modify: `tests/e2e/pos-keyboard-cart.spec.ts`

- [ ] **Step 1: Write the failing tests**

Update `tests/pos/keyboard-cart-flow.spec.tsx` so the refactor is forced to expose a dedicated summary pane and remove the per-row helper text without changing the existing keyboard path:

```tsx
it("renders transaction controls in a dedicated summary panel while keeping cart focus behavior intact", async () => {
  const user = userEvent.setup();
  render(<PosScreen />);

  await user.keyboard("{Enter}");
  await user.keyboard("{Enter}");

  const cartPanel = screen.getByTestId("cart-panel");
  const summaryPanel = screen.getByTestId("transaction-summary-panel");

  expect(within(cartPanel).queryByText("Diskon total transaksi (IDR)")).not.toBeInTheDocument();
  expect(
    within(cartPanel).queryByText("Tekan Enter untuk edit qty/subtotal item"),
  ).not.toBeInTheDocument();
  expect(within(summaryPanel).getByTestId("order-discount-input")).toHaveValue("0");
  expect(within(summaryPanel).getByRole("button", { name: "Tunai (F8)" })).toBeEnabled();
  expect(within(summaryPanel).getByRole("button", { name: "Transfer (F9)" })).toBeEnabled();
});
```

Also change the existing void test in the same file so it targets the new summary pane rather than assuming the discount input still lives inside `cart-panel`:

```tsx
const summaryPanel = screen.getByTestId("transaction-summary-panel");
const noteInput = within(summaryPanel).getByTestId("transaction-note");
const discountInput = within(summaryPanel).getByTestId("order-discount-input");
const voidButton = within(summaryPanel).getByRole("button", { name: "Void (F10)" });
```

Then extend `tests/e2e/pos-keyboard-cart.spec.ts` with a desktop-specific layout check that must fail until the new pane split exists:

```ts
test("pos desktop layout keeps product and cart lists scrollable while summary lives in a third column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  await page.locator("main").click();
  await page.keyboard.type("produk");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Qty Item" }).getByRole("button", { name: "Simpan" }).click();

  const metrics = await page.evaluate(() => {
    const productTable = document.querySelector('[data-testid="product-table"]');
    const cartList = document.querySelector('[data-testid="cart-list"]');
    const cartPanel = document.querySelector('[data-testid="cart-panel"]');
    const summaryPanel = document.querySelector('[data-testid="transaction-summary-panel"]');
    const productRect = productTable?.getBoundingClientRect();
    const cartRect = cartPanel?.getBoundingClientRect();
    const summaryRect = summaryPanel?.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      productOverflowY: productTable ? getComputedStyle(productTable).overflowY : null,
      cartOverflowY: cartList ? getComputedStyle(cartList).overflowY : null,
      summaryToRight: Boolean(summaryRect && cartRect && summaryRect.left >= cartRect.right - 8),
      productHeight: productRect?.height ?? 0,
      cartHeight: cartRect?.height ?? 0,
    };
  });

  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.productOverflowY).toBe("auto");
  expect(metrics.cartOverflowY).toBe("auto");
  expect(metrics.summaryToRight).toBe(true);
  expect(metrics.productHeight).toBeGreaterThan(240);
  expect(metrics.cartHeight).toBeGreaterThan(240);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
pnpm exec vitest run tests/pos/keyboard-cart-flow.spec.tsx --reporter=verbose
pnpm exec playwright test tests/e2e/pos-keyboard-cart.spec.ts --config playwright.config.ts --grep "third column"
```

Expected:

```text
FAIL  tests/pos/keyboard-cart-flow.spec.tsx
+ Unable to find an element by: [data-testid="transaction-summary-panel"]

FAIL  tests/e2e/pos-keyboard-cart.spec.ts
+ Expected summaryToRight to be true
```

- [ ] **Step 3: Write the minimal implementation that makes those tests pass**

Create `src/features/pos/components/pos-transaction-summary-panel.tsx`:

```tsx
"use client";

import { formatCurrencyIdr } from "@/features/format/currency";

type Props = {
  linesCount: number;
  subtotal: number;
  itemDiscountTotal: number;
  orderDiscount: number;
  total: number;
  note: string;
  onNoteChange: (value: string) => void;
  onOrderDiscountChange: (value: number) => void;
  onCashCheckout: () => void;
  onTransferCheckout: () => void;
  onVoidTransaction: () => void;
};

export function PosTransactionSummaryPanel({
  linesCount,
  subtotal,
  itemDiscountTotal,
  orderDiscount,
  total,
  note,
  onNoteChange,
  onOrderDiscountChange,
  onCashCheckout,
  onTransferCheckout,
  onVoidTransaction,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="transaction-summary-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ringkasan Transaksi</p>
        <p className="text-xs text-muted-foreground">{linesCount} item</p>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Diskon total transaksi (IDR)</span>
        <input
          className="w-full rounded border border-input bg-background px-2 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="order-discount-input"
          inputMode="numeric"
          onChange={(event) => onOrderDiscountChange(Number(event.target.value || "0"))}
          value={String(orderDiscount)}
        />
      </label>

      <div className="space-y-1 rounded-md border border-border/70 bg-muted/30 p-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal Keranjang</span>
          <span>{formatCurrencyIdr(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diskon Item</span>
          <span>- {formatCurrencyIdr(itemDiscountTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diskon Transaksi</span>
          <span>- {formatCurrencyIdr(orderDiscount)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/80 pt-1 font-semibold">
          <span>Total</span>
          <span data-testid="cart-total">{formatCurrencyIdr(total)}</span>
        </div>
      </div>

      <label className="space-y-1 text-sm">
        <span>Catatan transaksi (opsional)</span>
        <textarea
          className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-20"
          data-testid="transaction-note"
          onChange={(event) => onNoteChange(event.target.value)}
          value={note}
        />
      </label>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-cash-button"
            disabled={linesCount === 0}
            onClick={onCashCheckout}
            type="button"
          >
            Tunai (F8)
          </button>
          <button
            className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-transfer-button"
            disabled={linesCount === 0}
            onClick={onTransferCheckout}
            type="button"
          >
            Transfer (F9)
          </button>
        </div>
        <button
          className="w-full rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="void-button"
          disabled={linesCount === 0}
          onClick={onVoidTransaction}
          type="button"
        >
          Void (F10)
        </button>
      </div>
    </div>
  );
}
```

Refactor `src/features/pos/components/pos-cart-panel.tsx` so it is list-only and exposes a scroll-region test id:

```tsx
type Props = {
  lines: PosCartLine[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  focusMode: "products" | "cart";
};

export function PosCartPanel({ lines, activeIndex, onSelect, focusMode }: Props) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden",
        focusMode === "cart" ? "border-white ring-2 ring-white/80" : "border-border",
      )}
      data-testid="cart-panel"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Keranjang</p>
        <p className="text-xs text-muted-foreground">{lines.length} item</p>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Belum ada item.
        </p>
      ) : (
        <div
          className="max-h-80 space-y-1 overflow-auto rounded-md border border-border/80 bg-background/40 p-1 lg:min-h-0 lg:flex-1 lg:max-h-none"
          data-testid="cart-list"
        >
          {lines.map((line, idx) => (
            <button
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded px-2 py-1.5 text-left text-sm",
                focusMode === "cart" && activeIndex === idx
                  ? "bg-primary/10 ring-2 ring-white"
                  : "hover:bg-muted",
              )}
              data-active={focusMode === "cart" && activeIndex === idx ? "true" : "false"}
              data-testid={`cart-row-${idx}`}
              key={line.id_produk}
              onClick={() => onSelect(idx)}
              type="button"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium">{line.nama_produk}</p>
                <p className="text-xs text-muted-foreground">
                  {line.qty} x {formatCurrencyIdr(line.harga_jual)}
                </p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-xs font-medium">{formatCurrencyIdr(line.qty * line.harga_jual)}</p>
                <p className="text-[11px] text-muted-foreground">- {formatCurrencyIdr(line.line_discount)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Wire the new summary pane from `src/features/pos/components/pos-screen.tsx` without touching the existing keyboard handler:

```tsx
import { PosTransactionSummaryPanel } from "@/features/pos/components/pos-transaction-summary-panel";

<div
  className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(280px,1fr)] xl:grid-rows-[minmax(0,1fr)]"
  data-testid="pos-workspace"
>
  <div className="space-y-2 lg:col-start-1 lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col xl:row-span-1">
    {loading ? <p className="text-sm text-muted-foreground">Memuat produk...</p> : null}
    <PosProductTable
      activeIndex={safeProductIndex}
      focusMode={focusMode}
      onSelect={(idx) => {
        setProductIndex(idx);
        setFocusMode("products");
      }}
      onSubmit={(product) => {
        const idx = filteredProducts.findIndex((row) => row.id_produk === product.id_produk);
        if (idx >= 0) openQtyForProduct(idx);
      }}
      results={filteredProductResults}
    />
  </div>

  <div className="lg:col-start-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col">
    <PosCartPanel
      activeIndex={safeCartIndex}
      focusMode={focusMode}
      lines={lines}
      onSelect={(idx) => {
        setCartIndex(idx);
        setFocusMode("cart");
      }}
    />
  </div>

  <div className="lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1">
    <PosTransactionSummaryPanel
      itemDiscountTotal={totals.itemDiscount}
      linesCount={lines.length}
      note={note}
      onCashCheckout={() => openPayment("cash")}
      onNoteChange={setNote}
      onOrderDiscountChange={(value) => setOrderDiscountInput(Math.max(0, Math.trunc(value)))}
      onTransferCheckout={() => openPayment("bank_transfer")}
      onVoidTransaction={requestVoidTransaction}
      orderDiscount={totals.orderDiscount}
      subtotal={totals.subtotal}
      total={totals.total}
    />
  </div>
</div>
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run:

```powershell
pnpm exec vitest run tests/pos/keyboard-cart-flow.spec.tsx --reporter=verbose
pnpm exec playwright test tests/e2e/pos-keyboard-cart.spec.ts --config playwright.config.ts --grep "third column"
```

Expected:

```text
PASS  tests/pos/keyboard-cart-flow.spec.tsx
PASS  tests/e2e/pos-keyboard-cart.spec.ts
```

- [ ] **Step 5: Commit the passing slice**

```powershell
git add src/features/pos/components/pos-screen.tsx src/features/pos/components/pos-cart-panel.tsx src/features/pos/components/pos-transaction-summary-panel.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/e2e/pos-keyboard-cart.spec.ts
git commit -m "feat: split POS cart and summary panes"
```

### Task 2: Make the Responsive Grid Match the Approved 3/2/1 Design

**Files:**
- Modify: `src/app/app/pos/page.tsx`
- Modify: `src/features/pos/components/pos-screen.tsx`
- Modify: `src/features/pos/components/pos-product-table.tsx`

- [ ] **Step 1: Write the failing responsive expectations**

Add one more assertion block to `tests/e2e/pos-keyboard-cart.spec.ts` so the route shell is forced to constrain height at `lg` and keep list panes as internal scroll surfaces:

```ts
test("pos tablet landscape moves summary below the cart without changing keyboard flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  await page.locator("main").click();
  await page.keyboard.type("produk");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Qty Item" }).getByRole("button", { name: "Simpan" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("cart-row-0")).toHaveAttribute("data-active", "true");

  const layout = await page.evaluate(() => {
    const cartPanel = document.querySelector('[data-testid="cart-panel"]');
    const summaryPanel = document.querySelector('[data-testid="transaction-summary-panel"]');
    const cartRect = cartPanel?.getBoundingClientRect();
    const summaryRect = summaryPanel?.getBoundingClientRect();

    return {
      summaryBelowCart: Boolean(
        summaryRect &&
          cartRect &&
          summaryRect.top >= cartRect.bottom - 8 &&
          Math.abs(summaryRect.left - cartRect.left) <= 8,
      ),
    };
  });

  expect(layout.summaryBelowCart).toBe(true);
});

test("pos landscape workspace stays inside the viewport and keeps the product list scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const workspace = document.querySelector('[data-testid="pos-workspace"]');
    const productTable = document.querySelector('[data-testid="product-table"]');
    const workspaceRect = workspace?.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      workspaceHeight: workspaceRect?.height ?? 0,
      productOverflowY: productTable ? getComputedStyle(productTable).overflowY : null,
    };
  });

  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.workspaceHeight).toBeGreaterThan(300);
  expect(metrics.productOverflowY).toBe("auto");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
pnpm exec playwright test tests/e2e/pos-keyboard-cart.spec.ts --config playwright.config.ts --grep "landscape workspace stays inside the viewport"
```

Expected:

```text
FAIL  tests/e2e/pos-keyboard-cart.spec.ts
+ Expected documentHeight to be less than or equal to viewportHeight
```

- [ ] **Step 3: Implement the responsive layout and density polish**

Update `src/app/app/pos/page.tsx` so the constrained-height shell begins at `lg` instead of only `xl`:

```tsx
export default function PosPage() {
  return (
    <main className="space-y-4 lg:flex lg:h-[calc(100dvh-7rem)] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:space-y-3">
      <header className="space-y-1 lg:flex-none">
        <h1 className="text-2xl font-semibold">POS</h1>
        <p className="text-sm text-muted-foreground">
          Cari produk, atur qty, dan checkout cepat dengan keyboard.
        </p>
      </header>
      <PosScreen />
    </main>
  );
}
```

Update the `PosScreen` wrapper classes to use the same `lg` floor so product and cart wrappers can actually shrink and scroll internally on tablet landscape:

```tsx
return (
  <section className="space-y-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
    {printStatusMessage ? (
      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          printStatusType === "success"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-destructive/40 bg-destructive/10 text-destructive"
        }`}
      >
        {printStatusMessage}
      </div>
    ) : null}

    <div className="rounded-lg border border-border bg-card p-3 lg:flex-none">
      <Input ... />
      <p className="mt-2 text-xs text-muted-foreground">
        Ketik langsung untuk cari produk | Arrow atas/bawah navigasi | Enter pilih/edit |
        Arrow kanan ke keranjang | Delete hapus item | F8 tunai | F9 transfer | F10 void
      </p>
      <Link className="mt-2 inline-block text-xs text-primary underline underline-offset-2" href="/app/settings/printer">
        Ubah pengaturan QZ Tray
      </Link>
    </div>

    <div
      className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(280px,1fr)] xl:grid-rows-[minmax(0,1fr)]"
      data-testid="pos-workspace"
    >
      <div className="space-y-2 lg:col-start-1 lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col xl:row-span-1">
        {loading ? <p className="text-sm text-muted-foreground">Memuat produk...</p> : null}
        <PosProductTable
          activeIndex={safeProductIndex}
          focusMode={focusMode}
          onSelect={(idx) => {
            setProductIndex(idx);
            setFocusMode("products");
          }}
          onSubmit={(product) => {
            const idx = filteredProducts.findIndex((row) => row.id_produk === product.id_produk);
            if (idx >= 0) openQtyForProduct(idx);
          }}
          results={filteredProductResults}
        />
      </div>

      <div className="lg:col-start-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col">
        <PosCartPanel
          activeIndex={safeCartIndex}
          focusMode={focusMode}
          lines={lines}
          onSelect={(idx) => {
            setCartIndex(idx);
            setFocusMode("cart");
          }}
        />
      </div>

      <div className="lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1">
        <PosTransactionSummaryPanel
          itemDiscountTotal={totals.itemDiscount}
          linesCount={lines.length}
          note={note}
          onCashCheckout={() => openPayment("cash")}
          onNoteChange={setNote}
          onOrderDiscountChange={(value) => setOrderDiscountInput(Math.max(0, Math.trunc(value)))}
          onTransferCheckout={() => openPayment("bank_transfer")}
          onVoidTransaction={requestVoidTransaction}
          orderDiscount={totals.orderDiscount}
          subtotal={totals.subtotal}
          total={totals.total}
        />
      </div>
    </div>
  </section>
);
```

Keep `src/features/pos/components/pos-product-table.tsx` as the explicit scroll body and make the `lg` breakpoint match the new shell:

```tsx
return (
  <div
    className="max-h-[26rem] overflow-auto rounded-lg border border-border lg:min-h-0 lg:flex-1 lg:max-h-none"
    data-testid="product-table"
  >
    {results.map((result, idx) => (
      <button
        className={cn(
          "flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm",
          focusMode === "products" && activeIndex === idx
            ? "bg-primary/10 ring-2 ring-white"
            : "hover:bg-muted/60",
        )}
        data-active={focusMode === "products" && activeIndex === idx ? "true" : "false"}
        data-testid={`product-row-${idx}`}
        key={result.product.id_produk}
        onClick={() => onSelect(idx)}
        onDoubleClick={() => onSubmit(result.product)}
        type="button"
      >
        <span>
          {highlightMatchedText(
            result.product.nama_produk,
            getProductMatchIndices(result.matches, "nama_produk"),
          )}
        </span>
        <span className="text-muted-foreground">
          Rp{result.product.harga_jual.toLocaleString("id-ID")}
        </span>
      </button>
    ))}
  </div>
);
```

- [ ] **Step 4: Run the responsive e2e slice to verify it passes**

Run:

```powershell
pnpm exec playwright test tests/e2e/pos-keyboard-cart.spec.ts --config playwright.config.ts --grep "desktop layout|tablet landscape|landscape workspace"
```

Expected:

```text
PASS  tests/e2e/pos-keyboard-cart.spec.ts
```

- [ ] **Step 5: Commit the responsive slice**

```powershell
git add src/app/app/pos/page.tsx src/features/pos/components/pos-screen.tsx src/features/pos/components/pos-product-table.tsx tests/e2e/pos-keyboard-cart.spec.ts
git commit -m "feat: adapt POS layout for desktop and tablet panes"
```

### Task 3: Run the Frozen-Behavior Regression Suite

**Files:**
- Verify only: `tests/pos/dialog-action-navigation.spec.tsx`
- Verify only: `tests/search/product-fuzzy-search.spec.ts`
- Verify only: `tests/pos/keyboard-cart-flow.spec.tsx`
- Verify only: `tests/e2e/pos-keyboard-cart.spec.ts`
- Verify only: `src/lib/shortcuts/pos-contract.ts`

- [ ] **Step 1: Run the full targeted automated suite**

Run:

```powershell
pnpm exec vitest run tests/pos/keyboard-cart-flow.spec.tsx tests/pos/dialog-action-navigation.spec.tsx tests/search/product-fuzzy-search.spec.ts --reporter=verbose
pnpm exec playwright test tests/e2e/pos-keyboard-cart.spec.ts --config playwright.config.ts
pnpm exec eslint src/app/app/pos/page.tsx src/features/pos/components/pos-screen.tsx src/features/pos/components/pos-cart-panel.tsx src/features/pos/components/pos-product-table.tsx src/features/pos/components/pos-transaction-summary-panel.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/pos/dialog-action-navigation.spec.tsx tests/search/product-fuzzy-search.spec.ts tests/e2e/pos-keyboard-cart.spec.ts
```

Expected:

```text
PASS  tests/pos/keyboard-cart-flow.spec.tsx
PASS  tests/pos/dialog-action-navigation.spec.tsx
PASS  tests/search/product-fuzzy-search.spec.ts
PASS  tests/e2e/pos-keyboard-cart.spec.ts
No ESLint warnings or errors
```

- [ ] **Step 2: Manually verify the three required responsive viewports**

Use these manual checks:

```text
Desktop 1366x768:
- page has no browser scrollbar
- product pane is leftmost, cart pane is centered, summary pane is rightmost
- product list and cart list each scroll internally if content exceeds pane height

Tablet landscape 1024x768:
- product pane stays on the left
- cart pane stays above the summary pane on the right
- ArrowRight still activates the cart row, not the summary pane

Mobile 390x844:
- layout falls back to a single vertical flow
- no clipped buttons, no overlapping textarea, no unreadable row text
```

- [ ] **Step 3: Inspect the frozen behavior surfaces before closing the task**

Run:

```powershell
git diff -- src/features/pos/components/pos-screen.tsx src/features/pos/components/pos-cart-panel.tsx src/features/pos/components/pos-product-table.tsx src/lib/shortcuts/pos-contract.ts
```

Expected:

```text
- no diff in src/lib/shortcuts/pos-contract.ts
- no keyboard-handler semantic changes in PosScreen beyond pane composition and moved props
- no fuzzy-search algorithm changes anywhere under src/lib/search/
```

## Self-Review

### Spec coverage

- Desktop 3-column layout: covered in Task 1 and Task 2.
- Tablet landscape 2-column with summary below cart: covered in Task 1 and Task 2.
- Mobile stacked fallback: covered in Task 3 manual QA.
- Product and cart internal scroll: covered in Task 1 desktop e2e and Task 2 landscape e2e.
- Frozen keyboard flow, cursor flow, shortcut contract, fuzzy-search flow: covered in Task 3 regression suite and diff inspection.

### Placeholder scan

- No `TODO`, `TBD`, or implied "figure it out later" instructions remain.
- Every code-changing step includes exact file paths, commands, and code snippets.

### Type consistency

- `PosTransactionSummaryPanel` props use the current `PosScreen` state shape: `note`, `orderDiscount`, `subtotal`, `itemDiscountTotal`, `total`, and the existing checkout callbacks.
- The existing `cart-total`, `transaction-note`, `checkout-cash-button`, `checkout-transfer-button`, and `void-button` test ids are preserved so payment and receipt flows do not need behavioral rewrites.
