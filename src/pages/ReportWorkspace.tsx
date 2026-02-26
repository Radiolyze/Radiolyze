import { useState, useCallback, useEffect, useMemo } from 'react';
import type { AIStatus, ImageRef, QueueItem, Report, Series } from '@/types/radiology';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { ComparisonViewer } from '@/components/Viewer/ComparisonViewer';
import { RightPanel } from '@/components/RightPanel/RightPanel';
import { useReport } from '@/hooks/useReport';
import { useDicomWebQueue } from '@/hooks/useDicomWebQueue';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useReportStatusSync } from '@/hooks/useReportStatusSync';
import { usePriorStudies } from '@/hooks/usePriorStudies';
import { ReportWorkspaceView } from './ReportWorkspaceView';
import { toast } from 'sonner';
import { auditLogger } from '@/services/auditLogger';
import { reportClient } from '@/services/reportClient';
import { formatDate } from '@/data/mockData';

const placeholderReport: Report = {
  id: 'placeholder',
  studyId: 'placeholder',
  patientId: 'placeholder',
  status: 'pending',
  findingsText: '',
  impressionText: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  qaStatus: 'pending',
  qaWarnings: [],
};

const toStudyTimestamp = (value?: string) => {
  if (!value) return undefined;
  const datePart = value.split('T')[0];
  const parts = datePart.split('-').map((entry) => Number(entry));
  if (parts.length === 3 && parts.every((entry) => Number.isFinite(entry))) {
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const computeDeltaDays = (currentDate?: string, priorDate?: string) => {
  const currentTimestamp = toStudyTimestamp(currentDate);
  const priorTimestamp = toStudyTimestamp(priorDate);
  if (currentTimestamp === undefined || priorTimestamp === undefined) return undefined;
  return Math.round((currentTimestamp - priorTimestamp) / (1000 * 60 * 60 * 24));
};

export const ReportWorkspace = () => {
  const { items: queueItemsRaw, isLoading: isQueueLoading, error: queueError } = useDicomWebQueue();
  // Defensive: when DICOMweb requests fail, ensure we never call .map on non-arrays.
  const queueItems = useMemo(
    () => (Array.isArray(queueItemsRaw) ? queueItemsRaw : []),
    [queueItemsRaw]
  );

  // WebSocket live status sync
  const { isConnected: wsConnected, getEnhancedItems, getReportStatus } = useReportStatusSync(queueItems);
  const enhancedQueueItems = useMemo(() => getEnhancedItems(queueItems), [queueItems, getEnhancedItems]);

  // Current selection state
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [imageRefs, setImageRefs] = useState<ImageRef[]>([]);
  const [priorImageRefs, setPriorImageRefs] = useState<ImageRef[]>([]);
  const [evidenceSelection, setEvidenceSelection] = useState<{ seriesId: string; stackIndex: number } | null>(null);
  const [useAllFrames, setUseAllFrames] = useState(false);

  // Report state
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
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [aiStatus, setAiStatus] = useState<AIStatus>('idle');
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);
  const [asrStatus, setAsrStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [asrConfidence, setAsrConfidence] = useState(0);

  // Apply live status updates to current report
  const liveStatus = report ? getReportStatus(report.id) : undefined;
  const effectiveAiStatus: AIStatus = liveStatus?.aiStatus === 'error'
    ? 'error'
    : aiStatus === 'idle'
      ? liveStatus?.aiStatus ?? 'idle'
      : aiStatus;
  const isGenerating = effectiveAiStatus === 'queued' || effectiveAiStatus === 'processing';

  useEffect(() => {
    if (queueError) {
      toast.error(queueError);
    }
  }, [queueError]);

  useEffect(() => {
    setAiStatus('idle');
  }, [report?.id]);

  useEffect(() => {
    if (!report?.id) return;
    auditLogger.logEvent({
      eventType: 'report_opened',
      reportId: report.id,
      studyId: report.studyId,
    });
  }, [report?.id, report?.studyId]);

  // Initialize selection when queue items load
  useEffect(() => {
    if (enhancedQueueItems.length === 0) {
      return;
    }

    setSelectedQueueItem((prev) => {
      const nextItem = prev
        ? enhancedQueueItems.find((item) => item.id === prev.id) || enhancedQueueItems[0]
        : enhancedQueueItems[0];
      setSelectedSeries(nextItem.study.series[0] || null);
      setReport(nextItem.report);
      setFindings(nextItem.report.findingsText);
      setImpression(nextItem.report.impressionText);
      return nextItem;
    });
  }, [enhancedQueueItems, setReport]);

  // Update report when queue item changes
  const handleSelectQueueItem = useCallback((item: QueueItem) => {
    setSelectedQueueItem(item);
    setSelectedSeries(item.study.series[0] || null);
    setReport(item.report);
    setFindings(item.report.findingsText);
    setImpression(item.report.impressionText);
  }, [setReport]);

  const handleSelectSeries = useCallback((series: Series) => {
    setSelectedSeries(series);
  }, []);

  const handleImageRefsChange = useCallback((refs: ImageRef[]) => {
    const studyDate = selectedQueueItem?.study.studyDate;
    const enriched = refs.map((ref) => ({
      ...ref,
      studyDate: ref.studyDate ?? studyDate,
      role: ref.role ?? 'current',
      timeDeltaDays: studyDate ? 0 : ref.timeDeltaDays,
    }));
    setImageRefs(enriched);
  }, [selectedQueueItem?.study.studyDate]);

  const handleEvidenceSelect = useCallback((ref: ImageRef) => {
    setEvidenceSelection({ seriesId: ref.seriesId, stackIndex: ref.stackIndex });
  }, []);

  const handleGenerateImpression = useCallback(async () => {
    if (!findings || isGenerating) return;

    try {
      const result = await generateImpression(findings, {
        onStatus: setAiStatus,
        imageRefs,
        priorImageRefs,
        includeAllFrames: useAllFrames,
      });
      setImpression(result);
      await runQAChecks({
        reportId: report?.id,
        findingsText: findings,
        impressionText: result,
      });
    } catch (error) {
      console.warn('Failed to generate impression', error);
      setAiStatus('error');
      toast.error('KI-Analyse fehlgeschlagen');
    }
  }, [findings, generateImpression, imageRefs, isGenerating, priorImageRefs, report?.id, runQAChecks, useAllFrames]);

  const handleAnalyzeImages = useCallback(async () => {
    if (isGenerating || isAnalyzingImages) return;
    if (imageRefs.length === 0 && priorImageRefs.length === 0) {
      toast.error('Keine Bilder zum Analysieren vorhanden');
      return;
    }

    setIsAnalyzingImages(true);
    try {
      const result = await analyzeImages({
        onStatus: setAiStatus,
        imageRefs,
        priorImageRefs,
        includeAllFrames: useAllFrames,
      });
      setFindings(result.findings);
      setImpression(result.impression);
      await runQAChecks({
        reportId: report?.id,
        findingsText: result.findings,
        impressionText: result.impression,
      });
      toast.success('KI-Analyse abgeschlossen');
    } catch (error) {
      console.warn('Failed to analyze images', error);
      setAiStatus('error');
      toast.error('KI-Analyse fehlgeschlagen');
    } finally {
      setIsAnalyzingImages(false);
    }
  }, [analyzeImages, imageRefs, isAnalyzingImages, isGenerating, priorImageRefs, report?.id, runQAChecks, useAllFrames]);

  const handleApprove = useCallback(async (signature?: string) => {
    const name = signature?.trim();
    if (!name) return;

    try {
      await approveReport(name);
      toast.success(`Report freigegeben (${name})`);
    } catch (error) {
      console.warn('Report finalize failed', error);
      toast.error('Report-Freigabe fehlgeschlagen');
    }
  }, [approveReport]);

  const handleSaveFindings = useCallback(async () => {
    if (!report?.id) {
      return;
    }
    try {
      await updateFindings(findings);
      toast.success('Befund gespeichert');
    } catch (error) {
      console.warn('Findings update failed', error);
      toast.error('Befund speichern fehlgeschlagen');
    }
  }, [findings, report?.id, updateFindings]);

  const handleExportSr = useCallback(async (format: 'json' | 'dicom') => {
    if (!report?.id) {
      return;
    }

    try {
      const result = await reportClient.exportStructuredReport(report.id, format);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`DICOM SR exportiert (${format.toUpperCase()})`);
    } catch (error) {
      console.warn('DICOM SR export failed', error);
      toast.error('DICOM SR Export fehlgeschlagen');
    }
  }, [report?.id]);

  const handleAsrStatusChange = useCallback((status: 'idle' | 'listening' | 'processing', confidence: number) => {
    setAsrStatus(status);
    setAsrConfidence(confidence);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSaveFindings,
    onApprove: handleApprove,
  });

  const {
    priorStudies: priorStudiesRaw,
    error: priorStudiesError,
  } = usePriorStudies(selectedQueueItem?.patient.id, selectedQueueItem?.study.id);

  const priorStudies = useMemo(
    () => (Array.isArray(priorStudiesRaw) ? priorStudiesRaw : []),
    [priorStudiesRaw]
  );

  const priorStudyDateBySeries = useMemo(() => {
    const map = new Map<string, string>();
    priorStudies.forEach((study) => {
      study.series.forEach((series) => {
        map.set(series.id, study.studyDate);
      });
    });
    return map;
  }, [priorStudies]);

  const handlePriorImageRefsChange = useCallback((refs: ImageRef[]) => {
    const currentStudyDate = selectedQueueItem?.study.studyDate;
    const enriched = refs.map((ref) => {
      const priorStudyDate = ref.studyDate ?? priorStudyDateBySeries.get(ref.seriesId);
      return {
        ...ref,
        studyDate: priorStudyDate,
        role: ref.role ?? 'prior',
        timeDeltaDays: computeDeltaDays(currentStudyDate, priorStudyDate),
      };
    });
    setPriorImageRefs(enriched);
  }, [priorStudyDateBySeries, selectedQueueItem?.study.studyDate]);

  useEffect(() => {
    if (priorStudiesError) {
      toast.error(priorStudiesError);
    }
  }, [priorStudiesError]);

  const priorStudiesForViewer = useMemo(
    () =>
      priorStudies.map((study) => ({
        study,
        label: study.studyDescription,
        date: formatDate(study.studyDate),
      })),
    [priorStudies]
  );

  if (!report || !selectedQueueItem) {
    return (
      <ReportWorkspaceView
        leftSidebar={
          <LeftSidebar
            patient={{ id: 'unknown', name: 'Laden...', dateOfBirth: '', gender: 'O', mrn: '-' }}
            study={{
              id: 'unknown',
              patientId: 'unknown',
              accessionNumber: '-',
              modality: 'CT',
              studyDate: '',
              studyDescription: isQueueLoading ? 'Lade Studien...' : 'Keine Studien',
              referringPhysician: '-',
              series: [],
            }}
            queueItems={enhancedQueueItems}
            selectedQueueItemId={null}
            selectedSeriesId={null}
            onSelectQueueItem={handleSelectQueueItem}
            onSelectSeries={handleSelectSeries}
            priorStudies={[]}
            wsConnected={wsConnected}
          />
        }
        viewer={<ComparisonViewer currentSeries={null} />}
        rightPanel={
          <RightPanel
            report={placeholderReport}
            findings={findings}
            impression={impression}
            qaChecks={qaChecks}
            isGeneratingImpression={false}
            isAnalyzingImages={isAnalyzingImages}
            onFindingsChange={setFindings}
            onImpressionChange={setImpression}
            onGenerateImpression={handleGenerateImpression}
            onAnalyzeImages={handleAnalyzeImages}
            onApprove={handleApprove}
            onSaveFindings={handleSaveFindings}
            onExportSr={handleExportSr}
            onAsrStatusChange={handleAsrStatusChange}
          />
        }
      />
    );
  }

  return (
    <ReportWorkspaceView
      leftSidebar={
        <LeftSidebar
          patient={selectedQueueItem.patient}
          study={selectedQueueItem.study}
          queueItems={enhancedQueueItems}
          selectedQueueItemId={selectedQueueItem.id}
          selectedSeriesId={selectedSeries?.id || null}
          onSelectQueueItem={handleSelectQueueItem}
          onSelectSeries={handleSelectSeries}
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
            asrStatus: liveStatus?.asrStatus || asrStatus,
            asrConfidence: liveStatus?.asrConfidence ?? asrConfidence,
            aiStatus: effectiveAiStatus,
            qaStatus: liveStatus?.qaStatus || report.qaStatus,
          }}
          onImageRefsChange={handleImageRefsChange}
          onPriorImageRefsChange={handlePriorImageRefsChange}
          evidenceSelection={evidenceSelection}
          findings={report?.inferenceFindings ?? []}
        />
      }
      rightPanel={
        <RightPanel
          report={report}
          findings={findings}
          impression={impression}
          qaChecks={qaChecks}
          isGeneratingImpression={isGenerating}
          isAnalyzingImages={isAnalyzingImages}
          onFindingsChange={setFindings}
          onImpressionChange={setImpression}
          onGenerateImpression={handleGenerateImpression}
          onAnalyzeImages={handleAnalyzeImages}
          onApprove={handleApprove}
          onSaveFindings={handleSaveFindings}
          onExportSr={handleExportSr}
          onEvidenceSelect={handleEvidenceSelect}
          useAllFrames={useAllFrames}
          onUseAllFramesChange={setUseAllFrames}
          onAsrStatusChange={handleAsrStatusChange}
        />
      }
    />
  );
};
