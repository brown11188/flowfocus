/**
 * Timezone utilities for FlowFocus
 * All date comparisons should use user's timezone, not UTC.
 */

export const DEFAULT_TIMEZONE = "UTC";

/**
 * Get the YYYY-MM-DD string for today in a given timezone.
 * @param tz  IANA timezone string, e.g. "Asia/Ho_Chi_Minh"
 * @param offsetDays  optional offset in days (positive = future)
 */
export function getTodayStrInTz(tz: string, offsetDays = 0): string {
  const now = new Date();
  if (offsetDays !== 0) {
    now.setDate(now.getDate() + offsetDays);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // returns YYYY-MM-DD
}

/**
 * Check if a dueDate string (YYYY-MM-DD or ISO) is today in the given timezone.
 */
export function isToday(dueDate: string, tz = DEFAULT_TIMEZONE): boolean {
  const dateStr = dueDate.split("T")[0];
  return dateStr === getTodayStrInTz(tz);
}

/**
 * Check if a dueDate string is overdue (strictly before today) in the given timezone.
 */
export function isOverdue(dueDate: string, tz = DEFAULT_TIMEZONE): boolean {
  const dateStr = dueDate.split("T")[0];
  return dateStr < getTodayStrInTz(tz);
}

/**
 * Check if a dueDate string is tomorrow in the given timezone.
 */
export function isTomorrow(dueDate: string, tz = DEFAULT_TIMEZONE): boolean {
  const dateStr = dueDate.split("T")[0];
  return dateStr === getTodayStrInTz(tz, 1);
}

/**
 * Format a date with the user's timezone.
 */
export function formatDateInTz(
  date: string | Date,
  tz: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { timeZone: tz, ...options });
}

/**
 * Get current hour in a given timezone (0-23).
 */
export function getCurrentHourInTz(tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()),
    10
  );
}

/**
 * Get greeting based on hour in user timezone.
 */
export function getGreetingInTz(tz: string): string {
  const h = getCurrentHourInTz(tz);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Get UTC offset string for a timezone, e.g. "GMT+7"
 */
export function getUtcOffsetLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(now);
    const tzName = parts.find(p => p.type === "timeZoneName")?.value ?? "";
    return tzName;
  } catch {
    return tz;
  }
}

/**
 * Legacy alias used in settings page.
 */
export const getTimezoneOffset = getUtcOffsetLabel;

/** Common IANA timezones list for the picker */
export const TIMEZONE_LIST: { value: string; label: string; group: string }[] = [
  // Americas
  { value: "America/New_York",        label: "Eastern Time (New York)",      group: "Americas" },
  { value: "America/Chicago",         label: "Central Time (Chicago)",       group: "Americas" },
  { value: "America/Denver",          label: "Mountain Time (Denver)",       group: "Americas" },
  { value: "America/Los_Angeles",     label: "Pacific Time (Los Angeles)",   group: "Americas" },
  { value: "America/Anchorage",       label: "Alaska Time",                  group: "Americas" },
  { value: "Pacific/Honolulu",        label: "Hawaii Time",                  group: "Americas" },
  { value: "America/Phoenix",         label: "Arizona (no DST)",             group: "Americas" },
  { value: "America/Toronto",         label: "Eastern Time (Toronto)",       group: "Americas" },
  { value: "America/Vancouver",       label: "Pacific Time (Vancouver)",     group: "Americas" },
  { value: "America/Sao_Paulo",       label: "Bras\u00edlia Time",               group: "Americas" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires",         group: "Americas" },
  { value: "America/Mexico_City",     label: "Mexico City",                  group: "Americas" },
  { value: "America/Bogota",          label: "Colombia (Bogot\u00e1)",           group: "Americas" },
  { value: "America/Lima",            label: "Peru (Lima)",                  group: "Americas" },
  { value: "America/Santiago",        label: "Chile (Santiago)",             group: "Americas" },
  // Europe
  { value: "UTC",                     label: "UTC",                          group: "Europe" },
  { value: "Europe/London",           label: "London (GMT/BST)",             group: "Europe" },
  { value: "Europe/Paris",            label: "Paris (CET/CEST)",             group: "Europe" },
  { value: "Europe/Berlin",           label: "Berlin (CET/CEST)",            group: "Europe" },
  { value: "Europe/Rome",             label: "Rome",                         group: "Europe" },
  { value: "Europe/Madrid",           label: "Madrid",                       group: "Europe" },
  { value: "Europe/Amsterdam",        label: "Amsterdam",                    group: "Europe" },
  { value: "Europe/Stockholm",        label: "Stockholm",                    group: "Europe" },
  { value: "Europe/Warsaw",           label: "Warsaw",                       group: "Europe" },
  { value: "Europe/Athens",           label: "Athens",                       group: "Europe" },
  { value: "Europe/Helsinki",         label: "Helsinki",                     group: "Europe" },
  { value: "Europe/Istanbul",         label: "Istanbul",                     group: "Europe" },
  { value: "Europe/Moscow",           label: "Moscow",                       group: "Europe" },
  { value: "Europe/Kiev",             label: "Kyiv",                         group: "Europe" },
  { value: "Europe/Zurich",           label: "Zurich",                       group: "Europe" },
  // Asia
  { value: "Asia/Dubai",              label: "Dubai (GST)",                  group: "Asia" },
  { value: "Asia/Karachi",            label: "Pakistan (Karachi)",           group: "Asia" },
  { value: "Asia/Kolkata",            label: "India (IST)",                  group: "Asia" },
  { value: "Asia/Dhaka",              label: "Bangladesh (Dhaka)",           group: "Asia" },
  { value: "Asia/Colombo",            label: "Sri Lanka",                    group: "Asia" },
  { value: "Asia/Kathmandu",          label: "Nepal (Kathmandu)",            group: "Asia" },
  { value: "Asia/Almaty",             label: "Kazakhstan (Almaty)",          group: "Asia" },
  { value: "Asia/Bangkok",            label: "Bangkok (ICT)",                group: "Asia" },
  { value: "Asia/Ho_Chi_Minh",        label: "Ho Chi Minh City (ICT)",       group: "Asia" },
  { value: "Asia/Jakarta",            label: "Jakarta (WIB)",                group: "Asia" },
  { value: "Asia/Kuala_Lumpur",       label: "Kuala Lumpur (MYT)",           group: "Asia" },
  { value: "Asia/Singapore",          label: "Singapore (SGT)",              group: "Asia" },
  { value: "Asia/Manila",             label: "Manila (PHT)",                 group: "Asia" },
  { value: "Asia/Hong_Kong",          label: "Hong Kong (HKT)",              group: "Asia" },
  { value: "Asia/Shanghai",           label: "China (CST)",                  group: "Asia" },
  { value: "Asia/Taipei",             label: "Taipei (CST)",                 group: "Asia" },
  { value: "Asia/Tokyo",              label: "Tokyo (JST)",                  group: "Asia" },
  { value: "Asia/Seoul",              label: "Seoul (KST)",                  group: "Asia" },
  { value: "Asia/Riyadh",             label: "Riyadh (AST)",                 group: "Asia" },
  { value: "Asia/Jerusalem",          label: "Israel (IST)",                 group: "Asia" },
  { value: "Asia/Tbilisi",            label: "Georgia (GET)",                group: "Asia" },
  { value: "Asia/Tashkent",           label: "Uzbekistan",                   group: "Asia" },
  // Africa
  { value: "Africa/Cairo",            label: "Cairo (EET)",                  group: "Africa" },
  { value: "Africa/Johannesburg",     label: "Johannesburg (SAST)",          group: "Africa" },
  { value: "Africa/Lagos",            label: "Lagos (WAT)",                  group: "Africa" },
  { value: "Africa/Nairobi",          label: "Nairobi (EAT)",                group: "Africa" },
  { value: "Africa/Casablanca",       label: "Casablanca",                   group: "Africa" },
  // Pacific
  { value: "Pacific/Auckland",        label: "Auckland (NZST)",              group: "Pacific" },
  { value: "Pacific/Fiji",            label: "Fiji",                         group: "Pacific" },
  { value: "Australia/Sydney",        label: "Sydney (AEST)",                group: "Pacific" },
  { value: "Australia/Melbourne",     label: "Melbourne (AEST)",             group: "Pacific" },
  { value: "Australia/Brisbane",      label: "Brisbane (AEST)",              group: "Pacific" },
  { value: "Australia/Perth",         label: "Perth (AWST)",                 group: "Pacific" },
  { value: "Australia/Adelaide",      label: "Adelaide (ACST)",              group: "Pacific" },
];

/**
 * Legacy alias kept for backward compatibility with settings page.
 * Prefer TIMEZONE_LIST going forward.
 */
export const TIMEZONE_OPTIONS = TIMEZONE_LIST.map(t => ({
  value: t.value,
  label: `(${getUtcOffsetLabel(t.value)}) ${t.label}`,
}));
