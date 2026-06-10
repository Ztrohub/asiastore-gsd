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
            id_transaksi: "tx-e2e-action-1",
            short_id: "TRX-E2E-ACTION-001",
            kasir_user_id: "cashier-1",
            kasir_username: "kasir",
            payment_method: "cash",
            subtotal_amount: 32000,
            item_discount: 2000,
            order_discount: 0,
            total_amount: 30000,
            amount_received: 50000,
            change_amount: 20000,
            counts_for_cash: true,
            note: "catatan awal",
            is_deleted: false,
            client_timestamp: "2026-06-09T10:00:00.000Z",
            createdAt: "2026-06-09T10:00:00.000Z",
            lines: [
              {
                id_produk: "prod-1",
                nama_produk: "Produk Uji Aksi",
                unit_price: 16000,
                qty: 2,
                unit_mutasi: "SMALL",
                unit_label: "pcs",
                line_discount: 2000,
                line_total: 30000,
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
        products: [
          {
            id_produk: "prod-1",
            nama_produk: "Produk Uji Aksi",
            sku: "SKU-AKSI-1",
            harga_jual: 16000,
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
            updatedAt: Date.now(),
          },
        ],
      }),
    });
  });
}

async function openEditDialog(page: Page) {
  await page.goto("/app/transaksi");
  await expect(page.getByRole("heading", { name: "Transaksi" })).toBeVisible();
  await page.getByRole("button", { name: "Edit transaksi TRX-E2E-ACTION-001" }).click();
  await expect(
    page.getByRole("dialog", { name: /Edit transaksi TRX-E2E-ACTION-001/i }),
  ).toBeVisible();
}

test("transaction edit dialog refreshes inline after save delete and restore", async ({ page }) => {
  await page.setViewportSize({ width: 1245, height: 818 });
  await login(page);
  await mockTransactionAndProductData(page);
  await openEditDialog(page);

  const noteInput = page.getByLabel("Catatan transaksi");
  await noteInput.clear();
  await noteInput.fill("catatan tersimpan");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.getByRole("dialog", { name: "Simpan perubahan transaksi?" }).getByRole("button", {
    name: "Simpan",
  }).click();

  await expect(page.getByText("Perubahan transaksi berhasil disimpan.")).toBeVisible();
  await expect(page.getByText(/Edit terakhir: .* oleh owner/i)).toBeVisible();
  await expect(noteInput).toHaveValue("catatan tersimpan");

  await page.getByRole("button", { name: "Delete transaksi" }).click();
  await page.getByRole("dialog", { name: "Delete transaksi?" }).getByRole("button", {
    name: "Delete transaksi",
  }).click();

  await expect(page.getByText("Transaksi berhasil dinonaktifkan.")).toBeVisible();
  await expect(
    page.getByText("Transaksi ini sedang dinonaktifkan. Aktifkan kembali untuk mengubah field transaksi."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Aktifkan kembali" })).toBeVisible();
  await expect(noteInput).toBeDisabled();

  await page.getByRole("button", { name: "Aktifkan kembali" }).click();
  await page.getByRole("dialog", { name: "Aktifkan kembali transaksi?" }).getByRole("button", {
    name: "Aktifkan kembali",
  }).click();

  await expect(page.getByText("Transaksi berhasil diaktifkan kembali.")).toBeVisible();
  await expect(
    page.getByText("Transaksi ini sedang dinonaktifkan. Aktifkan kembali untuk mengubah field transaksi."),
  ).toHaveCount(0);
  await expect(noteInput).toBeEditable();
});
