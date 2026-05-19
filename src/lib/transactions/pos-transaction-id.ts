export function createPosTransactionId(now = new Date(), sequence = 1) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `TRX-${y}${m}${d}-${String(sequence).padStart(5, "0")}`;
}
