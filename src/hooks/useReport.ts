import { useState, useCallback } from 'react';
import type { Report, QAStatus, QACheck } from '@/types/radiology';
import { mockAIImpressions } from '@/data/mockData';

// Define mock QA checks locally to avoid type issues
const qaChecks: QACheck[] = [
  { id: 'qa1', name: 'Findings vorhanden', status: 'pass' },
  { id: 'qa2', name: 'Impression vorhanden', status: 'pass' },
  { id: 'qa3', name: 'Lateralität angegeben', status: 'pass' },
  { id: 'qa4', name: 'Größenangabe bei Läsionen', status: 'warn', message: 'Empfehlung: Größe in 3 Dimensionen angeben' },
  { id: 'qa5', name: 'Vergleich mit Voruntersuchung', status: 'pass' },
  { id: 'qa6', name: 'Fleischner-Kriterien angewandt', status: 'warn', message: 'Bei Lungenrundherd >8mm: Follow-up Empfehlung prüfen' },
];

interface UseReportReturn {
  report: Report | null;
  isLoading: boolean;
  qaChecks: QACheck[];
  updateFindings: (text: string) => Promise<void>;
  updateImpression: (text: string) => Promise<void>;
  generateImpression: (findings: string) => Promise<string>;
  runQAChecks: () => Promise<{ status: QAStatus; checks: QACheck[]; warnings: string[] }>;
  approveReport: (signature: string) => Promise<void>;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
}

export function useReport(initialReport?: Report): UseReportReturn {
  const [report, setReport] = useState<Report | null>(initialReport || null);
  const [isLoading, setIsLoading] = useState(false);

  const updateFindings = useCallback(async (text: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setReport(prev => prev ? {
      ...prev,
      findingsText: text,
      updatedAt: new Date().toISOString(),
      status: 'draft',
    } : null);
    
    setIsLoading(false);
  }, []);

  const updateImpression = useCallback(async (text: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setReport(prev => prev ? {
      ...prev,
      impressionText: text,
      updatedAt: new Date().toISOString(),
    } : null);
    
    setIsLoading(false);
  }, []);

  const generateImpression = useCallback(async (findings: string): Promise<string> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    const impressionIndex = Math.floor(Math.random() * mockAIImpressions.length);
    const impression = mockAIImpressions[impressionIndex];
    
    setReport(prev => prev ? {
      ...prev,
      impressionText: impression,
      updatedAt: new Date().toISOString(),
    } : null);
    
    setIsLoading(false);
    return impression;
  }, []);

  const runQAChecks = useCallback(async () => {
    setReport(prev => prev ? { ...prev, qaStatus: 'checking' } : null);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const hasFailure = qaChecks.some(c => c.status === 'fail');
    const hasWarning = qaChecks.some(c => c.status === 'warn');
    
    const status: QAStatus = hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass';
    const warnings = qaChecks
      .filter(c => c.status === 'warn' && c.message)
      .map(c => c.message!);
    
    setReport(prev => prev ? {
      ...prev,
      qaStatus: status,
      qaWarnings: warnings,
    } : null);
    
    return { status, checks: qaChecks, warnings };
  }, []);

  const approveReport = useCallback(async (signature: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setReport(prev => prev ? {
      ...prev,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: signature,
      updatedAt: new Date().toISOString(),
    } : null);
    
    setIsLoading(false);
  }, []);

  return {
    report,
    isLoading,
    qaChecks,
    updateFindings,
    updateImpression,
    generateImpression,
    runQAChecks,
    approveReport,
    setReport,
  };
}
