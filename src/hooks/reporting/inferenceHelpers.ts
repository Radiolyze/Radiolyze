import type { AIStatus, ImageRef } from '@/types/radiology';
import { inferenceClient } from '@/services/inferenceClient';

const maxInferenceFrames = (() => {
  const parsed = Number(import.meta.env.VITE_INFERENCE_MAX_FRAMES ?? '16');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 16;
  }
  return Math.floor(parsed);
})();

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const selectInferenceImageRefs = (refs: ImageRef[] | undefined, includeAllFrames?: boolean) => {
  if (!refs || refs.length === 0) return [];
  if (includeAllFrames) return refs;
  if (refs.length <= maxInferenceFrames) return refs;
  const step = refs.length / maxInferenceFrames;
  const selected: ImageRef[] = [];
  for (let index = 0; index < maxInferenceFrames; index += 1) {
    const refIndex = Math.min(refs.length - 1, Math.floor(index * step));
    selected.push(refs[refIndex]);
  }
  return selected;
};

export const extractInferenceSummary = (result?: Record<string, unknown> | null) => {
  if (!result) return '';
  if (typeof result.summary === 'string') return result.summary.trim();
  if (typeof result.text === 'string') return result.text.trim();
  return '';
};

export const extractInferenceConfidence = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.confidence === 'number') return result.confidence;
  return undefined;
};

export const extractInferenceModel = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.model_version === 'string') return result.model_version;
  if (typeof result.model === 'string') return result.model;
  return undefined;
};

export const extractInferenceCompletedAt = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.completed_at === 'string') return result.completed_at;
  if (typeof result.completedAt === 'string') return result.completedAt;
  return undefined;
};

const mapInferenceImageRef = (value: Record<string, unknown>): ImageRef | null => {
  const studyId = typeof value.study_id === 'string' ? value.study_id : value.studyId;
  const seriesId = typeof value.series_id === 'string' ? value.series_id : value.seriesId;
  const instanceId = typeof value.instance_id === 'string' ? value.instance_id : value.instanceId;
  const frameIndex = typeof value.frame_index === 'number' ? value.frame_index : value.frameIndex;
  const stackIndex = typeof value.stack_index === 'number' ? value.stack_index : value.stackIndex;
  const wadoUrl = typeof value.wado_url === 'string' ? value.wado_url : value.wadoUrl;
  if (
    typeof studyId !== 'string' ||
    typeof seriesId !== 'string' ||
    typeof instanceId !== 'string' ||
    typeof frameIndex !== 'number' ||
    typeof stackIndex !== 'number' ||
    typeof wadoUrl !== 'string'
  ) {
    return null;
  }
  const imageId = typeof value.image_id === 'string' ? value.image_id : value.imageId;
  return {
    studyId,
    seriesId,
    instanceId,
    frameIndex,
    stackIndex,
    wadoUrl,
    imageId: typeof imageId === 'string' ? imageId : undefined,
  };
};

export const extractInferenceImageRefs = (result?: Record<string, unknown> | null): ImageRef[] | undefined => {
  if (!result) return undefined;
  const raw = (result.image_refs ?? result.imageRefs) as unknown;
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((entry) => (entry && typeof entry === 'object' ? mapInferenceImageRef(entry as Record<string, unknown>) : null))
    .filter((entry): entry is ImageRef => Boolean(entry));
};

const mapJobStatusToAiStatus = (status?: string): AIStatus | null => {
  if (!status) return null;
  if (status === 'queued' || status === 'deferred' || status === 'scheduled') return 'queued';
  if (status === 'started') return 'processing';
  return null;
};

export const pollInferenceResult = async (jobId: string, onStatus?: (status: AIStatus) => void) => {
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
