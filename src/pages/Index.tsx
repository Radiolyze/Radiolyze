import { useState, useCallback, useEffect } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { DicomViewer } from '@/components/Viewer/DicomViewer';
import { RightPanel } from '@/components/RightPanel/RightPanel';
import { useReport } from '@/hooks/useReport';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { mockQueueItems, mockReports } from '@/data/mockData';
import type { QueueItem, Series } from '@/types/radiology';
import { toast } from 'sonner';
import { auditLogger } from '@/services/auditLogger';

const Index = () => {
  // Current selection state
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem>(mockQueueItems[0]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(
    mockQueueItems[0].study.series[0] || null
  );

  // Report state
  const { report, setReport, qaChecks, generateImpression, runQAChecks } = useReport(mockReports[0]);
  const [findings, setFindings] = useState(mockReports[0].findingsText);
  const [impression, setImpression] = useState(mockReports[0].impressionText);
  const [isGenerating, setIsGenerating] = useState(false);
  const [asrStatus, setAsrStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [asrConfidence, setAsrConfidence] = useState(0);

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

  // Run QA when impression changes
  useEffect(() => {
    if (impression && report?.qaStatus === 'pending') {
      runQAChecks({
        reportId: report?.id,
        findingsText: findings,
        impressionText: impression,
      });
    }
  }, [findings, impression, report?.id, report?.qaStatus, runQAChecks]);

  if (!report) return null;

  return (
    <MainLayout
      leftSidebar={
        <LeftSidebar
          patient={selectedQueueItem.patient}
          study={selectedQueueItem.study}
          queueItems={mockQueueItems}
          selectedQueueItemId={selectedQueueItem.id}
          selectedSeriesId={selectedSeries?.id || null}
          onSelectQueueItem={handleSelectQueueItem}
          onSelectSeries={handleSelectSeries}
        />
      }
      viewer={
        <DicomViewer
          series={selectedSeries}
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
