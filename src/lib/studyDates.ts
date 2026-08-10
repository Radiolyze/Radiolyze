/**
 * Day arithmetic between a current study and a prior one.
 *
 * Study dates arrive as either a bare `YYYY-MM-DD` or a full timestamp. The
 * date part is read as UTC rather than handed to `Date.parse` as-is, because a
 * bare date parsed in local time drifts by a day either side of UTC — which
 * would show a prior taken on the same day as one day old, or vice versa.
 */

/** Midnight UTC of the study's calendar day, or `undefined` if unparseable. */
export const toStudyTimestamp = (value?: string): number | undefined => {
  if (!value) return undefined;
  const datePart = value.split("T")[0];
  const parts = datePart.split("-").map((entry) => Number(entry));
  if (parts.length === 3 && parts.every((entry) => Number.isFinite(entry))) {
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Whole days between the two studies, positive when the prior is older.
 *
 * `undefined` when either date is missing or unparseable, so a caller can tell
 * "no interval known" apart from "same day".
 */
export const computeDeltaDays = (currentDate?: string, priorDate?: string): number | undefined => {
  const currentTimestamp = toStudyTimestamp(currentDate);
  const priorTimestamp = toStudyTimestamp(priorDate);
  if (currentTimestamp === undefined || priorTimestamp === undefined) return undefined;
  return Math.round((currentTimestamp - priorTimestamp) / (1000 * 60 * 60 * 24));
};
