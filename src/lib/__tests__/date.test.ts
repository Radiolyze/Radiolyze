import { describe, it, expect, afterEach } from "vitest";
import i18n from "i18next";
import {
  displayLocale,
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
  getAge,
} from "@/lib/date";

const SAMPLE = "2026-08-02T14:32:10Z";

afterEach(() => {
  i18n.language = undefined as unknown as string;
});

describe("displayLocale", () => {
  it("follows the active i18next language", () => {
    i18n.language = "de";
    expect(displayLocale()).toBe("de");
  });

  it("falls back to English before i18next has initialised", () => {
    expect(displayLocale()).toBe("en");
  });
});

describe("formatDate", () => {
  it("formats German and English differently", () => {
    expect(formatDate(SAMPLE, "de")).toBe("02.08.2026");
    expect(formatDate(SAMPLE, "en")).toBe("08/02/2026");
  });

  it("uses the active language when no locale is passed", () => {
    i18n.language = "de";
    expect(formatDate(SAMPLE)).toBe("02.08.2026");
    i18n.language = "en";
    expect(formatDate(SAMPLE)).toBe("08/02/2026");
  });

  it("returns a placeholder for unparseable input", () => {
    expect(formatDate("not a date", "de")).toBe("—");
  });
});

describe("formatTime", () => {
  it("uses a 24-hour clock in German and a 12-hour clock in English", () => {
    const date = new Date(2026, 7, 2, 14, 32);
    expect(formatTime(date, "de")).toBe("14:32");
    expect(formatTime(date, "en-US")).toMatch(/^02:32\s?PM$/);
  });

  it("returns a placeholder for unparseable input", () => {
    expect(formatTime("not a date", "de")).toBe("—");
  });
});

describe("formatShortDate", () => {
  it("puts the day before the month in German and after it in English", () => {
    const date = new Date(2026, 7, 2);
    expect(formatShortDate(date, "de")).toMatch(/^2\. Aug\.?$/);
    expect(formatShortDate(date, "en-US")).toBe("Aug 2");
  });
});

describe("formatDateTime", () => {
  it("formats date and time in the given locale", () => {
    const date = new Date(2026, 7, 2, 14, 32, 10);
    expect(formatDateTime(date, "de")).toContain("2.8.2026");
    expect(formatDateTime(date, "en-US")).toContain("8/2/2026");
  });

  it("returns a placeholder for unparseable input", () => {
    expect(formatDateTime("not a date", "de")).toBe("—");
  });
});

describe("getAge", () => {
  it("counts whole years, not started ones", () => {
    const today = new Date();
    const hadBirthday = new Date(today.getFullYear() - 40, today.getMonth(), today.getDate());
    expect(getAge(hadBirthday.toISOString())).toBe(40);

    const birthdayTomorrow = new Date(
      today.getFullYear() - 40,
      today.getMonth(),
      today.getDate() + 1,
    );
    expect(getAge(birthdayTomorrow.toISOString())).toBe(39);
  });

  it("returns null for unparseable input", () => {
    expect(getAge("not a date")).toBeNull();
  });
});
