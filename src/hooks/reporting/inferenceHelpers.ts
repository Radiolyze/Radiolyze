import type { AIStatus, ImageRef } from '@/types/radiology';
import { inferenceClient } from '@/services/inferenceClient';

type InferenceImageRole = 'current' | 'prior';

interface InferenceImageSelectionOptions {
  includeAllFrames?: boolean;
  role?: InferenceImageRole;
  maxFrames?: number;
}

const readMaxFrames = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const legacyMaxFrames = readMaxFrames(import.meta.env.VITE_INFERENCE_MAX_FRAMES, 16);
const inferenceFrameLimits = {
  current: readMaxFrames(import.meta.env.VITE_INFERENCE_MAX_FRAMES_CURRENT, legacyMaxFrames),
  prior: readMaxFrames(import.meta.env.VITE_INFERENCE_MAX_FRAMES_PRIOR, 8),
};

const getMaxInferenceFrames = (role?: InferenceImageRole) => {
  if (role === 'prior') return inferenceFrameLimits.prior;
  return inferenceFrameLimits.current;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type SeriesGroup = { seriesId: string; refs: ImageRef[]; index: number };

const groupRefsBySeries = (refs: ImageRef[]): SeriesGroup[] => {
  const groups = new Map<string, SeriesGroup>();
  refs.forEach((ref, index) => {
    const existing = groups.get(ref.seriesId);
    if (existing) {
      existing.refs.push(ref);
      return;
    }
    groups.set(ref.seriesId, { seriesId: ref.seriesId, refs: [ref], index });
  });
  return Array.from(groups.values()).sort((a, b) => a.index - b.index);
};

const sampleRefs = (refs: ImageRef[], maxFrames: number) => {
  if (refs.length <= maxFrames) return refs;
  const step = refs.length / maxFrames;
  const selected: ImageRef[] = [];
  for (let index = 0; index < maxFrames; index += 1) {
    const refIndex = Math.min(refs.length - 1, Math.floor(index * step));
    selected.push(refs[refIndex]);
  }
  return selected;
};

const distributeFrameBudget = (groups: SeriesGroup[], totalMax: number) => {
  const totalAvailable = groups.reduce((sum, group) => sum + group.refs.length, 0);
  if (totalMax >= totalAvailable) {
    return new Map(groups.map((group) => [group.seriesId, group.refs.length]));
  }

  if (totalMax < groups.length) {
    const sortedBySize = [...groups].sort((a, b) => {
      if (b.refs.length !== a.refs.length) return b.refs.length - a.refs.length;
      return a.index - b.index;
    });
    const allowed = new Set(sortedBySize.slice(0, totalMax).map((group) => group.seriesId));
    return new Map(groups.map((group) => [group.seriesId, allowed.has(group.seriesId) ? 1 : 0]));
  }

  const allocations = groups.map((group) => {
    const raw = (group.refs.length / totalAvailable) * totalMax;
    const floorValue = Math.floor(raw);
    const base = Math.max(1, Math.min(group.refs.length, floorValue));
    return { group, base, remainder: raw - floorValue };
  });

  let allocated = allocations.reduce((sum, item) => sum + item.base, 0);
  if (allocated > totalMax) {
    let surplus = allocated - totalMax;
    const reducible = allocations
      .filter((item) => item.base > 1)
      .sort((a, b) => a.remainder - b.remainder);
    for (const item of reducible) {
      if (surplus <= 0) break;
      item.base -= 1;
      surplus -= 1;
    }
    allocated = totalMax - surplus;
  }

  if (allocated < totalMax) {
    let remaining = totalMax - allocated;
    const expandable = allocations
      .filter((item) => item.base < item.group.refs.length)
      .sort((a, b) => b.remainder - a.remainder);
    for (const item of expandable) {
      if (remaining <= 0) break;
      item.base += 1;
      remaining -= 1;
    }
  }

  return new Map(allocations.map((item) => [item.group.seriesId, item.base]));
};

export const selectInferenceImageRefs = (
  refs: ImageRef[] | undefined,
  options?: InferenceImageSelectionOptions | boolean
) => {
  if (!refs || refs.length === 0) return [];
  const normalized = typeof options === 'boolean' ? { includeAllFrames: options } : options || {};
  if (normalized.includeAllFrames) return refs;

  const maxFrames = normalized.maxFrames ?? getMaxInferenceFrames(normalized.role);
  if (refs.length <= maxFrames) return refs;

  const groups = groupRefsBySeries(refs);
  if (groups.length <= 1) {
    return sampleRefs(refs, maxFrames);
  }

  const budgets = distributeFrameBudget(groups, maxFrames);
  return groups.flatMap((group) => {
    const budget = budgets.get(group.seriesId) ?? 0;
    if (budget <= 0) return [];
    return sampleRefs(group.refs, budget);
  });
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

export const extractInferenceEvidenceIndices = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  const raw = (result.evidence_indices ?? result.evidenceIndices) as unknown;
  if (!Array.isArray(raw)) return undefined;
  const indices = raw
    .map((entry) => {
      if (typeof entry === 'number' && Number.isInteger(entry)) return entry;
      if (typeof entry === 'string') {
        const parsed = Number(entry);
        return Number.isInteger(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((entry): entry is number => Boolean(entry && entry > 0));
  return indices.length > 0 ? indices : undefined;
};

export const extractInferenceCompletedAt = (result?: Record<string, unknown> | null) => {
  if (!result) return undefined;
  if (typeof result.completed_at === 'string') return result.completed_at;
  if (typeof result.completedAt === 'string') return result.completedAt;
  return undefined;
};

const readNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeNumberArray = (raw: unknown) => {
  if (!Array.isArray(raw)) return undefined;
  const values = raw
    .map(readNumber)
    .filter((entry): entry is number => typeof entry === 'number');
  return values.length > 0 ? values : undefined;
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
  const studyDate = typeof value.study_date === 'string' ? value.study_date : value.studyDate;
  const timeDeltaDays = readNumber(value.time_delta_days ?? value.timeDeltaDays);
  const seriesDescription =
    typeof value.series_description === 'string' ? value.series_description : value.seriesDescription;
  const seriesModality =
    typeof value.series_modality === 'string' ? value.series_modality : value.seriesModality;
  const role = typeof value.role === 'string' ? value.role : undefined;
  const pixelSpacing = normalizeNumberArray(value.pixel_spacing ?? value.pixelSpacing);
  const sliceThickness = readNumber(value.slice_thickness ?? value.sliceThickness);
  const spacingBetweenSlices = readNumber(value.spacing_between_slices ?? value.spacingBetweenSlices);
  const imageOrientation = normalizeNumberArray(value.image_orientation ?? value.imageOrientation);
  const imagePosition = normalizeNumberArray(value.image_position ?? value.imagePosition);
  const instanceNumber = readNumber(value.instance_number ?? value.instanceNumber);
  return {
    studyId,
    seriesId,
    instanceId,
    frameIndex,
    stackIndex,
    wadoUrl,
    imageId: typeof imageId === 'string' ? imageId : undefined,
    studyDate: typeof studyDate === 'string' ? studyDate : undefined,
    timeDeltaDays: typeof timeDeltaDays === 'number' ? timeDeltaDays : undefined,
    seriesDescription: typeof seriesDescription === 'string' ? seriesDescription : undefined,
    seriesModality: typeof seriesModality === 'string' ? seriesModality : undefined,
    role: role === 'current' || role === 'prior' ? role : undefined,
    pixelSpacing,
    sliceThickness,
    spacingBetweenSlices,
    imageOrientation,
    imagePosition,
    instanceNumber: typeof instanceNumber === 'number' ? instanceNumber : undefined,
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

export const extractInferenceMetadata = (
  result?: Record<string, unknown> | null
): Record<string, unknown> | undefined => {
  if (!result) return undefined;
  const raw = (result.metadata ?? result.meta) as unknown;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as Record<string, unknown>;
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
