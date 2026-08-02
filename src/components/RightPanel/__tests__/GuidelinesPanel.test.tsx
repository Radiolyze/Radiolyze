import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GuidelinesPanel } from "../GuidelinesPanel";
import { guidelinesClient, type GuidelinePayload } from "@/services/guidelinesClient";
import "@/i18n";

vi.mock("@/services/guidelinesClient", () => ({
  guidelinesClient: { semanticSearch: vi.fn() },
}));

const semanticSearch = vi.mocked(guidelinesClient.semanticSearch);

function guideline(overrides: Partial<GuidelinePayload> = {}): GuidelinePayload {
  return {
    id: "gl-1",
    title: "Fleischner 2017",
    category: "CT Thorax",
    body: "Follow-up recommendations for pulmonary nodules.",
    source: "Fleischner Society",
    keywords: "nodule,follow-up",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPanel(props: Partial<Parameters<typeof GuidelinesPanel>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GuidelinesPanel {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  semanticSearch.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GuidelinesPanel", () => {
  it("fetches nothing while the panel is collapsed", async () => {
    renderPanel();
    await waitFor(() => expect(semanticSearch).not.toHaveBeenCalled());
  });

  it("searches for the report's findings context when opened", async () => {
    semanticSearch.mockResolvedValue([guideline()]);
    renderPanel({ findingsContext: "Rundherd im rechten Oberlappen", isOpenByDefault: true });

    await waitFor(() =>
      expect(semanticSearch).toHaveBeenCalledWith("Rundherd im rechten Oberlappen"),
    );
    expect(await screen.findByText("Fleischner 2017")).toBeInTheDocument();
  });

  it("truncates a long findings context to the first 100 characters", async () => {
    renderPanel({ findingsContext: "x".repeat(250), isOpenByDefault: true });
    await waitFor(() => expect(semanticSearch).toHaveBeenCalledWith("x".repeat(100)));
  });

  it("searches once per settled search term rather than once per keystroke", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel({ findingsContext: "context", isOpenByDefault: true });
    await waitFor(() => expect(semanticSearch).toHaveBeenCalledTimes(1));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "nod" } });
    fireEvent.change(input, { target: { value: "nodu" } });
    fireEvent.change(input, { target: { value: "nodule" } });

    await act(() => vi.advanceTimersByTimeAsync(350));

    await waitFor(() => expect(semanticSearch).toHaveBeenCalledTimes(2));
    expect(semanticSearch).toHaveBeenLastCalledWith("nodule");
  });

  it("falls back to the findings context when the search box is cleared", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel({ findingsContext: "context", isOpenByDefault: true });
    await waitFor(() => expect(semanticSearch).toHaveBeenCalledTimes(1));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "nodule" } });
    await act(() => vi.advanceTimersByTimeAsync(350));
    await waitFor(() => expect(semanticSearch).toHaveBeenLastCalledWith("nodule"));

    fireEvent.change(input, { target: { value: "   " } });
    await act(() => vi.advanceTimersByTimeAsync(350));
    await waitFor(() => expect(semanticSearch).toHaveBeenLastCalledWith("context"));
  });

  it("shows an error message when the search fails", async () => {
    semanticSearch.mockRejectedValue(new Error("backend down"));
    renderPanel({ isOpenByDefault: true });

    expect(
      await screen.findByText(/could not be loaded|nicht geladen werden/i),
    ).toBeInTheDocument();
  });

  it("reports an empty result only once the search has actually returned", async () => {
    let resolveSearch: (value: GuidelinePayload[]) => void = () => {};
    semanticSearch.mockReturnValue(
      new Promise<GuidelinePayload[]>((resolve) => {
        resolveSearch = resolve;
      }),
    );

    renderPanel({ isOpenByDefault: true });
    expect(screen.queryByText(/no guidelines found|Keine Leitlinien gefunden/i)).toBeNull();

    resolveSearch([]);
    expect(
      await screen.findByText(/no guidelines found|Keine Leitlinien gefunden/i),
    ).toBeInTheDocument();
  });

  it("keeps the previous hits on screen while the next search is in flight", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    semanticSearch.mockResolvedValue([guideline({ title: "Fleischner 2017" })]);
    renderPanel({ findingsContext: "context", isOpenByDefault: true });
    expect(await screen.findByText("Fleischner 2017")).toBeInTheDocument();

    semanticSearch.mockReturnValue(new Promise<GuidelinePayload[]>(() => {}));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lung-rads" } });
    await act(() => vi.advanceTimersByTimeAsync(350));

    await waitFor(() => expect(semanticSearch).toHaveBeenLastCalledWith("lung-rads"));
    expect(screen.getByText("Fleischner 2017")).toBeInTheDocument();
  });
});
