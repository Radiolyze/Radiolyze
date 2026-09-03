import type { Patient, QACheck, QueueItem, Report, Series, Study } from "@/types/radiology";
import { LeftSidebar } from "@/components/Sidebar/LeftSidebar";
import { ComparisonViewer } from "@/components/Viewer/ComparisonViewer";
import { RightPanel } from "@/components/RightPanel/RightPanel";
import { ReportWorkspaceView } from "@/pages/ReportWorkspaceView";

// Shown for the split second before the first query resolves. The dash is
// deliberately language-neutral: this object is built once at module load, so a
// translated string here would freeze whichever language was active then.
const placeholderPatient: Patient = {
  id: "unknown",
  name: "—",
  dateOfBirth: "",
  gender: "O",
  mrn: "-",
};

const placeholderReport: Report = {
  id: "placeholder",
  studyId: "placeholder",
  patientId: "placeholder",
  status: "pending",
  findingsText: "",
  impressionText: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  qaStatus: "pending",
  qaWarnings: [],
};

const buildPlaceholderStudy = (isLoading: boolean): Study => ({
  id: "unknown",
  patientId: "unknown",
  accessionNumber: "-",
  modality: "CT",
  studyDate: "",
  studyDescription: isLoading ? "Lade Studien..." : "Keine Studien",
  referringPhysician: "-",
  series: [],
});

interface WorkspacePlaceholderProps {
  queueItems: QueueItem[];
  isQueueLoading: boolean;
  wsConnected: boolean;
  onSelectQueueItem: (item: QueueItem) => void;
  onSelectSeries: (series: Series) => void;
  asrLanguage?: string;
  findings: string;
  impression: string;
  qaChecks: QACheck[];
  isAnalyzingImages: boolean;
  onFindingsChange: (text: string) => void;
  onImpressionChange: (text: string) => void;
  onGenerateImpression: () => Promise<void>;
  onAnalyzeImages: () => Promise<void>;
  onApprove: (signature?: string) => void;
  onSaveFindings: () => void;
  onExportSr: (format: "json" | "dicom") => void;
  onAsrStatusChange: (status: "idle" | "listening" | "processing", confidence: number) => void;
}

/**
 * The workspace before a report is open — while the worklist loads, or when it
 * came back empty.
 *
 * The full layout is rendered rather than a spinner so the frame does not jump
 * when the first study arrives, and so the sidebar stays usable: the worklist
 * may well have items even though none is selected yet.
 */
export function WorkspacePlaceholder({
  queueItems,
  isQueueLoading,
  wsConnected,
  onSelectQueueItem,
  onSelectSeries,
  asrLanguage,
  findings,
  impression,
  qaChecks,
  isAnalyzingImages,
  onFindingsChange,
  onImpressionChange,
  onGenerateImpression,
  onAnalyzeImages,
  onApprove,
  onSaveFindings,
  onExportSr,
  onAsrStatusChange,
}: WorkspacePlaceholderProps) {
  return (
    <ReportWorkspaceView
      leftSidebar={
        <LeftSidebar
          patient={placeholderPatient}
          study={buildPlaceholderStudy(isQueueLoading)}
          queueItems={queueItems}
          selectedQueueItemId={null}
          selectedSeriesId={null}
          onSelectQueueItem={onSelectQueueItem}
          onSelectSeries={onSelectSeries}
          priorStudies={[]}
          wsConnected={wsConnected}
        />
      }
      viewer={<ComparisonViewer currentSeries={null} />}
      rightPanel={
        <RightPanel
          report={placeholderReport}
          asrLanguage={asrLanguage}
          findings={findings}
          impression={impression}
          qaChecks={qaChecks}
          isGeneratingImpression={false}
          isAnalyzingImages={isAnalyzingImages}
          onFindingsChange={onFindingsChange}
          onImpressionChange={onImpressionChange}
          onGenerateImpression={onGenerateImpression}
          onAnalyzeImages={onAnalyzeImages}
          onApprove={onApprove}
          onSaveFindings={onSaveFindings}
          onExportSr={onExportSr}
          onAsrStatusChange={onAsrStatusChange}
        />
      }
    />
  );
}
