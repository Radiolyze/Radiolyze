import { useCallback, useState } from 'react';

import {
  inferenceClient,
  type ComparisonPayload,
  type VolumeInferencePayload,
} from '@/services/inferenceClient';
import {
  extractInferenceCompletedAt,
  extractInferenceConfidence,
  extractInferenceEvidenceIndices,
  extractInferenceMetadata,
  extractInferenceModel,
  extractInferenceSummary,
  pollInferenceResult,
} from '@/hooks/reporting/inferenceHelpers';
import type { AIStatus } from '@/types/radiology';

export interface VolumeInferenceResult {
  summary: string;
  confidence?: number;
  modelVersion?: string;
  completedAt?: string;
  evidenceIndices?: number[];
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown> | null;
}

export interface UseVolumeInferenceReturn {
  isRunning: boolean;
  error: string | null;
  status: AIStatus | null;
  runVolumeInference: (payload: VolumeInferencePayload) => Promise<VolumeInferenceResult>;
  runComparison: (payload: ComparisonPayload) => Promise<VolumeInferenceResult>;
}

const buildResult = (raw: Record<string, unknown> | null | undefined): VolumeInferenceResult => {
  const summary = extractInferenceSummary(raw);
  if (!summary) {
    throw new Error('Inference result missing summary');
  }
  return {
    summary,
    confidence: extractInferenceConfidence(raw),
    modelVersion: extractInferenceModel(raw),
    completedAt: extractInferenceCompletedAt(raw),
    evidenceIndices: extractInferenceEvidenceIndices(raw),
    metadata: extractInferenceMetadata(raw),
    raw,
  };
};

export function useVolumeInference(): UseVolumeInferenceReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AIStatus | null>(null);

  const runVolumeInference = useCallback(
    async (payload: VolumeInferencePayload): Promise<VolumeInferenceResult> => {
      setIsRunning(true);
      setError(null);
      setStatus('queued');
      try {
        const queueResponse = await inferenceClient.queueVolumeInference(payload);
        const jobId = queueResponse.job_id ?? queueResponse.jobId;
        if (!jobId) {
          throw new Error('Volume inference queue missing job id');
        }
        const raw = await pollInferenceResult(jobId, (next) => setStatus(next));
        const result = buildResult(raw);
        setStatus('idle');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Volume inference failed';
        setError(message);
        setStatus('error');
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  const runComparison = useCallback(
    async (payload: ComparisonPayload): Promise<VolumeInferenceResult> => {
      setIsRunning(true);
      setError(null);
      setStatus('queued');
      try {
        const queueResponse = await inferenceClient.queueComparison(payload);
        const jobId = queueResponse.job_id ?? queueResponse.jobId;
        if (!jobId) {
          throw new Error('Comparison queue missing job id');
        }
        const raw = await pollInferenceResult(jobId, (next) => setStatus(next));
        const result = buildResult(raw);
        setStatus('idle');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Comparison failed';
        setError(message);
        setStatus('error');
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  return { isRunning, error, status, runVolumeInference, runComparison };
}
