import { apiClient } from './apiClient';
import type { ImageRef } from '@/types/radiology';

const INFERENCE_QUEUE_ENDPOINT =
  import.meta.env.VITE_INFERENCE_QUEUE_URL ?? '/api/v1/inference/queue';
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
  async getStatus(jobId: string): Promise<InferenceStatusResponse> {
    return apiClient.get<InferenceStatusResponse>(`${INFERENCE_STATUS_ENDPOINT}/${jobId}`);
  },
};
