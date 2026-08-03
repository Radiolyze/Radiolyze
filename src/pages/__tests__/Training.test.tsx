import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Training from "../Training";
import { getTrainingStats, getAnnotationCategories } from "@/services/trainingClient";
import i18n from "@/i18n";

vi.mock("@/services/trainingClient", async () => {
  const actual = await vi.importActual<typeof import("@/services/trainingClient")>(
    "@/services/trainingClient",
  );
  return {
    ...actual,
    getTrainingStats: vi.fn(),
    getAnnotationCategories: vi.fn(),
  };
});

const stats = vi.mocked(getTrainingStats);
const annotationCategories = vi.mocked(getAnnotationCategories);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Training />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stats.mockResolvedValue({
    totalAnnotations: 40,
    verifiedAnnotations: 30,
    categories: {},
    studies: 3,
    series: 5,
  });
  annotationCategories.mockResolvedValue([{ category: "nodule", count: 12 }]);
});

afterEach(async () => {
  // Unmount before resetting the language: a change while the page is still
  // mounted re-renders it outside act() and only produces warnings.
  cleanup();
  await i18n.changeLanguage("de");
});

describe("Training page i18n", () => {
  it("renders German copy when the UI language is German", async () => {
    await i18n.changeLanguage("de");
    renderPage();

    expect(await screen.findByText("Bereit zum Export")).toBeInTheDocument();
    expect(screen.getByText("Nur verifizierte Annotations")).toBeInTheDocument();
    expect(screen.getByText("Export-Einstellungen")).toBeInTheDocument();
  });

  it("renders English copy when the UI language is English", async () => {
    await i18n.changeLanguage("en");
    renderPage();

    expect(await screen.findByText("Ready to export")).toBeInTheDocument();
    expect(screen.getByText("Verified annotations only")).toBeInTheDocument();
    expect(screen.getByText("Export settings")).toBeInTheDocument();
    expect(screen.queryByText("Bereit zum Export")).not.toBeInTheDocument();
  });

  it("reformats what is on screen when the language changes", async () => {
    await i18n.changeLanguage("de");
    renderPage();
    await screen.findByText("Bereit zum Export");

    // The format descriptions are looked up per render rather than held on the
    // module-level FORMAT_INFO constant, so a switch reaches what is on screen.
    expect(
      screen.getByText("Radiolyze Format für Multimodal Fine-Tuning mit LoRA."),
    ).toBeInTheDocument();

    await act(() => i18n.changeLanguage("en"));

    await waitFor(() =>
      expect(
        screen.getByText("Radiolyze format for multimodal fine-tuning with LoRA."),
      ).toBeInTheDocument(),
    );
  });

  it("counts annotations with the plural form the count calls for", async () => {
    await i18n.changeLanguage("en");
    stats.mockResolvedValue({
      totalAnnotations: 1,
      verifiedAnnotations: 1,
      categories: {},
      studies: 1,
      series: 1,
    });
    renderPage();

    expect(await screen.findByText("1 annotation in Radiolyze format")).toBeInTheDocument();
  });

  it("labels the split slider from the same bounds the slider is given", async () => {
    await i18n.changeLanguage("en");
    renderPage();
    await screen.findByText("Ready to export");

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0.5");
    expect(slider).toHaveAttribute("aria-valuemax", "0.95");
    // Same numbers, rendered through the label — the two cannot drift apart.
    expect(screen.getByText("50% train")).toBeInTheDocument();
    expect(screen.getByText("95% train")).toBeInTheDocument();
  });

  it("renders the export hint's manifest path inside a code element", async () => {
    await i18n.changeLanguage("en");
    const { container } = renderPage();
    await screen.findByText("Ready to export");

    // The hint only appears once rendered images are included.
    fireEvent.click(screen.getByLabelText("Include rendered images"));

    await waitFor(() => {
      const code = container.querySelector("code");
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe("images/manifest.json");
    });
    // <Trans> resolves the tag against its `components` map. A name with no
    // match renders as literal text, which the resource-level test cannot see.
    expect(container.textContent).not.toContain("<code>");
  });
});
