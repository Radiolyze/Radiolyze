import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ImageRef, QueueItem, Report, Series } from "@/types/radiology";
import { useDicomWebQueue } from "@/hooks/useDicomWebQueue";
import { usePriorStudies } from "@/hooks/usePriorStudies";
import { ReportWorkspace } from "../ReportWorkspace";
// The layout header translates its labels; without this the shared instance is
// never initialised and react-i18next warns on every render.
import "@/i18n";

// The real panels drag cornerstone and vtk in with them, neither of which runs
// under jsdom. What this test is for is the wiring — which hook feeds which
// prop — so each panel is replaced by a probe that renders what it was handed.
vi.mock("@/components/Sidebar/LeftSidebar", () => ({
  LeftSidebar: ({
    patient,
    study,
    queueItems,
    selectedSeriesId,
    onSelectQueueItem,
    wsConnected,
  }: {
    patient: { name: string };
    study: { studyDescription: string };
    queueItems: QueueItem[];
    selectedSeriesId: string | null;
    onSelectQueueItem: (item: QueueItem) => void;
    wsConnected?: boolean;
  }) => (
    <div>
      <span data-testid="patient">{patient.name}</span>
      <span data-testid="study">{study.studyDescription}</span>
      <span data-testid="series">{selectedSeriesId ?? "none"}</span>
      <span data-testid="ws">{wsConnected ? "connected" : "offline"}</span>
      {queueItems.map((item) => (
        <button key={item.id} onClick={() => onSelectQueueItem(item)}>
          {item.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/Viewer/ComparisonViewer", () => ({
  ComparisonViewer: ({
    currentSeries,
    priorStudies = [],
    onImageRefsChange,
  }: {
    currentSeries: Series | null;
    priorStudies?: Array<{ label: string }>;
    onImageRefsChange?: (refs: ImageRef[]) => void;
  }) => (
    <div>
      <span data-testid="viewer-series">{currentSeries?.id ?? "none"}</span>
      <span data-testid="viewer-priors">{priorStudies.map((p) => p.label).join(",")}</span>
      <button onClick={() => onImageRefsChange?.([])}>emit-refs</button>
    </div>
  ),
}));

vi.mock("@/components/RightPanel/RightPanel", () => ({
  RightPanel: ({
    report,
    findings,
    onFindingsChange,
    onSaveFindings,
  }: {
    report: Report;
    findings: string;
    onFindingsChange: (text: string) => void;
    onSaveFindings?: () => void;
  }) => (
    <div>
      <span data-testid="report">{report.id}</span>
      <textarea
        aria-label="findings"
        value={findings}
        onChange={(event) => onFindingsChange(event.target.value)}
      />
      <button onClick={() => onSaveFindings?.()}>save</button>
    </div>
  ),
}));

vi.mock("@/hooks/useDicomWebQueue", () => ({ useDicomWebQueue: vi.fn() }));
vi.mock("@/hooks/usePriorStudies", () => ({ usePriorStudies: vi.fn() }));
vi.mock("@/hooks/useReportStatusSync", () => ({
  useReportStatusSync: () => ({
    isConnected: true,
    getEnhancedItems: (items: QueueItem[]) => items,
    getReportStatus: () => undefined,
  }),
}));
vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({ preferences: { asrLanguage: "de-DE" } }),
}));
vi.mock("@/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/hooks/useDateFormat", () => ({
  useDateFormat: () => ({ formatDate: (value: string) => `fmt:${value}` }),
}));
vi.mock("@/services/auditLogger", () => ({ auditLogger: { logEvent: vi.fn() } }));
vi.mock("@/services/reportClient", () => ({
  reportClient: { updateFindings: vi.fn(), createComparison: vi.fn(), finalize: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const dicomWebQueue = vi.mocked(useDicomWebQueue);
const priorStudies = vi.mocked(usePriorStudies);

const series = (id: string): Series => ({
  id,
  studyId: "study-1",
  seriesNumber: 1,
  seriesDescription: id,
  modality: "CT",
  frameCount: 10,
});

const queueItem = (id: string, patientName: string, findingsText = ""): QueueItem => ({
  id,
  patient: {
    id: `pat-${id}`,
    name: patientName,
    dateOfBirth: "1980-01-01",
    gender: "F",
    mrn: `MRN-${id}`,
  },
  study: {
    id: `study-${id}`,
    patientId: `pat-${id}`,
    accessionNumber: `ACC-${id}`,
    modality: "CT",
    studyDate: "2026-03-14",
    studyDescription: `Thorax ${id}`,
    referringPhysician: "Dr. Who",
    series: [series(`series-${id}`)],
  },
  report: {
    id: `report-${id}`,
    studyId: `study-${id}`,
    patientId: `pat-${id}`,
    status: "pending",
    findingsText,
    impressionText: "",
    createdAt: "2026-03-14T00:00:00Z",
    updatedAt: "2026-03-14T00:00:00Z",
    qaStatus: "pending",
    qaWarnings: [],
  },
  priority: "normal",
});

const mockQueue = (items: QueueItem[], isLoading = false) => {
  dicomWebQueue.mockReturnValue({
    items,
    isLoading,
    error: null,
  } as ReturnType<typeof useDicomWebQueue>);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQueue([]);
  priorStudies.mockReturnValue({
    priorStudies: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePriorStudies>);
});

afterEach(cleanup);

// MainLayout renders the app header, which reads the current route.
const renderWorkspace = () =>
  render(
    <MemoryRouter>
      <ReportWorkspace />
    </MemoryRouter>,
  );

describe("ReportWorkspace — before a report is open", () => {
  it("shows the loading placeholder while the worklist is still coming", () => {
    mockQueue([], true);
    renderWorkspace();

    expect(screen.getByTestId("study")).toHaveTextContent("Lade Studien...");
    expect(screen.getByTestId("report")).toHaveTextContent("placeholder");
  });

  it("says so when the worklist came back empty", () => {
    mockQueue([]);
    renderWorkspace();

    expect(screen.getByTestId("study")).toHaveTextContent("Keine Studien");
  });
});

describe("ReportWorkspace — with a worklist", () => {
  it("opens the first item, its series and its report", async () => {
    mockQueue([queueItem("a", "Doe^Jane", "Erster Befund"), queueItem("b", "Roe^Jim")]);
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("report-a"));
    expect(screen.getByTestId("patient")).toHaveTextContent("Doe^Jane");
    expect(screen.getByTestId("series")).toHaveTextContent("series-a");
    expect(screen.getByTestId("viewer-series")).toHaveTextContent("series-a");
    expect(screen.getByLabelText("findings")).toHaveValue("Erster Befund");
  });

  it("switches patient, series, report and draft together when another item is picked", async () => {
    mockQueue([queueItem("a", "Doe^Jane", "Erster Befund"), queueItem("b", "Roe^Jim", "Zweiter")]);
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("report-a"));
    fireEvent.click(screen.getByRole("button", { name: "b" }));

    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("report-b"));
    expect(screen.getByTestId("patient")).toHaveTextContent("Roe^Jim");
    expect(screen.getByTestId("series")).toHaveTextContent("series-b");
    expect(screen.getByLabelText("findings")).toHaveValue("Zweiter");
  });

  it("keeps what the radiologist types in the findings box", async () => {
    mockQueue([queueItem("a", "Doe^Jane", "Erster Befund")]);
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("report-a"));
    fireEvent.change(screen.getByLabelText("findings"), { target: { value: "Ergänzt" } });

    expect(screen.getByLabelText("findings")).toHaveValue("Ergänzt");
  });

  it("passes the live WebSocket state through to the sidebar", async () => {
    mockQueue([queueItem("a", "Doe^Jane")]);
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId("ws")).toHaveTextContent("connected"));
  });

  it("hands the viewer the patient's priors, labelled and date-formatted", async () => {
    mockQueue([queueItem("a", "Doe^Jane")]);
    priorStudies.mockReturnValue({
      priorStudies: [
        {
          id: "study-old",
          patientId: "pat-a",
          accessionNumber: "ACC-old",
          modality: "CT",
          studyDate: "2026-01-14",
          studyDescription: "Thorax Vorbefund",
          referringPhysician: "Dr. Who",
          series: [series("series-old")],
        },
      ],
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePriorStudies>);

    renderWorkspace();

    await waitFor(() =>
      expect(screen.getByTestId("viewer-priors")).toHaveTextContent("Thorax Vorbefund"),
    );
  });
});
