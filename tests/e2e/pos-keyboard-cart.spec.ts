import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("Password").fill("owner12345");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/app");
}

test("pos desktop layout fits within one large-screen viewport without page scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
  await page.locator("main").click();
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
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  await page.locator("main").click();
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
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const workspace = document.querySelector("[data-testid='pos-workspace']");
    const productTable = document.querySelector("[data-testid='product-table']");
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

test("pos keyboard + cart + payment flow", async ({ page }) => {
  await login(page);
  await page.goto("/app/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();

  await page.locator("main").click();
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
