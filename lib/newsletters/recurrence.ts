import type { GenerationRule, RecurrenceRule, WeekOrdinal } from "./types";

const ordinalNumber: Record<Exclude<WeekOrdinal, "LAST">, number> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4,
};

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nthWeekday(year: number, month: number, weekday: number, ordinal: WeekOrdinal) {
  const lastDay = daysInMonth(year, month);
  if (ordinal === "LAST") {
    const lastWeekday = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
    return lastDay - ((lastWeekday - weekday + 7) % 7);
  }
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (ordinalNumber[ordinal] - 1) * 7;
  if (day > lastDay) throw new Error("The recurrence does not occur in this month.");
  return day;
}

function parseLocalTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Local time must use 24-hour HH:mm format.");
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
}

export function zonedLocalDateToUtc(input: {
  year: number; month: number; day: number; hour: number; minute: number; timeZone: string;
}) {
  const desired = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  let firstAfterGap: { instant: Date; localValue: number } | null = null;
  // All IANA offsets are comfortably inside this window. Minute scanning also
  // gives deterministic behavior for ambiguous and skipped DST wall times.
  for (let delta = -16 * 60; delta <= 16 * 60; delta += 1) {
    const instant = new Date(desired + delta * 60_000);
    const local = partsAt(instant, input.timeZone);
    const localValue = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    if (localValue === desired) return instant; // first instant wins during a fall-back overlap
    if (local.year === input.year && local.month === input.month && local.day === input.day &&
        localValue > desired && (!firstAfterGap || localValue < firstAfterGap.localValue)) {
      firstAfterGap = { instant, localValue };
    }
  }
  if (firstAfterGap) return firstAfterGap.instant;
  throw new Error("Unable to resolve local date in time zone.");
}

export function occurrenceForMonth(
  year: number,
  month: number,
  rule: RecurrenceRule,
  timeZone = "America/Denver",
) {
  const { hour, minute } = parseLocalTime(rule.localTime);
  const day = rule.kind === "DAY_OF_MONTH"
    ? Math.min(Math.max(1, rule.dayOfMonth), daysInMonth(year, month))
    : nthWeekday(year, month, rule.weekday, rule.ordinal);
  return zonedLocalDateToUtc({ year, month, day, hour, minute, timeZone });
}

export function nextOccurrence(
  after: Date,
  rule: RecurrenceRule,
  timeZone = "America/Denver",
) {
  const local = partsAt(after, timeZone);
  for (let offset = 0; offset < 24; offset += 1) {
    const index = local.month - 1 + offset;
    const year = local.year + Math.floor(index / 12);
    const month = (index % 12) + 1;
    const occurrence = occurrenceForMonth(year, month, rule, timeZone);
    if (occurrence.getTime() > after.getTime()) return occurrence;
  }
  throw new Error("Unable to calculate the next monthly occurrence.");
}

export function generationDateForSend(
  sendAt: Date,
  rule: GenerationRule,
  timeZone = "America/Denver",
) {
  if (rule.mode === "MANUAL") return null;
  if (rule.mode === "RECURRENCE") {
    const sendLocal = partsAt(sendAt, timeZone);
    const sameMonth = occurrenceForMonth(sendLocal.year, sendLocal.month, rule.recurrence, timeZone);
    if (sameMonth.getTime() < sendAt.getTime()) return sameMonth;
    const previousMonthIndex = sendLocal.month - 2;
    return occurrenceForMonth(
      sendLocal.year + Math.floor(previousMonthIndex / 12),
      ((previousMonthIndex % 12) + 12) % 12 + 1,
      rule.recurrence,
      timeZone,
    );
  }
  const sendLocal = partsAt(sendAt, timeZone);
  const localDate = new Date(Date.UTC(sendLocal.year, sendLocal.month - 1, sendLocal.day));
  localDate.setUTCDate(localDate.getUTCDate() - rule.daysBeforeSend);
  const time = parseLocalTime(rule.localTime ?? "08:00");
  return zonedLocalDateToUtc({
    year: localDate.getUTCFullYear(), month: localDate.getUTCMonth() + 1,
    day: localDate.getUTCDate(), hour: time.hour, minute: time.minute, timeZone,
  });
}
