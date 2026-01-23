import { apiClient } from './apiClient';
import type {
  TrainingAnnotation,
  AnnotationCreateRequest,
  AnnotationUpdateRequest,
  AnnotationVerifyRequest,
  AnnotationListParams,
} from '@/types/annotations';

const BASE_PATH = '/api/v1/annotations';

export async function createAnnotation(
  payload: AnnotationCreateRequest
): Promise<TrainingAnnotation> {
  return apiClient.post<TrainingAnnotation>(BASE_PATH, payload);
}

export async function getAnnotation(annotationId: string): Promise<TrainingAnnotation> {
  return apiClient.get<TrainingAnnotation>(`${BASE_PATH}/${annotationId}`);
}

export async function listAnnotations(
  params: AnnotationListParams = {}
): Promise<TrainingAnnotation[]> {
  const queryParams = new URLSearchParams();
  
  if (params.studyId) queryParams.append('study_id', params.studyId);
  if (params.seriesId) queryParams.append('series_id', params.seriesId);
  if (params.category) queryParams.append('category', params.category);
  if (params.verifiedOnly) queryParams.append('verified_only', 'true');
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  
  const query = queryParams.toString();
  const url = query ? `${BASE_PATH}?${query}` : BASE_PATH;
  
  return apiClient.get<TrainingAnnotation[]>(url);
}

export async function updateAnnotation(
  annotationId: string,
  payload: AnnotationUpdateRequest
): Promise<TrainingAnnotation> {
  return apiClient.patch<TrainingAnnotation>(
    `${BASE_PATH}/${annotationId}`,
    payload
  );
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/${annotationId}`);
}

export async function verifyAnnotation(
  annotationId: string,
  payload: AnnotationVerifyRequest
): Promise<TrainingAnnotation> {
  return apiClient.post<TrainingAnnotation>(
    `${BASE_PATH}/${annotationId}/verify`,
    payload
  );
}

export async function listAnnotationsForSeries(
  studyId: string,
  seriesId: string
): Promise<TrainingAnnotation[]> {
  return listAnnotations({ studyId, seriesId });
}

export async function countAnnotations(
  params: AnnotationListParams = {}
): Promise<number> {
  const annotations = await listAnnotations(params);
  return annotations.length;
}
