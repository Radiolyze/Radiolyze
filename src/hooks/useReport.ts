import { useState, useCallback } from 'react';
import type { AIStatus, QACheck, QAStatus, Report, ReportStatus } from '@/types/radiology';
import { mockAIImpressions, mockQAChecks } from '@/data/mockData';
import { impressionClient } from '@/services/impressionClient';
import { inferenceClient } from '@/services/inferenceClient';
import { qaClient, type QAServiceResponse } from '@/services/qaClient';
import { reportClient, type ReportResponsePayload } from '@/services/reportClient';

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

const reportStatusValues: ReportStatus[] = ['pending', 'in_progress', 'draft', 'approved', 'finalized'];
const qaStatusValues: QAStatus[] = ['pending', 'checking', 'pass', 'warn', 'fail'];

const isReportStatus = (value?: string): value is ReportStatus =>
  Boolean(value && reportStatusValues.includes(value as ReportStatus));

const isQaStatus = (value?: string): value is QAStatus =>
  Boolean(value && qaStatusValues.includes(value as QAStatus));

const mapReportResponse = (payload: ReportResponsePayload, existing?: Report | null): Report => ({
  id: payload.id,
  studyId: payload.study_id,
  patientId: payload.patient_id,
  status: isReportStatus(payload.status) ? payload.status : existing?.status ?? 'pending',
  findingsText: payload.findings_text ?? existing?.findingsText ?? '',
  impressionText: payload.impression_text ?? existing?.impressionText ?? '',
  createdAt: payload.created_at ?? existing?.createdAt ?? new Date().toISOString(),
  updatedAt: payload.updated_at ?? existing?.updatedAt ?? new Date().toISOString(),
  approvedAt: payload.approved_at ?? undefined,
  approvedBy: payload.approved_by ?? undefined,
  qaStatus: isQaStatus(payload.qa_status) ? payload.qa_status : existing?.qaStatus ?? 'pending',
  qaWarnings: payload.qa_warnings ?? existing?.qaWarnings ?? [],
  inferenceStatus: payload.inference_status ?? existing?.inferenceStatus,
  inferenceSummary: payload.inference_summary ?? existing?.inferenceSummary,
  inferenceConfidence: payload.inference_confidence ?? existing?.inferenceConfidence,
  inferenceModelVersion: payload.inference_model_version ?? existing?.inferenceModelVersion,
  inferenceJobId: payload.inference_job_id ?? existing?.inferenceJobId,
  inferenceCompletedAt: payload.inference_completed_at ?? existing?.inferenceCompletedAt,
  aiStatus: existing?.aiStatus,
});

const allowMockFallback = import.meta.env.VITE_ALLOW_MOCK_FALLBACK === 'true';

interface GenerateImpressionOptions {
  reportId?: string;
  studyId?: string;
  requestedBy?: string;
  modelVersion?: string;
  onStatus?: (status: AIStatus) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const extractInferenceSummary = (result?: Record<string, unknown> | null) => {
  if (!result) return '';
  if (typeof result.summary === 'string') return result.summary.trim();
  if (typeof result.text === 'string') return result.text.trim();
  return '';
};

const extractInferenceConfidence = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.confidence === 'number') return result.confidence;
  return undefined;
};

const extractInferenceModel = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.model_version === 'string') return result.model_version;
  if (typeof result.model === 'string') return result.model;
  return undefined;
};

const extractInferenceCompletedAt = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.completed_at === 'string') return result.completed_at;
  if (typeof result.completedAt === 'string') return result.completedAt;
  return undefined;
};

const mapJobStatusToAiStatus = (status?: string): AIStatus | null => {
  if (!status) return null;
  if (status === 'queued' || status === 'deferred' || status === 'scheduled') return 'queued';
  if (status === 'started') return 'processing';
  return null;
};

const pollInferenceResult = async (jobId: string, onStatus?: (status: AIStatus) => void) => {
  const timeoutMs = 30000;
  const pollIntervalMs = 1500;
  const startedAt = Date.now();
  let lastStatus: AIStatus | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await inferenceClient.getStatus(jobId);
    const status = response.status;

    if (status === 'finished') {
      return response.result;
    }

    if (status === 'failed') {
      const message = response.error?.trim() || 'Inference job failed';
      throw new Error(message);
    }

    const mappedStatus = mapJobStatusToAiStatus(status);
    if (mappedStatus && mappedStatus !== lastStatus) {
      onStatus?.(mappedStatus);
      lastStatus = mappedStatus;
    }

    await wait(pollIntervalMs);
  }

  throw new Error('Inference timeout');
};

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
    let succeeded = false;

    try {
      onStatus?.('queued');
      const queueResponse = await inferenceClient.queueInference({
        reportId,
        studyId,
        findingsText: findings,
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
      } : null);

      const result = await pollInferenceResult(jobId, onStatus);
      const summary = extractInferenceSummary(result);
      if (!summary) {
        throw new Error('Inference result missing summary');
      }

      const confidence = extractInferenceConfidence(result);
      const inferredModel = extractInferenceModel(result);
      const completedAt = extractInferenceCompletedAt(result);

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
