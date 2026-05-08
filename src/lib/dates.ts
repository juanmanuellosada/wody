/**
 * Returns a Date object representing midnight at the start of today in Argentina (UTC-3).
 * Vercel/Node runs in UTC, so we explicitly offset to get the local Argentina date.
 */
export function getTodayArgentina(): Date {
  const nowUTC = new Date();

  // Argentina is UTC-3 (no DST)
  const argOffsetMs = -3 * 60 * 60 * 1000;
  const argNow = new Date(nowUTC.getTime() + argOffsetMs);

  // Build a midnight Date in UTC that represents midnight Argentina time
  // e.g. Argentina 2026-04-04 00:00 = UTC 2026-04-04 03:00
  const year = argNow.getUTCFullYear();
  const month = argNow.getUTCMonth();
  const day = argNow.getUTCDate();

  // Return as a plain Date at midnight UTC with the Argentina calendar date
  // Prisma @db.Date stores date-only; we pass a UTC midnight of that date
  return new Date(Date.UTC(year, month, day));
}

/**
 * Formats a date for display in Spanish (dd/mm/yyyy).
 * Uses UTC date components — @db.Date values have no time, so timezone
 * conversion would shift the displayed date by ±1 day.
 */
export function formatDateArg(date: Date): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date as YYYY-MM-DD for use in <input type="date"> value.
 */
export function toInputDate(date: Date): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string as UTC midnight and validates it is ≥ today (Argentina).
 * Returns `{ ok: true, date }` or `{ ok: false, error }` with a user-facing message.
 * Used by both submitJoinRequest and approveJoinRequest.
 */
export function parseJoinRequestPaymentDate(
  input: string | undefined | null,
): { ok: true; date: Date } | { ok: false; error: string } {
  if (!input || input.trim() === "") {
    return { ok: false, error: "La fecha de pago es obligatoria" };
  }

  const parsed = new Date(`${input.trim()}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: "Fecha de pago inválida" };
  }

  // Reject dates that don't strictly match YYYY-MM-DD (e.g. "2026-13-99" parses but is wrong)
  const [year, month, day] = input.trim().split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return { ok: false, error: "Fecha de pago inválida" };
  }

  const today = getTodayArgentina();
  if (parsed < today) {
    return { ok: false, error: "La fecha de pago no puede ser anterior a hoy" };
  }

  return { ok: true, date: parsed };
}

/**
 * Adds one calendar month to a date, clamping the day to the last day of the
 * target month when needed (e.g. Jan 31 → Feb 28). Returns UTC midnight.
 */
export function addOneMonth(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const daysInTarget = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + 1, Math.min(d, daysInTarget)));
}

/**
 * Returns a date range covering the full day for a given date string (YYYY-MM-DD).
 * Covers any timezone interpretation that node-postgres / Prisma might apply
 * to @db.Date columns (midnight UTC through midnight+23:59:59 UTC, plus margin
 * for local timezone offsets up to ±14h).
 *
 * Use with Prisma: { date: { gte: range.start, lte: range.end } }
 */
export function todayDateRange(): { start: Date; end: Date } {
  const today = getTodayArgentina();
  const todayStr = toInputDate(today);
  // Cover the full calendar day regardless of how pg interprets the DATE
  // @db.Date can be returned as midnight UTC or midnight local — this range catches both
  return {
    start: new Date(todayStr + "T00:00:00.000Z"),
    end: new Date(todayStr + "T23:59:59.999Z"),
  };
}
