const IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000;

export function isIdleExpired(lastActivityAt: number, now = Date.now()) {
  return now - lastActivityAt > IDLE_TIMEOUT_MS;
}

export function nextMondayReloginAt(now = new Date()) {
  const date = new Date(now);
  const day = date.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function mustReloginBySchedule(mustReloginAt: number, now = Date.now()) {
  return now >= mustReloginAt;
}

export function shouldInvalidateOnServerChange(params: {
  localRole: string;
  serverRole: string;
  localPasswordVersion: number;
  serverPasswordVersion: number;
}) {
  return (
    params.localRole !== params.serverRole ||
    params.localPasswordVersion !== params.serverPasswordVersion
  );
}

export { IDLE_TIMEOUT_MS };
