import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("Password").fill("owner12345");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/app");
}

test("desktop sidebar collapse persists per browser and gives more room to POS", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByTestId("product-table")).toBeVisible();
  await expect(page.getByTestId("app-shell-sidebar-trigger")).toBeVisible();

  const readWidths = async () =>
    page.evaluate(() => ({
      mainWidth:
        document.querySelector("[data-testid='app-shell-main']")?.getBoundingClientRect().width ??
        0,
      workspaceWidth:
        document.querySelector("[data-testid='pos-workspace']")?.getBoundingClientRect().width ?? 0,
    }));

  const beforeCollapse = await readWidths();

  await page.getByTestId("app-shell-sidebar-trigger").click();

  await expect
    .poll(async () => (await readWidths()).mainWidth)
    .toBeGreaterThan(beforeCollapse.mainWidth + 150);

  const collapsed = await readWidths();
  expect(collapsed.workspaceWidth).toBeGreaterThan(beforeCollapse.workspaceWidth + 150);

  await page.reload();
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByTestId("product-table")).toBeVisible();

  const afterReload = await readWidths();
  expect(afterReload.mainWidth).toBeGreaterThan(beforeCollapse.mainWidth + 150);
  expect(afterReload.workspaceWidth).toBeGreaterThan(beforeCollapse.workspaceWidth + 150);
});

test("wide screens expand the app shell and give more room to POS product and cart columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);
  await expect(page.getByRole("heading", { name: /Selamat datang/i })).toBeVisible();

  const dashboardMetrics = await page.evaluate(() => {
    const headerShell = document.querySelector("[data-testid='app-shell-header']");
    const bodyShell = document.querySelector("[data-testid='app-shell-body']");
    const dashboardMain = document.querySelector("[data-testid='app-main-content']");

    return {
      viewportWidth: window.innerWidth,
      headerWidth: headerShell?.getBoundingClientRect().width ?? 0,
      bodyWidth: bodyShell?.getBoundingClientRect().width ?? 0,
      mainWidth: dashboardMain?.getBoundingClientRect().width ?? 0,
    };
  });

  expect(dashboardMetrics.headerWidth).toBeGreaterThan(1600);
  expect(dashboardMetrics.bodyWidth).toBeGreaterThan(1500);
  expect(dashboardMetrics.mainWidth).toBeGreaterThan(1300);
  expect(dashboardMetrics.bodyWidth).toBeLessThanOrEqual(dashboardMetrics.viewportWidth);

  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByTestId("product-table")).toBeVisible();

  const posMetrics = await page.evaluate(() => {
    const bodyShell = document.querySelector("[data-testid='app-shell-body']");
    const workspace = document.querySelector("[data-testid='pos-workspace']");
    const productTable = document.querySelector("[data-testid='product-table']");
    const cartPanel = document.querySelector("[data-testid='cart-panel']");
    const summaryPanel = document.querySelector("[data-testid='transaction-summary-panel']");

    return {
      bodyWidth: bodyShell?.getBoundingClientRect().width ?? 0,
      workspaceWidth: workspace?.getBoundingClientRect().width ?? 0,
      productWidth: productTable?.getBoundingClientRect().width ?? 0,
      cartWidth: cartPanel?.getBoundingClientRect().width ?? 0,
      summaryWidth: summaryPanel?.getBoundingClientRect().width ?? 0,
    };
  });

  expect(posMetrics.bodyWidth).toBeGreaterThan(1500);
  expect(posMetrics.workspaceWidth).toBeGreaterThan(1300);
  expect(posMetrics.productWidth).toBeGreaterThan(580);
  expect(posMetrics.cartWidth).toBeGreaterThan(420);
  expect(posMetrics.summaryWidth).toBeGreaterThan(280);
  expect(posMetrics.summaryWidth).toBeLessThan(420);
});

test("short wide POS view keeps summary actions visible, wraps cart names, and removes helper text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 620 });
  await login(page);
  await page.route("**/api/inventory/products**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cursor: String(Date.now()),
        products: [
          {
            id_produk: "long-name-product",
            nama_produk: "Produk Contoh Dengan Nama Sangat Panjang Sekali Untuk Menguji Keranjang POS Tanpa Pemotongan Teks",
            sku: "BRG-LONG-001",
            harga_jual: 25000,
            harga_jual_unit_besar: 250000,
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
            updatedAt: Date.now(),
          },
        ],
      }),
    });
  });
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByTestId("product-row-0")).toBeVisible();
  await expect(page.getByText(/Ketik langsung untuk cari produk/i)).toHaveCount(0);

  await page.getByLabel("Global Search").click();
  await page.keyboard.type("produk");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");

  const layout = await page.evaluate(() => {
    const cartPanel = document.querySelector("[data-testid='cart-panel']");
    const summaryPanel = document.querySelector("[data-testid='transaction-summary-panel']");
    const cashButton = document.querySelector("[data-testid='checkout-cash-button']");
    const transferButton = document.querySelector("[data-testid='checkout-transfer-button']");
    const voidButton = document.querySelector("[data-testid='void-button']");
    const cartName = document.querySelector("[data-testid='cart-row-name-0']");
    const cartRect = cartPanel?.getBoundingClientRect();
    const summaryRect = summaryPanel?.getBoundingClientRect();
    const cashRect = cashButton?.getBoundingClientRect();
    const transferRect = transferButton?.getBoundingClientRect();
    const voidRect = voidButton?.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      summaryBelowCart: Boolean(
        summaryRect &&
          cartRect &&
          summaryRect.top >= cartRect.bottom - 8 &&
          Math.abs(summaryRect.left - cartRect.left) <= 8,
      ),
      summaryBottom: summaryRect?.bottom ?? 0,
      cashBottom: cashRect?.bottom ?? 0,
      transferBottom: transferRect?.bottom ?? 0,
      voidBottom: voidRect?.bottom ?? 0,
      cartNameWhiteSpace: cartName ? getComputedStyle(cartName).whiteSpace : null,
      cartNameTextOverflow: cartName ? getComputedStyle(cartName).textOverflow : null,
    };
  });

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.summaryBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.cashBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.transferBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.voidBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.cartNameWhiteSpace).not.toBe("nowrap");
  expect(layout.cartNameTextOverflow).not.toBe("ellipsis");
});

test("pos desktop layout fits within one large-screen viewport without page scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await page.getByLabel("Global Search").click();
  await page.keyboard.type("produk");
  await expect(page.getByLabel("Global Search")).toHaveValue("produk");
  await expect(page.getByTestId("product-row-0")).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Enter");
  const qtyDialog = page.getByRole("dialog", { name: "Qty Item" });
  await expect(qtyDialog).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(qtyDialog).not.toBeVisible();

  const pageMetrics = await page.evaluate(() => {
    const productTable = document.querySelector("[data-testid='product-table']");
    const cartList = document.querySelector("[data-testid='cart-list']");
    const cartPanel = document.querySelector("[data-testid='cart-panel']");
    const summaryPanel = document.querySelector("[data-testid='transaction-summary-panel']");

    if (!productTable || !cartList || !cartPanel || !summaryPanel) {
      return null;
    }

    const productRect = productTable.getBoundingClientRect();
    const cartRect = cartPanel.getBoundingClientRect();
    const summaryRect = summaryPanel.getBoundingClientRect();

    return {
      bodyScrollHeight: document.body.scrollHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      productOverflowY: window.getComputedStyle(productTable).overflowY,
      cartOverflowY: window.getComputedStyle(cartList).overflowY,
      summaryToRight: summaryRect.left >= cartRect.right - 8,
      productHeight: productRect.height,
      cartHeight: cartRect.height,
    };
  });

  expect(pageMetrics).not.toBeNull();
  expect(pageMetrics!.bodyScrollHeight).toBeLessThanOrEqual(pageMetrics!.viewportHeight);
  expect(pageMetrics!.documentScrollHeight).toBeLessThanOrEqual(pageMetrics!.viewportHeight);
  expect(pageMetrics!.productOverflowY).toBe("auto");
  expect(pageMetrics!.cartOverflowY).toBe("auto");
  expect(pageMetrics!.summaryToRight).toBe(true);
  expect(pageMetrics!.productHeight).toBeGreaterThan(240);
  expect(pageMetrics!.cartHeight).toBeGreaterThan(240);
});

test("pos tablet landscape moves summary below the cart without changing keyboard flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await login(page);
  await page.route("**/api/inventory/products**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cursor: String(Date.now()),
        products: [
          {
            id_produk: "seeded-product-1",
            nama_produk: "Produk Contoh",
            sku: "BRG-CONTOH-001",
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
            updatedAt: Date.now(),
          },
        ],
      }),
    });
  });
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByTestId("product-row-0")).toBeVisible();

  await page.getByLabel("Global Search").click();
  await page.keyboard.type("produk");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Qty Item" }).getByRole("button", { name: "Simpan" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("cart-row-0")).toHaveAttribute("data-active", "true");

  const layout = await page.evaluate(() => {
    const cartPanel = document.querySelector("[data-testid='cart-panel']");
    const summaryPanel = document.querySelector("[data-testid='transaction-summary-panel']");
    const cartRect = cartPanel?.getBoundingClientRect();
    const summaryRect = summaryPanel?.getBoundingClientRect();

    return {
      cartRect: cartRect
        ? {
            top: cartRect.top,
            left: cartRect.left,
            bottom: cartRect.bottom,
            right: cartRect.right,
          }
        : null,
      summaryRect: summaryRect
        ? {
            top: summaryRect.top,
            left: summaryRect.left,
            bottom: summaryRect.bottom,
            right: summaryRect.right,
          }
        : null,
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
  await page.route("**/api/inventory/products**", async (route) => {
    const products = Array.from({ length: 14 }, (_, index) => ({
      id_produk: `seeded-product-${index + 1}`,
      nama_produk: `Produk Contoh ${String(index + 1).padStart(2, "0")}`,
      sku: `BRG-CONTOH-${String(index + 1).padStart(3, "0")}`,
      harga_jual: 15000 + index * 1000,
      harga_jual_unit_besar: 165000 + index * 1000,
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
      updatedAt: Date.now() + index,
    }));

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cursor: String(Date.now()),
        products,
      }),
    });
  });
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await expect(page.getByTestId("product-row-0")).toBeVisible();

  await page.getByLabel("Global Search").click();
  await page.keyboard.type("produk");
  for (let index = 0; index < 14; index += 1) {
    if (index > 0) {
      await page.keyboard.press("ArrowDown");
    }
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
  }

  const metrics = await page.evaluate(() => {
    const workspace = document.querySelector("[data-testid='pos-workspace']");
    const productTable = document.querySelector("[data-testid='product-table']");
    const cartList = document.querySelector("[data-testid='cart-list']");
    const workspaceRect = workspace?.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      workspaceHeight: workspaceRect?.height ?? 0,
      productOverflowY: productTable ? getComputedStyle(productTable).overflowY : null,
      cartOverflowY: cartList ? getComputedStyle(cartList).overflowY : null,
      cartListScrolls:
        cartList instanceof HTMLElement ? cartList.scrollHeight > cartList.clientHeight : false,
    };
  });

  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.workspaceHeight).toBeGreaterThan(300);
  expect(metrics.productOverflowY).toBe("auto");
  expect(metrics.cartOverflowY).toBe("auto");
  expect(metrics.cartListScrolls).toBe(true);
});

test("pos keyboard + cart + payment flow", async ({ page }) => {
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  await page.getByLabel("Global Search").click();
  await page.keyboard.type("produk");
  await expect(page.getByLabel("Global Search")).toHaveValue("produk");
  await expect(page.getByTestId("product-row-0")).toBeVisible();
  await expect(page.getByTestId("product-row-0")).toHaveAttribute("data-active", "true");

  await page.keyboard.press("Enter");
  const qtyDialog = page.getByRole("dialog", { name: "Qty Item" });
  await expect(qtyDialog).toBeVisible();
  await qtyDialog.getByRole("button", { name: "Simpan" }).click();
  await expect(qtyDialog).not.toBeVisible();

  await expect(page.getByTestId("cart-row-0")).toBeVisible();
  await expect(page.getByTestId("cart-total")).not.toContainText("Rp0");

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("cart-row-0")).toHaveAttribute("data-active", "true");

  await page.keyboard.press("Delete");
  await expect(page.getByText("Hapus item?")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Hapus item?")).not.toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F8" }));
  });
  await expect(page.getByText("Pembayaran Tunai")).toBeVisible();
  await expect(page.getByLabel("Uang diterima")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Cetak receipt?")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Cetak receipt?")).not.toBeVisible();

  await page.keyboard.type("produk");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F9" }));
  });
  await expect(page.getByText("Pembayaran Transfer")).toBeVisible();
});
