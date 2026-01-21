import { useState, useCallback, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { ComparisonViewer } from '@/components/Viewer/ComparisonViewer';
import { RightPanel } from '@/components/RightPanel/RightPanel';
import { useReport } from '@/hooks/useReport';
import { useDicomWebQueue } from '@/hooks/useDicomWebQueue';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { QueueItem, Series } from '@/types/radiology';
import { toast } from 'sonner';
import { auditLogger } from '@/services/auditLogger';
import { mockPriorStudies, formatDate } from '@/data/mockData';

const Index = () => {
  const { items: queueItems, isLoading: isQueueLoading, error: queueError } = useDicomWebQueue();

  // Current selection state
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);

  // Report state
  const { report, setReport, qaChecks, generateImpression, runQAChecks } = useReport();
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [asrStatus, setAsrStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [asrConfidence, setAsrConfidence] = useState(0);

  useEffect(() => {
    if (queueError) {
      toast.error(queueError);
    }
  }, [queueError]);

  // Initialize selection when queue items load
  useEffect(() => {
    if (queueItems.length === 0) {
      return;
    }

    setSelectedQueueItem((prev) => {
      const nextItem = prev
        ? queueItems.find((item) => item.id === prev.id) || queueItems[0]
        : queueItems[0];
      setSelectedSeries(nextItem.study.series[0] || null);
      setReport(nextItem.report);
      setFindings(nextItem.report.findingsText);
      setImpression(nextItem.report.impressionText);
      return nextItem;
    });
  }, [queueItems, setReport]);

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
    if (!findings) return;
    setIsGenerating(true);
    try {
      const result = await generateImpression(findings);
      setImpression(result);
      await runQAChecks({
        reportId: report?.id,
        findingsText: findings,
        impressionText: result,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [findings, generateImpression, report?.id, runQAChecks]);

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSaveFindings,
    onApprove: handleApprove,
  });

  // Get prior studies for current patient
  const priorStudiesForPatient = useMemo(() => {
    if (!selectedQueueItem) return [];
    return mockPriorStudies
      .filter((study) => study.patientId === selectedQueueItem.patient.id)
      .map((study) => ({
        study,
        label: study.studyDescription,
        date: formatDate(study.studyDate),
      }));
  }, [selectedQueueItem]);

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
            queueItems={queueItems}
            selectedQueueItemId={null}
            selectedSeriesId={null}
            onSelectQueueItem={handleSelectQueueItem}
            onSelectSeries={handleSelectSeries}
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
          queueItems={queueItems}
          selectedQueueItemId={selectedQueueItem.id}
          selectedSeriesId={selectedSeries?.id || null}
          onSelectQueueItem={handleSelectQueueItem}
          onSelectSeries={handleSelectSeries}
        />
      }
      viewer={
        <ComparisonViewer
          currentSeries={selectedSeries}
          currentStudy={selectedQueueItem.study}
          priorStudies={priorStudiesForPatient}
          progress={{
            asrStatus,
            asrConfidence,
            aiStatus: isGenerating ? 'generating' : 'idle',
            qaStatus: report.qaStatus,
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
