export function truncateQuantityToSingleDecimal(value: number) {
  return Math.trunc(value * 10) / 10;
}

export function normalizeQuantityInput(raw: string) {
  const normalized = raw.trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Qty harus lebih dari 0.");
  }
  return truncateQuantityToSingleDecimal(parsed);
}

export function formatQuantityForDisplay(value: number) {
  return truncateQuantityToSingleDecimal(value).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
