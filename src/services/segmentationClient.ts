import { apiClient } from './apiClient';
import type {
  PushToPacsResponse,
  SegmentationCreateInput,
  SegmentationJobResponse,
  SegmentationPreset,
} from '@/types/segmentation';

const SEGMENTATION_BASE =
  import.meta.env.VITE_SEGMENTATION_API_URL ?? '/api/v1/segmentation';

interface CreatePayload {
  study_uid: string;
  series_uid: string;
  preset: SegmentationPreset;
  requested_by?: string;
}

interface CreateResponse {
  job_id: string;
  status: SegmentationJobResponse['status'];
  queued_at: string;
  study_uid: string;
  series_uid: string;
  preset: SegmentationPreset;
}

const meshUrl = (
  jobId: string,
  labelId: number,
  format: 'glb' | 'vtp' = 'glb',
): string => `${SEGMENTATION_BASE}/jobs/${jobId}/mesh/${labelId}?format=${format}`;

export const segmentationClient = {
  async createJob(input: SegmentationCreateInput): Promise<CreateResponse> {
    const payload: CreatePayload = {
      study_uid: input.studyUid,
      series_uid: input.seriesUid,
      preset: input.preset,
      requested_by: input.requestedBy,
    };
    return apiClient.post<CreateResponse>(`${SEGMENTATION_BASE}/jobs`, payload);
  },
  async getStatus(jobId: string): Promise<SegmentationJobResponse> {
    return apiClient.get<SegmentationJobResponse>(
      `${SEGMENTATION_BASE}/jobs/${jobId}`,
    );
  },
  meshUrl,
  async fetchMesh(
    jobId: string,
    labelId: number,
    format: 'glb' | 'vtp' = 'vtp',
  ): Promise<ArrayBuffer> {
    const authToken = localStorage.getItem('radiolyze-auth-token');
    const response = await fetch(meshUrl(jobId, labelId, format), {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch mesh ${labelId} (${response.status})`);
    }
    return response.arrayBuffer();
  },
  async pushToPacs(jobId: string): Promise<PushToPacsResponse> {
    return apiClient.post<PushToPacsResponse>(
      `${SEGMENTATION_BASE}/jobs/${jobId}/push-to-pacs`,
    );
  },
};
