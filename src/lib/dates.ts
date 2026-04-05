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
 */
export function formatDateArg(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
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
