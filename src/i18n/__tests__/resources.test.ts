import { describe, it, expect } from "vitest";
import i18n, { resources } from "@/i18n";

type Resource = Record<string, unknown>;

function flattenKeys(node: Resource, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flattenKeys(value as Resource, path) : [path];
  });
}

const namespaces = Object.keys(resources.de) as Array<keyof typeof resources.de>;

describe("translation resources", () => {
  it.each(namespaces)("%s carries the same keys in German and English", (ns) => {
    const de = flattenKeys(resources.de[ns] as Resource).sort();
    const en = flattenKeys(resources.en[ns] as Resource).sort();
    expect(de).toEqual(en);
  });

  it("resolves German plurals for prior-report counts", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("report:priorComparison.count", { count: 1 })).toBe("1 Vorbefund");
    expect(i18n.t("report:priorComparison.count", { count: 3 })).toBe("3 Vorbefunde");
  });

  it("resolves English plurals for prior-report counts", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("report:priorComparison.count", { count: 1 })).toBe("1 prior report");
    expect(i18n.t("report:priorComparison.count", { count: 3 })).toBe("3 prior reports");
  });
});
