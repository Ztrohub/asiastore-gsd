export function formatJakartaDateTime(input: Date | number) {
  const value = typeof input === "number" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);

  const day = parts.find((item) => item.type === "day")?.value ?? "00";
  const month = parts.find((item) => item.type === "month")?.value ?? "00";
  const year = parts.find((item) => item.type === "year")?.value ?? "0000";
  const hour = parts.find((item) => item.type === "hour")?.value ?? "00";
  const minute = parts.find((item) => item.type === "minute")?.value ?? "00";
  const second = parts.find((item) => item.type === "second")?.value ?? "00";

  return `${day}-${month}-${year} ${hour}:${minute}:${second}`;
}
