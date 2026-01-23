import { apiClient } from './apiClient';

export type ExportFormat = 'coco' | 'huggingface' | 'medgemma';

export interface ExportRequest {
  format: ExportFormat;
  studyIds?: string[];
  categories?: string[];
  verifiedOnly?: boolean;
  includeImages?: boolean;
  splitRatio?: number;
}

export interface ManifestRequest {
  studyIds?: string[];
  categories?: string[];
  verifiedOnly?: boolean;
  splitRatio?: number;
  limit?: number;
  checkImages?: boolean;
}

export interface ManifestEntry {
  id: string;
  image_path: string;
  wado_url: string;
  study_id: string;
  series_id: string;
  instance_id: string;
  frame_index: number;
  frame_number: number;
  splits: string[];
  status?: 'ok' | 'error';
  bytes?: number;
  sha256?: string;
  error?: string;
}

export interface ManifestResponse {
  total: number;
  images: ManifestEntry[];
  status?: { ok: number; error: number };
}

export interface ExportStats {
  totalAnnotations: number;
  verifiedAnnotations: number;
  categories: Record<string, number>;
  studies: number;
  series: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

const BASE_PATH = '/api/v1/training';

export async function getTrainingStats(params?: {
  studyIds?: string[];
  verifiedOnly?: boolean;
}): Promise<ExportStats> {
  const queryParams = new URLSearchParams();
  
  if (params?.studyIds?.length) {
    queryParams.append('studyIds', params.studyIds.join(','));
  }
  if (params?.verifiedOnly) {
    queryParams.append('verifiedOnly', 'true');
  }
  
  const query = queryParams.toString();
  const url = query ? `${BASE_PATH}/stats?${query}` : `${BASE_PATH}/stats`;
  
  return apiClient.get<ExportStats>(url);
}

export async function getAnnotationCategories(): Promise<CategoryCount[]> {
  return apiClient.get<CategoryCount[]>(`${BASE_PATH}/categories`);
}

export async function exportTrainingData(request: ExportRequest): Promise<Blob> {
  const response = await fetch(`${BASE_PATH}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format: request.format,
      studyIds: request.studyIds,
      categories: request.categories,
      verifiedOnly: request.verifiedOnly ?? true,
      includeImages: request.includeImages ?? false,
      splitRatio: request.splitRatio ?? 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }));
    throw new Error(error.detail || 'Export failed');
  }

  return response.blob();
}

export async function getTrainingManifest(request: ManifestRequest): Promise<ManifestResponse> {
  return apiClient.post<ManifestResponse>(`${BASE_PATH}/manifest`, {
    studyIds: request.studyIds,
    categories: request.categories,
    verifiedOnly: request.verifiedOnly ?? true,
    splitRatio: request.splitRatio ?? 0.8,
    limit: request.limit,
    checkImages: request.checkImages,
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAndDownload(request: ExportRequest): Promise<void> {
  const blob = await exportTrainingData(request);
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `medgemma-training-${request.format}-${timestamp}.zip`;
  downloadBlob(blob, filename);
}
