import { useState, useCallback } from 'react';
import type { AIStatus, ImageRef, QACheck, QAStatus, Report } from '@/types/radiology';
import { mockAIImpressions, mockQAChecks } from '@/data/mockData';
import { impressionClient } from '@/services/impressionClient';
import { inferenceClient } from '@/services/inferenceClient';
import { qaClient } from '@/services/qaClient';
import { reportClient } from '@/services/reportClient';
import { mapReportResponse } from '@/services/reportMapping';
import {
  extractInferenceCompletedAt,
  extractInferenceConfidence,
  extractInferenceImageRefs,
  extractInferenceModel,
  extractInferenceSummary,
  pollInferenceResult,
  selectInferenceImageRefs,
} from '@/hooks/reporting/inferenceHelpers';
import { buildChecksFromService, getQaStatus, getWarningsFromChecks } from '@/hooks/reporting/qaHelpers';

const allowMockFallback = import.meta.env.VITE_ALLOW_MOCK_FALLBACK === 'true';

interface GenerateImpressionOptions {
  reportId?: string;
  studyId?: string;
  requestedBy?: string;
  modelVersion?: string;
  imageRefs?: ImageRef[];
  includeAllFrames?: boolean;
  onStatus?: (status: AIStatus) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface UseReportReturn {
  report: Report | null;
  isLoading: boolean;
  qaChecks: QACheck[];
  updateFindings: (text: string) => Promise<void>;
  updateImpression: (text: string) => Promise<void>;
  generateImpression: (findings: string, options?: GenerateImpressionOptions) => Promise<string>;
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
  const [qaChecks, setQaChecks] = useState<QACheck[]>(allowMockFallback ? mockQAChecks : []);

  const updateFindings = useCallback(async (text: string) => {
    setIsLoading(true);

    try {
      if (report?.id) {
        const response = await reportClient.updateReport(report.id, {
          findingsText: text,
        });
        setReport(prev => (prev ? mapReportResponse(response, prev) : mapReportResponse(response)));
      } else {
        setReport(prev => prev ? {
          ...prev,
          findingsText: text,
          updatedAt: new Date().toISOString(),
          status: 'draft',
        } : null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [report?.id]);

  const updateImpression = useCallback(async (text: string) => {
    setIsLoading(true);

    try {
      if (report?.id) {
        const response = await reportClient.updateReport(report.id, {
          impressionText: text,
        });
        setReport(prev => (prev ? mapReportResponse(response, prev) : mapReportResponse(response)));
      } else {
        setReport(prev => prev ? {
          ...prev,
          impressionText: text,
          updatedAt: new Date().toISOString(),
        } : null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [report?.id]);

  const generateImpression = useCallback(async (
    findings: string,
    options?: GenerateImpressionOptions
  ): Promise<string> => {
    setIsLoading(true);

    const reportId = options?.reportId ?? report?.id;
    const studyId = options?.studyId ?? report?.studyId;
    const onStatus = options?.onStatus;
    const requestedBy = options?.requestedBy;
    const modelVersion = options?.modelVersion;
    const selectedImageRefs = selectInferenceImageRefs(options?.imageRefs, options?.includeAllFrames);
    const imageUrls = selectedImageRefs.map((ref) => ref.wadoUrl);
    let succeeded = false;

    try {
      onStatus?.('queued');
      const queueResponse = await inferenceClient.queueInference({
        reportId,
        studyId,
        findingsText: findings,
        imageUrls,
        imageRefs: selectedImageRefs,
        requestedBy,
        modelVersion,
      });

      const jobId = queueResponse.job_id ?? queueResponse.jobId;
      if (!jobId) {
        throw new Error('Inference queue missing job id');
      }

      setReport(prev => prev ? {
        ...prev,
        inferenceJobId: jobId,
        inferenceStatus: queueResponse.status ?? 'queued',
        inferenceModelVersion: queueResponse.model_version ?? queueResponse.modelVersion ?? modelVersion,
        inferenceImageRefs: selectedImageRefs,
      } : null);

      const result = await pollInferenceResult(jobId, onStatus);
      const summary = extractInferenceSummary(result);
      if (!summary) {
        throw new Error('Inference result missing summary');
      }

      const confidence = extractInferenceConfidence(result);
      const inferredModel = extractInferenceModel(result);
      const completedAt = extractInferenceCompletedAt(result);
      const inferredImageRefs = extractInferenceImageRefs(result);

      setReport(prev => prev ? {
        ...prev,
        impressionText: summary,
        updatedAt: new Date().toISOString(),
        status: prev.status === 'pending' || prev.status === 'in_progress' ? 'draft' : prev.status,
        inferenceStatus: 'finished',
        inferenceSummary: summary,
        inferenceConfidence: confidence,
        inferenceModelVersion: inferredModel ?? prev.inferenceModelVersion ?? modelVersion,
        inferenceCompletedAt: completedAt,
        inferenceImageRefs: inferredImageRefs ?? prev.inferenceImageRefs ?? selectedImageRefs,
      } : null);

      succeeded = true;
      return summary;
    } catch (error) {
      console.warn('Inference queue failed, falling back to impression service.', error);
      setReport(prev => prev ? {
        ...prev,
        inferenceStatus: 'failed',
      } : null);
      onStatus?.('processing');

      try {
        const response = await impressionClient.generateImpression({
          reportId,
          findingsText: findings,
        });

        const impression = response.text?.trim() || '';
        if (!impression) {
          throw new Error('Impression response missing text');
        }

        setReport(prev => prev ? {
          ...prev,
          impressionText: impression,
          updatedAt: new Date().toISOString(),
          status: prev.status === 'pending' || prev.status === 'in_progress' ? 'draft' : prev.status,
        } : null);

        succeeded = true;
        return impression;
      } catch (fallbackError) {
        if (!allowMockFallback) {
          console.warn('Impression service failed.', fallbackError);
          onStatus?.('error');
          throw fallbackError;
        }

        console.warn('Impression service failed, using mock impression.', fallbackError);

        await wait(1200 + Math.random() * 800);
        const impressionIndex = Math.floor(Math.random() * mockAIImpressions.length);
        const impression = mockAIImpressions[impressionIndex];

        setReport(prev => prev ? {
          ...prev,
          impressionText: impression,
          updatedAt: new Date().toISOString(),
          status: prev.status === 'pending' || prev.status === 'in_progress' ? 'draft' : prev.status,
        } : null);

        succeeded = true;
        return impression;
      }
    } finally {
      setIsLoading(false);
      if (succeeded) {
        onStatus?.('idle');
      }
    }
  }, [report?.id, report?.studyId]);

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
      if (!allowMockFallback) {
        console.warn('QA check failed.', error);
        const checks: QACheck[] = [];
        const warnings = ['QA-Prüfung fehlgeschlagen'];
        const status: QAStatus = 'warn';

        setQaChecks(checks);
        setReport(prev => prev ? {
          ...prev,
          qaStatus: status,
          qaWarnings: warnings,
        } : null);

        return { status, checks, warnings };
      }

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
    if (!report?.id) return;
    setIsLoading(true);

    try {
      const response = await reportClient.finalizeReport(report.id, signature);
      setReport(prev => (prev ? mapReportResponse(response, prev) : mapReportResponse(response)));
    } finally {
      setIsLoading(false);
    }
  }, [report?.id]);

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
