import { apiClient } from './apiClient';
import type { ImageRef } from '@/types/radiology';

const INFERENCE_QUEUE_ENDPOINT =
  import.meta.env.VITE_INFERENCE_QUEUE_URL ?? '/api/v1/inference/queue';
const INFERENCE_LOCALIZE_ENDPOINT =
  import.meta.env.VITE_INFERENCE_LOCALIZE_URL ?? '/api/v1/inference/localize';
const INFERENCE_VOLUME_ENDPOINT =
  import.meta.env.VITE_INFERENCE_VOLUME_URL ?? '/api/v1/inference/volume';
const INFERENCE_COMPARISON_ENDPOINT =
  import.meta.env.VITE_INFERENCE_COMPARISON_URL ?? '/api/v1/inference/comparison';
const INFERENCE_STATUS_ENDPOINT =
  import.meta.env.VITE_INFERENCE_STATUS_URL ?? '/api/v1/inference/status';

export interface InferenceQueuePayload {
  reportId?: string;
  studyId?: string;
  findingsText?: string;
  imageUrls?: string[];
  imageRefs?: ImageRef[];
  requestedBy?: string;
  modelVersion?: string;
}

export interface LocalizePayload {
  reportId?: string;
  studyId?: string;
  imageRef: ImageRef;
  requestedBy?: string;
  modelVersion?: string;
  mode?: 'cxr_finding' | 'cxr_anatomy';
}

export type VolumeWindowPreset = 'auto' | 'lung' | 'mediastinum' | 'bone' | 'abdomen' | 'mr';
export type VolumeStrategy = 'uniform' | 'central';

export interface VolumeInferencePayload {
  reportId?: string;
  studyId?: string;
  studyUid: string;
  seriesUid: string;
  findingsText?: string;
  maxSlices?: number;
  windowPreset?: VolumeWindowPreset;
  strategy?: VolumeStrategy;
  requestedBy?: string;
  modelVersion?: string;
}

export interface ComparisonPayload {
  reportId?: string;
  studyId?: string;
  studyUid: string;
  seriesUid: string;
  priorStudyUid: string;
  priorSeriesUid: string;
  timeDeltaDays?: number;
  findingsText?: string;
  modality?: string;
  maxSlices?: number;
  windowPreset?: VolumeWindowPreset;
  requestedBy?: string;
  modelVersion?: string;
}

export interface InferenceQueueResponse {
  job_id?: string;
  jobId?: string;
  status?: string;
  queued_at?: string;
  queuedAt?: string;
  report_id?: string;
  reportId?: string;
  study_id?: string;
  studyId?: string;
  model_version?: string;
  modelVersion?: string;
}

const mapImageRefsToPayload = (refs: ImageRef[] | undefined) => {
  if (!refs || refs.length === 0) {
    return undefined;
  }
  return refs.map((ref) => ({
    study_id: ref.studyId,
    series_id: ref.seriesId,
    instance_id: ref.instanceId,
    frame_index: ref.frameIndex,
    stack_index: ref.stackIndex,
    wado_url: ref.wadoUrl,
    image_id: ref.imageId,
    study_date: ref.studyDate,
    time_delta_days: ref.timeDeltaDays,
    series_description: ref.seriesDescription,
    series_modality: ref.seriesModality,
    role: ref.role,
    pixel_spacing: ref.pixelSpacing,
    slice_thickness: ref.sliceThickness,
    spacing_between_slices: ref.spacingBetweenSlices,
    image_orientation: ref.imageOrientation,
    image_position: ref.imagePosition,
    instance_number: ref.instanceNumber,
  }));
};

export interface InferenceStatusResponse {
  job_id?: string;
  jobId?: string;
  status?: string;
  queued_at?: string;
  queuedAt?: string;
  started_at?: string;
  startedAt?: string;
  ended_at?: string;
  endedAt?: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export const inferenceClient = {
  async queueInference(payload: InferenceQueuePayload): Promise<InferenceQueueResponse> {
    return apiClient.post<InferenceQueueResponse>(INFERENCE_QUEUE_ENDPOINT, {
      report_id: payload.reportId,
      study_id: payload.studyId,
      findings_text: payload.findingsText,
      image_urls: payload.imageUrls,
      image_refs: mapImageRefsToPayload(payload.imageRefs),
      requested_by: payload.requestedBy,
      model_version: payload.modelVersion,
    });
  },
  async queueLocalize(payload: LocalizePayload): Promise<InferenceQueueResponse> {
    const refs = mapImageRefsToPayload([payload.imageRef]);
    const imageRef = refs?.[0] ?? {
      study_id: payload.imageRef.studyId,
      series_id: payload.imageRef.seriesId,
      instance_id: payload.imageRef.instanceId,
      frame_index: payload.imageRef.frameIndex,
      stack_index: payload.imageRef.stackIndex,
      wado_url: payload.imageRef.wadoUrl,
    };
    return apiClient.post<InferenceQueueResponse>(INFERENCE_LOCALIZE_ENDPOINT, {
      report_id: payload.reportId,
      study_id: payload.studyId,
      image_ref: imageRef,
      mode: payload.mode,
      requested_by: payload.requestedBy,
      model_version: payload.modelVersion,
    });
  },
  async queueVolumeInference(payload: VolumeInferencePayload): Promise<InferenceQueueResponse> {
    return apiClient.post<InferenceQueueResponse>(INFERENCE_VOLUME_ENDPOINT, {
      report_id: payload.reportId,
      study_id: payload.studyId,
      study_uid: payload.studyUid,
      series_uid: payload.seriesUid,
      findings_text: payload.findingsText,
      max_slices: payload.maxSlices,
      window_preset: payload.windowPreset,
      strategy: payload.strategy,
      requested_by: payload.requestedBy,
      model_version: payload.modelVersion,
    });
  },
  async queueComparison(payload: ComparisonPayload): Promise<InferenceQueueResponse> {
    return apiClient.post<InferenceQueueResponse>(INFERENCE_COMPARISON_ENDPOINT, {
      report_id: payload.reportId,
      study_id: payload.studyId,
      study_uid: payload.studyUid,
      series_uid: payload.seriesUid,
      prior_study_uid: payload.priorStudyUid,
      prior_series_uid: payload.priorSeriesUid,
      time_delta_days: payload.timeDeltaDays,
      findings_text: payload.findingsText,
      modality: payload.modality,
      max_slices: payload.maxSlices,
      window_preset: payload.windowPreset,
      requested_by: payload.requestedBy,
      model_version: payload.modelVersion,
    });
  },
  async getStatus(jobId: string): Promise<InferenceStatusResponse> {
    return apiClient.get<InferenceStatusResponse>(`${INFERENCE_STATUS_ENDPOINT}/${jobId}`);
  },
};
