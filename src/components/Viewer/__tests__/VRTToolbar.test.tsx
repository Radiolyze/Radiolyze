import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { VRTToolbar } from "../VRTToolbar";
import { MPRViewport } from "../MPRViewport";
import { DEFAULT_VRT_SETTINGS } from "@/types/vrt";
import { MPR_VIEWPORTS } from "@/types/mpr";
import i18n from "@/i18n";

/**
 * The toolbars used to read their labels from module constants in
 * `src/types/*` and from literals in the markup, so a language switch left
 * them in German (#117). These render both in each language: the resource
 * tests can only prove a key exists, not that the component reaches for it.
 */

async function setLanguage(lng: string) {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

function renderToolbar() {
  return render(
    <VRTToolbar
      settings={DEFAULT_VRT_SETTINGS}
      onSettingsChange={vi.fn()}
      onPresetChange={vi.fn()}
      onViewAngle={vi.fn()}
      onReset={vi.fn()}
    />,
  );
}

afterEach(async () => {
  // Unmount before switching back: a language change while mounted re-renders
  // outside act() and only produces warnings.
  cleanup();
  await setLanguage("de");
});

describe("VRTToolbar i18n", () => {
  it("renders the lighting popover trigger and the reset control in German", async () => {
    await setLanguage("de");
    renderToolbar();

    expect(screen.getByText("Beleuchtung")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kamera zurücksetzen" })).toBeInTheDocument();
  });

  it("renders them in English after a language switch", async () => {
    await setLanguage("en");
    renderToolbar();

    expect(screen.getByText("Lighting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset camera" })).toBeInTheDocument();
  });

  it("translates the view-angle labels while keeping the shortcut letter", async () => {
    await setLanguage("de");
    renderToolbar();

    // "Left (L)" is "Links (L)" — the mnemonic survives the translation, which
    // is why the shortcut is interpolated rather than baked into the string.
    expect(screen.getByRole("button", { name: "Links (L)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior (A)" })).toBeInTheDocument();
  });
});

describe("MPRViewport i18n", () => {
  const coronal = MPR_VIEWPORTS.find((viewport) => viewport.orientation === "coronal")!;

  it("labels the coronal viewport per language", async () => {
    await setLanguage("de");
    const { unmount } = render(<MPRViewport config={coronal} sliceIndex={0} totalSlices={10} />);
    expect(screen.getByText("Koronar")).toBeInTheDocument();
    unmount();

    await setLanguage("en");
    render(<MPRViewport config={coronal} sliceIndex={0} totalSlices={10} />);
    expect(screen.getByText("Coronal")).toBeInTheDocument();
  });

  it("renders the slab indicator with its mode and thickness", async () => {
    await setLanguage("en");
    render(
      <MPRViewport
        config={coronal}
        sliceIndex={0}
        totalSlices={10}
        slabSettings={{ thickness: 20, blendMode: "mip" }}
      />,
    );

    expect(screen.getByText("MIP 20mm")).toBeInTheDocument();
  });
});
