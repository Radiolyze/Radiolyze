import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

/**
 * `cn()` is the one place where a dependency can break the whole component
 * library without failing anything else: `tailwind-merge` declares no
 * peerDependencies, nothing about it is type-level, and a version mismatched
 * with the installed Tailwind resolves class conflicts against the wrong
 * table — leaving both sides of a conflict in place, so which one wins comes
 * down to CSS source order. Install, typecheck and every other test stay
 * green (#197).
 *
 * The cases below are chosen to fail on that mismatch: each one merges a
 * utility whose name or syntax only exists in Tailwind 4, so a
 * `tailwind-merge` that predates it treats the class as unknown and keeps
 * both.
 */
describe("cn", () => {
  it("resolves conflicts against the installed Tailwind's utility names", () => {
    // Renamed in v4 (`outline-none` -> `outline-hidden`); tailwind-merge 2
    // does not know the new name and keeps both.
    expect(cn("outline-none", "outline-hidden")).toBe("outline-hidden");
    expect(cn("shadow-sm", "shadow-xs")).toBe("shadow-xs");
    expect(cn("backdrop-blur-sm", "backdrop-blur-xs")).toBe("backdrop-blur-xs");
  });

  it("resolves conflicts against v4's CSS-variable shorthand", () => {
    // `w-(--var)` is v4 syntax for what v3 wrote as `w-[--var]`.
    expect(cn("w-4", "w-(--sidebar-width)")).toBe("w-(--sidebar-width)");
    expect(cn("bg-red-500", "bg-(--color-bg)")).toBe("bg-(--color-bg)");
  });

  it("treats the design system's own colours as one conflict group", () => {
    expect(cn("bg-primary", "bg-panel-secondary")).toBe("bg-panel-secondary");
    expect(cn("text-confidence-high", "text-confidence-low")).toBe("text-confidence-low");
    expect(cn("border-border", "border-destructive")).toBe("border-destructive");
  });

  it("keeps the last value per variant and drops the shorthand it overrides", () => {
    expect(cn("px-2", "p-4")).toBe("p-4");
    expect(cn("hover:bg-accent", "hover:bg-primary")).toBe("hover:bg-primary");
    expect(cn("bg-primary", "hover:bg-accent")).toBe("bg-primary hover:bg-accent");
  });

  it("passes clsx conditionals through", () => {
    const padding = (compact: boolean) =>
      cn("gap-2", compact && "p-2", undefined, [{ "p-4": !compact }]);

    expect(padding(true)).toBe("gap-2 p-2");
    expect(padding(false)).toBe("gap-2 p-4");
  });
});
