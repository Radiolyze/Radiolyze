import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import History from "../History";
import { auditClient, type AuditEventResponse } from "@/services/auditClient";
import { useStudyLookup } from "@/hooks/useStudyLookup";
import i18n from "@/i18n";

vi.mock("@/services/auditClient", () => ({
  auditClient: { listEvents: vi.fn() },
}));

vi.mock("@/hooks/useStudyLookup", () => ({
  useStudyLookup: vi.fn(),
}));

const listEvents = vi.mocked(auditClient.listEvents);
const studyLookup = vi.mocked(useStudyLookup);

const event = (overrides: Partial<AuditEventResponse> = {}): AuditEventResponse => ({
  id: "event-1",
  event_type: "report_created",
  timestamp: new Date().toISOString(),
  ...overrides,
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <History />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
  listEvents.mockResolvedValue([]);
  studyLookup.mockReturnValue({
    studyMap: {},
    isLoading: false,
    error: null,
  } as ReturnType<typeof useStudyLookup>);
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("de");
});

describe("History page", () => {
  it("renders the audit events it fetched", async () => {
    listEvents.mockResolvedValue([
      event({
        id: "a",
        event_type: "report_approved",
        metadata: { patient_name: "Doe, Jane", accession_number: "ACC-1", actor_name: "Dr. Meier" },
      }),
    ]);

    renderPage();

    // Resolved values also appear in the raw metadata chips below each entry,
    // so these are the entry's own rendering plus its metadata line.
    expect(await screen.findAllByText("Doe, Jane")).not.toHaveLength(0);
    expect(screen.getAllByText("ACC-1").length).toBeGreaterThan(0);
    // The actor also becomes an option in the actor filter.
    expect(screen.getAllByText("Dr. Meier").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there is nothing to show", async () => {
    renderPage();
    expect(await screen.findByText("No items in queue")).toBeInTheDocument();
  });

  it("counts today's events, approvals and generated impressions", async () => {
    listEvents.mockResolvedValue([
      event({ id: "a", event_type: "report_approved" }),
      event({ id: "b", event_type: "impression_generated" }),
      event({ id: "c", event_type: "report_created", timestamp: "2026-01-02T09:00:00.000Z" }),
    ]);

    renderPage();

    // Two of the three events carry today's timestamp.
    const today = (await screen.findByText("Today")).closest("div")?.parentElement;
    expect(within(today as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("filters the timeline by the search box", async () => {
    listEvents.mockResolvedValue([
      event({ id: "a", metadata: { patient_name: "Doe, Jane" } }),
      event({ id: "b", metadata: { patient_name: "Roe, John" } }),
    ]);

    renderPage();
    await screen.findAllByText("Doe, Jane");

    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "roe" } });

    await waitFor(() => expect(screen.queryAllByText("Doe, Jane")).toHaveLength(0));
    expect(screen.getAllByText("Roe, John").length).toBeGreaterThan(0);
  });

  it("fills a placeholder patient name from the study lookup", async () => {
    listEvents.mockResolvedValue([
      event({ id: "a", event_type: "report_opened", study_id: "study-abcdef123456" }),
    ]);
    studyLookup.mockReturnValue({
      studyMap: {
        "study-abcdef123456": {
          studyId: "study-abcdef123456",
          patientId: "pat-1",
          patientName: "Doe, Jane",
          mrn: "MRN-1",
          accessionNumber: "ACC-4711",
          modality: "CT",
          studyDescription: "Thorax",
          studyDate: "2026-08-01",
          referringPhysician: "Dr. Ref",
        },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStudyLookup>);

    renderPage();

    expect(await screen.findByText("Doe, Jane")).toBeInTheDocument();
    expect(screen.getByText("ACC-4711")).toBeInTheDocument();
    expect(screen.queryByText("Study study-ab...")).not.toBeInTheDocument();
  });
});
