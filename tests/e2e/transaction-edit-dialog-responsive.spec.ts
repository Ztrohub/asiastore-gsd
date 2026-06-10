import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("Password").fill("owner12345");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/app");
}

async function mockTransactionAndProductData(page: Page) {
  await page.route("**/api/sync/pos-transactions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cursor: "0",
        transactions: [
          {
            id_transaksi: "tx-e2e-1",
            short_id: "TRX-E2E-001",
            kasir_user_id: "cashier-1",
            kasir_username: "kasir",
            payment_method: "cash",
            subtotal_amount: 82000,
            item_discount: 2000,
            order_discount: 5000,
            total_amount: 75000,
            amount_received: 100000,
            change_amount: 25000,
            counts_for_cash: true,
            note: "transaksi uji responsif",
            is_deleted: false,
            client_timestamp: "2026-06-09T10:00:00.000Z",
            createdAt: "2026-06-09T10:00:00.000Z",
            lines: [
              {
                id_produk: "prod-1",
                nama_produk: "Produk Uji Satu Dengan Nama Yang Cukup Panjang",
                unit_price: 25000,
                qty: 2,
                unit_mutasi: "SMALL",
                unit_label: "pcs",
                line_discount: 2000,
                line_total: 48000,
              },
              {
                id_produk: "prod-2",
                nama_produk: "Produk Uji Dua",
                unit_price: 34000,
                qty: 1,
                unit_mutasi: "SMALL",
                unit_label: "pcs",
                line_discount: 0,
                line_total: 34000,
              },
            ],
          },
        ],
      }),
    });
  });

  await page.route("**/api/inventory/products**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cursor: String(Date.now()),
        products: Array.from({ length: 8 }, (_, index) => ({
          id_produk: `prod-${index + 1}`,
          nama_produk: `Produk Pencarian ${index + 1} Dengan Nama Panjang Untuk Menguji Layout Dialog`,
          sku: `SKU-${index + 1}`,
          harga_jual: 12000 + index * 1000,
          harga_jual_unit_besar: null,
          stok_saat_ini: 20,
          stok_unit_besar_saat_ini: 0,
          is_active: true,
          unit_small_name: "pcs",
          unit_large_name: null,
          unit_large_to_small: null,
          allow_buy_in_small: true,
          allow_buy_in_large: false,
          allow_sell_in_small: true,
          allow_sell_in_large: false,
          updatedAt: Date.now() + index,
        })),
      }),
    });
  });
}

async function openEditDialog(page: Page) {
  await page.goto("/app/transaksi");
  await expect(page.getByRole("heading", { name: "Transaksi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit transaksi TRX-E2E-001" })).toBeVisible();
  await page.getByRole("button", { name: "Edit transaksi TRX-E2E-001" }).click();
  await expect(page.getByRole("dialog", { name: /Edit transaksi TRX-E2E-001/i })).toBeVisible();
}

async function assertActionFooterVisible(page: Page) {
  const saveButton = page.getByRole("button", { name: "Simpan perubahan" });
  const deleteButton = page.getByRole("button", { name: "Delete transaksi" });
  const closeButton = page.getByRole("button", { name: "Tutup" });

  await expect(saveButton).toBeVisible();
  await expect(deleteButton).toBeVisible();
  await expect(closeButton).toBeVisible();

  const visibility = await page.evaluate(() => {
    const footer = Array.from(document.querySelectorAll("div")).find((node) =>
      node.className.includes("border-t") && node.textContent?.includes("Simpan perubahan"),
    );
    const saveButton = Array.from(document.querySelectorAll("button")).find((node) =>
      node.textContent?.trim() === "Simpan perubahan",
    );
    const deleteButton = Array.from(document.querySelectorAll("button")).find((node) =>
      node.textContent?.trim() === "Delete transaksi",
    );
    const closeButton = Array.from(document.querySelectorAll("button")).find((node) =>
      node.textContent?.trim() === "Tutup",
    );

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const toRect = (node: Element | undefined) => node?.getBoundingClientRect();

    return {
      viewportHeight,
      viewportWidth,
      footerBottom: toRect(footer)?.bottom ?? 0,
      footerTop: toRect(footer)?.top ?? 0,
      saveBottom: toRect(saveButton)?.bottom ?? 0,
      deleteBottom: toRect(deleteButton)?.bottom ?? 0,
      closeBottom: toRect(closeButton)?.bottom ?? 0,
    };
  });

  expect(visibility.footerBottom).toBeLessThanOrEqual(visibility.viewportHeight);
  expect(visibility.footerTop).toBeGreaterThanOrEqual(0);
  expect(visibility.saveBottom).toBeLessThanOrEqual(visibility.viewportHeight);
  expect(visibility.deleteBottom).toBeLessThanOrEqual(visibility.viewportHeight);
  expect(visibility.closeBottom).toBeLessThanOrEqual(visibility.viewportHeight);
}

test("transaction edit dialog keeps action footer visible across responsive viewports", async ({
  page,
}) => {
  await login(page);
  await mockTransactionAndProductData(page);

  const viewports = [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet-playstore-landscape", width: 1245, height: 818 },
    { name: "tablet-landscape-tight", width: 1024, height: 540 },
    { name: "tablet-landscape", width: 1024, height: 768 },
    { name: "desktop-short", width: 1366, height: 620 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openEditDialog(page);
    await assertActionFooterVisible(page);
    await page.getByRole("button", { name: "Tutup" }).click();
    await expect(page.getByRole("dialog", { name: /Edit transaksi/i })).toHaveCount(0);
  }
});
