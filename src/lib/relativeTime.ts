import type { DateInput } from "./date";

/**
 * Elapsed-time formatting for log-style listings ("Gerade eben", "12 min", "3 h").
 *
 * The wording is passed in rather than read from i18next here, which keeps the
 * function pure and lets the caller decide the locale of the absolute fallback.
 */
export interface RelativeTimeLabels {
  /** Under a minute ago. */
  justNow: string;
  /** Under an hour ago, given whole minutes. */
  minutes: (count: number) => string;
  /** Under a day ago, given whole hours. */
  hours: (count: number) => string;
  /** Under a week ago, given whole days. */
  daysAgo: (count: number) => string;
  /** A week or more ago — an absolute date instead of an elapsed span. */
  absolute: (date: Date) => string;
}

const MINUTE_MS = 1000 * 60;
const HOUR_MS = MINUTE_MS * 60;
const DAY_MS = HOUR_MS * 24;

export function formatRelativeTime(
  value: DateInput,
  labels: RelativeTimeLabels,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  const elapsedMs = now.getTime() - date.getTime();

  const minutes = Math.floor(elapsedMs / MINUTE_MS);
  const hours = Math.floor(elapsedMs / HOUR_MS);
  const days = Math.floor(elapsedMs / DAY_MS);

  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return labels.minutes(minutes);
  if (hours < 24) return labels.hours(hours);
  if (days < 7) return labels.daysAgo(days);
  return labels.absolute(date);
}
