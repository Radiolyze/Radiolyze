import { useState, useCallback, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { ComparisonViewer } from '@/components/Viewer/ComparisonViewer';
import { RightPanel } from '@/components/RightPanel/RightPanel';
import { useReport } from '@/hooks/useReport';
import { useDicomWebQueue } from '@/hooks/useDicomWebQueue';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useReportStatusSync } from '@/hooks/useReportStatusSync';
import type { AIStatus, QueueItem, Series } from '@/types/radiology';
import { toast } from 'sonner';
import { auditLogger } from '@/services/auditLogger';
import { reportClient } from '@/services/reportClient';
import { mockPriorStudies, formatDate } from '@/data/mockData';

const Index = () => {
  const { items: queueItems, isLoading: isQueueLoading, error: queueError } = useDicomWebQueue();
  
  // WebSocket live status sync
  const { isConnected: wsConnected, getEnhancedItems, getReportStatus } = useReportStatusSync(queueItems);
  const enhancedQueueItems = useMemo(() => getEnhancedItems(queueItems), [queueItems, getEnhancedItems]);

  // Current selection state
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);

  // Report state
  const { report, setReport, qaChecks, generateImpression, runQAChecks } = useReport();
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [aiStatus, setAiStatus] = useState<AIStatus>('idle');
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

  const handleGenerateImpression = useCallback(async () => {
    if (!findings || isGenerating) return;

    try {
      const result = await generateImpression(findings, { onStatus: setAiStatus });
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
  }, [findings, generateImpression, isGenerating, report?.id, runQAChecks]);

  const handleApprove = useCallback(async (signature?: string) => {
    const name = signature?.trim();
    toast.success(`Report freigegeben${name ? ` (${name})` : ''}`);
    await auditLogger.logEvent({
      eventType: 'report_approved',
      actorId: name,
      reportId: report?.id,
      studyId: report?.studyId,
      metadata: { signature: name },
    });
  }, [report?.id, report?.studyId]);

  const handleSaveFindings = useCallback(async () => {
    toast.success('Befund gespeichert');
    await auditLogger.logEvent({
      eventType: 'findings_saved',
      reportId: report?.id,
      studyId: report?.studyId,
    });
  }, [report?.id, report?.studyId]);

  const handleExportSr = useCallback(async () => {
    if (!report?.id) {
      return;
    }

    try {
      const result = await reportClient.exportStructuredReport(report.id);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('DICOM SR exportiert');
    } catch (error) {
      console.warn('DICOM SR export failed', error);
      toast.error('DICOM SR Export fehlgeschlagen');
    }
  }, [report?.id]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSaveFindings,
    onApprove: handleApprove,
  });

  // Get prior studies for current patient
  const priorStudies = useMemo(() => {
    if (!selectedQueueItem) return [];
    return mockPriorStudies.filter((study) => study.patientId === selectedQueueItem.patient.id);
  }, [selectedQueueItem]);

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
      <MainLayout
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
            report={{
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
            }}
            findings={findings}
            impression={impression}
            qaChecks={qaChecks}
            isGeneratingImpression={false}
            onFindingsChange={setFindings}
            onImpressionChange={setImpression}
            onGenerateImpression={handleGenerateImpression}
            onApprove={handleApprove}
            onSaveFindings={handleSaveFindings}
            onExportSr={handleExportSr}
            onAsrStatusChange={(status, confidence) => {
              setAsrStatus(status);
              setAsrConfidence(confidence);
            }}
          />
        }
      />
    );
  }

  return (
    <MainLayout
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
        />
      }
      rightPanel={
        <RightPanel
          report={report}
          findings={findings}
          impression={impression}
          qaChecks={qaChecks}
          isGeneratingImpression={isGenerating}
          onFindingsChange={setFindings}
          onImpressionChange={setImpression}
          onGenerateImpression={handleGenerateImpression}
          onApprove={handleApprove}
          onSaveFindings={handleSaveFindings}
          onExportSr={handleExportSr}
          onAsrStatusChange={(status, confidence) => {
            setAsrStatus(status);
            setAsrConfidence(confidence);
          }}
        />
      }
    />
  );
};

export default Index;
