import { useCallback, useMemo, useState } from "react";
import type { QueueItem } from "@/types/radiology";
import { LeftSidebar } from "@/components/Sidebar/LeftSidebar";
import { ComparisonViewer } from "@/components/Viewer/ComparisonViewer";
import { RightPanel } from "@/components/RightPanel/RightPanel";
import { WorkspacePlaceholder } from "@/components/Workspace/WorkspacePlaceholder";
import { useReport } from "@/hooks/useReport";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAsrStatus } from "@/hooks/workspace/useAsrStatus";
import { useReportActions } from "@/hooks/workspace/useReportActions";
import { useReportDraft } from "@/hooks/workspace/useReportDraft";
import { useWorkspaceImageRefs } from "@/hooks/workspace/useWorkspaceImageRefs";
import { useWorkspaceInference } from "@/hooks/workspace/useWorkspaceInference";
import { useWorkspacePriors } from "@/hooks/workspace/useWorkspacePriors";
import { useWorkspaceQueue } from "@/hooks/workspace/useWorkspaceQueue";
import { useWorkspaceSelection } from "@/hooks/workspace/useWorkspaceSelection";
import { ReportWorkspaceView } from "./ReportWorkspaceView";

export const ReportWorkspace = () => {
  const { preferences } = useUserPreferences();
  const [useAllFrames, setUseAllFrames] = useState(false);

  const {
    queueItems,
    isLoading: isQueueLoading,
    wsConnected,
    getReportStatus,
  } = useWorkspaceQueue();

  const {
    report,
    setReport,
    qaChecks,
    generateImpression,
    analyzeImages,
    runQAChecks,
    approveReport,
    updateFindings,
  } = useReport();

  const { findings, setFindings, impression, setImpression, loadFromReport } =
    useReportDraft(report);

  const handleSelectItem = useCallback(
    (item: QueueItem) => {
      setReport(item.report);
      loadFromReport(item.report);
    },
    [setReport, loadFromReport],
  );

  const { selectedQueueItem, selectedSeries, selectQueueItem, selectSeries } =
    useWorkspaceSelection({ queueItems, onSelectItem: handleSelectItem });

  const { priorStudies, priorStudiesForViewer, priorStudyDateBySeries } = useWorkspacePriors(
    selectedQueueItem?.patient.id,
    selectedQueueItem?.study.id,
  );

  const {
    imageRefs,
    priorImageRefs,
    evidenceSelection,
    setImageRefs,
    setPriorImageRefs,
    selectEvidence,
  } = useWorkspaceImageRefs({
    currentStudyDate: selectedQueueItem?.study.studyDate,
    priorStudyDateBySeries,
    reportId: report?.id,
  });

  const liveStatus = report ? getReportStatus(report.id) : undefined;

  // A finalize by someone else only reaches this tab over the WebSocket, so the
  // panel has to see the live status rather than the one from the last fetch.
  const liveReport = useMemo(() => {
    if (!report) return report;
    if (!liveStatus?.status || liveStatus.status === report.status) return report;
    return { ...report, status: liveStatus.status };
  }, [report, liveStatus?.status]);

  const inference = useWorkspaceInference({
    report,
    setReport,
    studyId: selectedQueueItem?.study.id,
    findings,
    setFindings,
    setImpression,
    imageRefs,
    priorImageRefs,
    includeAllFrames: useAllFrames,
    generateImpression,
    analyzeImages,
    runQAChecks,
    liveAiStatus: liveStatus?.aiStatus,
  });

  const { approve, saveFindings, exportStructuredReport } = useReportActions({
    report,
    findings,
    approveReport,
    updateFindings,
  });

  const asr = useAsrStatus();

  useKeyboardShortcuts({
    onSave: saveFindings,
    onApprove: approve,
  });

  if (!report || !selectedQueueItem) {
    return (
      <WorkspacePlaceholder
        queueItems={queueItems}
        isQueueLoading={isQueueLoading}
        wsConnected={wsConnected}
        onSelectQueueItem={selectQueueItem}
        onSelectSeries={selectSeries}
        asrLanguage={preferences.asrLanguage}
        findings={findings}
        impression={impression}
        qaChecks={qaChecks}
        isAnalyzingImages={inference.isAnalyzingImages}
        onFindingsChange={setFindings}
        onImpressionChange={setImpression}
        onGenerateImpression={inference.generateImpression}
        onAnalyzeImages={inference.analyzeImages}
        onApprove={approve}
        onSaveFindings={saveFindings}
        onExportSr={exportStructuredReport}
        onAsrStatusChange={asr.handleStatusChange}
      />
    );
  }

  return (
    <ReportWorkspaceView
      leftSidebar={
        <LeftSidebar
          patient={selectedQueueItem.patient}
          study={selectedQueueItem.study}
          queueItems={queueItems}
          selectedQueueItemId={selectedQueueItem.id}
          selectedSeriesId={selectedSeries?.id || null}
          onSelectQueueItem={selectQueueItem}
          onSelectSeries={selectSeries}
          priorStudies={priorStudies}
          wsConnected={wsConnected}
        />
      }
      viewer={
        <ComparisonViewer
          currentSeries={selectedSeries}
          currentStudy={selectedQueueItem.study}
          priorStudies={priorStudiesForViewer}
          progress={{
            asrStatus: liveStatus?.asrStatus || asr.status,
            asrConfidence: liveStatus?.asrConfidence ?? asr.confidence,
            aiStatus: inference.aiStatus,
            qaStatus: liveStatus?.qaStatus || report.qaStatus,
          }}
          onImageRefsChange={setImageRefs}
          onPriorImageRefsChange={setPriorImageRefs}
          evidenceSelection={evidenceSelection}
          findings={report.inferenceFindings ?? []}
          onAnalyzeFrame={inference.analyzeFrame}
          isAnalyzingFrame={inference.isAnalyzingFrame}
        />
      }
      rightPanel={
        <RightPanel
          report={liveReport ?? report}
          asrLanguage={preferences.asrLanguage}
          findings={findings}
          impression={impression}
          qaChecks={qaChecks}
          isGeneratingImpression={inference.isGenerating}
          isAnalyzingImages={inference.isAnalyzingImages}
          onFindingsChange={setFindings}
          onImpressionChange={setImpression}
          onGenerateImpression={inference.generateImpression}
          onAnalyzeImages={inference.analyzeImages}
          onApprove={approve}
          onSaveFindings={saveFindings}
          onExportSr={exportStructuredReport}
          onEvidenceSelect={selectEvidence}
          useAllFrames={useAllFrames}
          onUseAllFramesChange={setUseAllFrames}
          onAsrStatusChange={asr.handleStatusChange}
        />
      }
    />
  );
};
