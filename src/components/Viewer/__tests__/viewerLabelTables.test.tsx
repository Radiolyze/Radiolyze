import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import i18n from "@/i18n";
import { VRTToolbar } from "../VRTToolbar";
import { MPRViewport } from "../MPRViewport";
import { AnnotationLabelDialog } from "../AnnotationLabelDialog";
import { DicomViewerStateOverlay } from "../DicomViewerStateOverlay";
import { DEFAULT_VRT_SETTINGS } from "@/types/vrt";
import { MPR_VIEWPORTS } from "@/types/mpr";

/**
 * The companion to `src/i18n/__tests__/labelTables.test.ts`: that one pins that
 * the resources define every key the tables in `src/types/*` name, this one pins
 * that the components actually resolve them rather than rendering the key.
 *
 * The language switch matters on its own — the strings used to be module-level
 * constants, fixed at import time, so a switch left what was already on screen
 * in the old language (the same defect #228 fixed for the date helpers and #233
 * for the export-format descriptions).
 */

afterEach(async () => {
  // Unmount first: a language change while mounted re-renders outside act().
  cleanup();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

async function setLanguage(lng: string) {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

describe("VRTToolbar", () => {
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

  it("names its buttons through i18n in German", async () => {
    await setLanguage("de");
    renderToolbar();

    expect(screen.getByLabelText("Kamera zurücksetzen")).toBeInTheDocument();
    expect(screen.getByLabelText("Anterior (A)")).toBeInTheDocument();
    expect(screen.getByText("Beleuchtung")).toBeInTheDocument();
  });

  it("names its buttons through i18n in English", async () => {
    await setLanguage("en");
    renderToolbar();

    expect(screen.getByLabelText("Reset camera")).toBeInTheDocument();
    expect(screen.getByText("Lighting")).toBeInTheDocument();
    expect(screen.queryByLabelText("Kamera zurücksetzen")).not.toBeInTheDocument();
  });

  it("re-labels what is on screen when the language changes", async () => {
    await setLanguage("de");
    renderToolbar();
    expect(screen.getByText("Beleuchtung")).toBeInTheDocument();

    await setLanguage("en");
    expect(screen.getByText("Lighting")).toBeInTheDocument();
    expect(screen.queryByText("Beleuchtung")).not.toBeInTheDocument();
  });
});

describe("MPRViewport", () => {
  it("resolves the viewport label from the table's key", async () => {
    const axial = MPR_VIEWPORTS.find((viewport) => viewport.orientation === "axial")!;

    await setLanguage("en");
    render(<MPRViewport config={axial} sliceIndex={0} totalSlices={10} />);

    // Renders the translation, not `mpr.viewports.axial`.
    expect(screen.getByText("Axial")).toBeInTheDocument();
    expect(screen.queryByText(axial.labelKey)).not.toBeInTheDocument();
  });

  it("resolves the slab blend-mode label", async () => {
    const coronal = MPR_VIEWPORTS.find((viewport) => viewport.orientation === "coronal")!;

    await setLanguage("en");
    render(
      <MPRViewport
        config={coronal}
        sliceIndex={0}
        totalSlices={10}
        slabSettings={{ thickness: 10, blendMode: "mip" }}
      />,
    );

    expect(screen.getByText(/MIP/)).toBeInTheDocument();
  });
});

describe("AnnotationLabelDialog", () => {
  it("renders through i18n in both languages", async () => {
    await setLanguage("de");
    const { unmount } = render(
      <AnnotationLabelDialog
        open
        onOpenChange={vi.fn()}
        pendingAnnotation={{ toolType: "rectangle", frameIndex: 2 }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Annotation beschriften")).toBeInTheDocument();
    expect(screen.getByText("Kategorie")).toBeInTheDocument();
    // The context line interpolates rather than concatenating around the values.
    expect(screen.getByText("Tool: rectangle • Frame: 3")).toBeInTheDocument();
    unmount();

    await setLanguage("en");
    render(
      <AnnotationLabelDialog
        open
        onOpenChange={vi.fn()}
        pendingAnnotation={{ toolType: "rectangle", frameIndex: 2 }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Label annotation")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });
});

describe("DicomViewerStateOverlay", () => {
  it("translates the loading and empty states", async () => {
    await setLanguage("en");
    const { unmount } = render(
      <DicomViewerStateOverlay isLoading={true} hasStack={false} />, // loading wins
    );
    expect(screen.getByText("Loading DICOM images...")).toBeInTheDocument();
    unmount();

    render(<DicomViewerStateOverlay isLoading={false} hasStack={false} />);
    expect(screen.getByText("No DICOM images loaded")).toBeInTheDocument();
    expect(screen.getByText("Check the DICOMweb connection and series ID.")).toBeInTheDocument();
  });

  it("keeps a backend error message in place of the empty-state title", async () => {
    await setLanguage("en");
    render(
      <DicomViewerStateOverlay isLoading={false} hasStack={false} error="WADO-RS timed out" />,
    );

    expect(screen.getByText("WADO-RS timed out")).toBeInTheDocument();
    expect(screen.queryByText("No DICOM images loaded")).not.toBeInTheDocument();
  });
});
