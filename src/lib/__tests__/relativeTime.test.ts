import { describe, it, expect } from "vitest";
import { formatRelativeTime, type RelativeTimeLabels } from "../relativeTime";

const labels: RelativeTimeLabels = {
  justNow: "just now",
  minutes: (count) => `${count} min`,
  hours: (count) => `${count} h`,
  daysAgo: (count) => `${count} days ago`,
  absolute: (date) => `on ${date.getFullYear()}`,
};

const now = new Date("2026-08-10T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("reads as just now under a minute", () => {
    expect(formatRelativeTime(ago(0), labels, now)).toBe("just now");
    expect(formatRelativeTime(ago(59 * 1000), labels, now)).toBe("just now");
  });

  it("counts whole minutes below an hour", () => {
    expect(formatRelativeTime(ago(MINUTE), labels, now)).toBe("1 min");
    expect(formatRelativeTime(ago(59 * MINUTE), labels, now)).toBe("59 min");
  });

  it("counts whole hours below a day", () => {
    expect(formatRelativeTime(ago(HOUR), labels, now)).toBe("1 h");
    expect(formatRelativeTime(ago(23 * HOUR), labels, now)).toBe("23 h");
  });

  it("counts whole days below a week", () => {
    expect(formatRelativeTime(ago(DAY), labels, now)).toBe("1 days ago");
    expect(formatRelativeTime(ago(6 * DAY), labels, now)).toBe("6 days ago");
  });

  it("switches to an absolute date from a week out", () => {
    expect(formatRelativeTime(ago(7 * DAY), labels, now)).toBe("on 2026");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * MINUTE), labels, now)).toBe("5 min");
  });
});
