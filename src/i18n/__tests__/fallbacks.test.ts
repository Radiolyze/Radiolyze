import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resources } from "@/i18n";

/**
 * `t("some.key", "Deutscher Text")` renders the second argument whenever the
 * key is missing from the resources — silently, in *every* language. That is
 * how the login page once shipped German text to English users, and how the
 * comparison panel did after it.
 *
 * This test resolves every such call site against the resources so a missing
 * key fails here instead of surfacing as untranslated text in the UI.
 */

const SOURCE_ROOT = "src";
const SKIP_DIRECTORIES = new Set(["__tests__", "locales", "node_modules"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function flattenKeys(node: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object"
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

/**
 * Every key any namespace defines. Deliberately namespace-blind: a component's
 * namespace comes from whichever `useTranslation` handle the call uses, which
 * is more than a regex can tell. Checking that the key exists *somewhere* still
 * catches the failure this test is about — a key that exists nowhere at all.
 */
const definedKeys = new Set(
  (Object.keys(resources.en) as Array<keyof typeof resources.en>).flatMap((ns) =>
    flattenKeys(resources.en[ns] as Record<string, unknown>).flatMap((key) => [
      key,
      // Plural keys are stored suffixed; call sites use the bare key.
      key.replace(/_(zero|one|two|few|many|other)$/, ""),
    ]),
  ),
);

/** `t("key", "default")` and `tSomething("key", "default")`, single- or multi-line. */
const CALL_WITH_DEFAULT = /\bt[A-Za-z]*\(\s*"([\w.]+)"\s*,\s*\n?\s*"/g;

const callSites = sourceFiles(SOURCE_ROOT).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(CALL_WITH_DEFAULT)].map((match) => ({
    file,
    key: match[1].replace(/^[a-z]+:/, ""),
  }));
});

describe("inline translation fallbacks", () => {
  it("finds the call sites it is meant to guard", () => {
    // A refactor that changes how translations are called should update this
    // test rather than quietly reduce it to asserting nothing.
    expect(callSites.length).toBeGreaterThan(0);
  });

  it("resolves every key that has an inline fallback", () => {
    const unresolved = callSites
      .filter(({ key }) => !definedKeys.has(key))
      .map(({ file, key }) => `${file}: ${key}`);

    expect(unresolved).toEqual([]);
  });
});
