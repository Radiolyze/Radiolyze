import { useState, useCallback } from 'react';
import type { Report, QAStatus, QACheck } from '@/types/radiology';
import { mockAIImpressions, mockQAChecks } from '@/data/mockData';
import { qaClient, type QAServiceResponse } from '@/services/qaClient';

const buildChecksFromService = (response: QAServiceResponse): QACheck[] => {
  if (Array.isArray(response.checks) && response.checks.length > 0) {
    return response.checks;
  }

  const failures = Array.isArray(response.failures) ? response.failures : [];
  const warnings = Array.isArray(response.warnings) ? response.warnings : [];
  const checks: QACheck[] = [];

  failures.forEach((message, index) => {
    const trimmed = message?.trim();
    checks.push({
      id: `qa-fail-${index}`,
      name: trimmed || 'QA Fehler',
      status: 'fail',
      message: trimmed || undefined,
    });
  });

  warnings.forEach((message, index) => {
    const trimmed = message?.trim();
    checks.push({
      id: `qa-warn-${index}`,
      name: trimmed || 'QA Warnung',
      status: 'warn',
      message: trimmed || undefined,
    });
  });

  if (checks.length === 0 && response.passes) {
    checks.push({ id: 'qa-pass', name: 'QA Gesamtstatus', status: 'pass' });
  }

  return checks;
};

const getWarningsFromChecks = (checks: QACheck[], response?: QAServiceResponse) => {
  if (response?.warnings && response.warnings.length > 0) {
    return response.warnings;
  }
  return checks
    .filter(check => check.status === 'warn')
    .map(check => check.message || check.name);
};

const getQaStatus = (checks: QACheck[], response?: QAServiceResponse): QAStatus => {
  const hasFailure = checks.some(check => check.status === 'fail') || (response?.failures?.length ?? 0) > 0;
  const hasWarning = checks.some(check => check.status === 'warn') || (response?.warnings?.length ?? 0) > 0;

  if (hasFailure) return 'fail';
  if (hasWarning) return 'warn';
  if (checks.some(check => check.status === 'pass')) return 'pass';
  if (response?.passes === true) return 'pass';
  if (response?.passes === false) return 'fail';
  return 'pending';
};

interface UseReportReturn {
  report: Report | null;
  isLoading: boolean;
  qaChecks: QACheck[];
  updateFindings: (text: string) => Promise<void>;
  updateImpression: (text: string) => Promise<void>;
  generateImpression: (findings: string) => Promise<string>;
  runQAChecks: (input?: {
    reportId?: string;
    findingsText?: string;
    impressionText?: string;
  }) => Promise<{ status: QAStatus; checks: QACheck[]; warnings: string[] }>;
  approveReport: (signature: string) => Promise<void>;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
}

export function useReport(initialReport?: Report): UseReportReturn {
  const [report, setReport] = useState<Report | null>(initialReport || null);
  const [isLoading, setIsLoading] = useState(false);
  const [qaChecks, setQaChecks] = useState<QACheck[]>(mockQAChecks);

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

  const runQAChecks = useCallback(async (input?: {
    reportId?: string;
    findingsText?: string;
    impressionText?: string;
  }) => {
    setReport(prev => prev ? { ...prev, qaStatus: 'checking' } : null);

    const payload = {
      reportId: input?.reportId ?? report?.id,
      findingsText: input?.findingsText ?? report?.findingsText ?? '',
      impressionText: input?.impressionText ?? report?.impressionText ?? '',
    };

    try {
      const response = await qaClient.runChecks(payload);
      const checks = buildChecksFromService(response);
      const warnings = getWarningsFromChecks(checks, response);
      const status = getQaStatus(checks, response);

      setQaChecks(checks);
      setReport(prev => prev ? {
        ...prev,
        qaStatus: status,
        qaWarnings: warnings,
      } : null);

      return { status, checks, warnings };
    } catch (error) {
      console.warn('QA check failed, using mock checks.', error);

      const checks = mockQAChecks;
      const warnings = getWarningsFromChecks(checks);
      const status = getQaStatus(checks);

      setQaChecks(checks);
      setReport(prev => prev ? {
        ...prev,
        qaStatus: status,
        qaWarnings: warnings,
      } : null);

      return { status, checks, warnings };
    }
  }, [report?.findingsText, report?.id, report?.impressionText]);

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
