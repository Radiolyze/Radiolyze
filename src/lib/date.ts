import i18n from "i18next";

/**
 * Date and time formatting for display.
 *
 * Every helper formats in the language the UI is currently showing rather than a
 * fixed locale, so switching the language in the settings also switches how dates
 * read. Pass `locale` explicitly only when the output must not follow the UI —
 * tests, exports with a fixed target locale.
 *
 * Inside components prefer the `useDateFormat` hook: it re-renders the component
 * when the language changes, which these plain functions cannot do on their own.
 */

/** Anything the helpers accept: an ISO string, an epoch value or a `Date`. */
export type DateInput = string | number | Date;

/** Shown in place of a date that cannot be parsed. */
const INVALID_DATE = "—";

/** BCP-47 locale of the running UI; English before i18next has initialised. */
export function displayLocale(): string {
  return i18n.language || "en";
}

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Numeric calendar date — `02.08.2026` in German, `08/02/2026` in English. */
export function formatDate(value: DateInput, locale = displayLocale()): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE;
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Time of day without seconds — `14:32` in German, `2:32 PM` in English. */
export function formatTime(value: DateInput, locale = displayLocale()): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE;
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact day and month for chart axes — `2. Aug.` in German, `Aug 2` in English. */
export function formatShortDate(value: DateInput, locale = displayLocale()): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

/** Full date and time, for dense tables and log-style listings. */
export function formatDateTime(value: DateInput, locale = displayLocale()): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE;
  return date.toLocaleString(locale);
}

/** Whole years between a date of birth and today; `null` if unparseable. */
export function getAge(dateOfBirth: DateInput): number | null {
  const birthDate = toDate(dateOfBirth);
  if (!birthDate) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
