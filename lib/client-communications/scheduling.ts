export const DEFAULT_CAMPAIGN_TIME_ZONE = "America/Denver";

export function validTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function zonedLocalToUtc(local: string, timeZone: string) {
  if (!validTimeZone(timeZone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    throw new Error("Choose a valid date, time, and timezone.");
  }
  const [year, month, day, hour, minute] = local.split(/\D/).map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = partsAt(new Date(candidate), timeZone);
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    candidate += desired - represented;
  }
  const final = partsAt(new Date(candidate), timeZone);
  if (
    Number(final.year) !== year || Number(final.month) !== month || Number(final.day) !== day ||
    Number(final.hour) !== hour || Number(final.minute) !== minute
  ) throw new Error("That local time does not exist because of daylight-saving time.");
  return new Date(candidate);
}
