import { apiClient } from './apiClient';

const INFERENCE_QUEUE_ENDPOINT =
  import.meta.env.VITE_INFERENCE_QUEUE_URL ?? '/api/v1/inference/queue';
const INFERENCE_STATUS_ENDPOINT =
  import.meta.env.VITE_INFERENCE_STATUS_URL ?? '/api/v1/inference/status';

export interface InferenceQueuePayload {
  reportId?: string;
  studyId?: string;
  findingsText?: string;
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
      requested_by: payload.requestedBy,
      model_version: payload.modelVersion,
    });
  },
  async getStatus(jobId: string): Promise<InferenceStatusResponse> {
    return apiClient.get<InferenceStatusResponse>(`${INFERENCE_STATUS_ENDPOINT}/${jobId}`);
  },
};
