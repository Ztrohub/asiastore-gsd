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

  const pageMetrics = await page.evaluate(() => ({
    bodyScrollHeight: document.body.scrollHeight,
    documentScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));

  expect(pageMetrics.bodyScrollHeight).toBeLessThanOrEqual(pageMetrics.viewportHeight);
  expect(pageMetrics.documentScrollHeight).toBeLessThanOrEqual(pageMetrics.viewportHeight);
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
