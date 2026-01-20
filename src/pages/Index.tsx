import { useState, useCallback, useEffect } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { DicomViewer } from '@/components/Viewer/DicomViewer';
import { RightPanel } from '@/components/RightPanel/RightPanel';
import { useReport } from '@/hooks/useReport';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { mockQueueItems, mockPatients, mockStudies, mockReports } from '@/data/mockData';
import type { QueueItem, Series } from '@/types/radiology';
import { toast } from 'sonner';

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
      await runQAChecks();
    } finally {
      setIsGenerating(false);
    }
  }, [findings, generateImpression, runQAChecks]);

  const handleApprove = useCallback(() => {
    toast.success('Report freigegeben und abgeschlossen!');
  }, []);

  const handleSaveFindings = useCallback(() => {
    toast.success('Befund gespeichert');
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSaveFindings,
    onApprove: handleApprove,
  });

  // Run QA when impression changes
  useEffect(() => {
    if (impression && report?.qaStatus === 'pending') {
      runQAChecks();
    }
  }, [impression, report?.qaStatus, runQAChecks]);

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
        <DicomViewer series={selectedSeries} />
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
        />
      }
    />
  );
};

export default Index;
