import { apiClient } from './apiClient';

const IMPRESSION_ENDPOINT =
  import.meta.env.VITE_IMPRESSION_URL ?? '/api/v1/reports/generate-impression';

export interface ImpressionServiceResponse {
  text: string;
  confidence?: number;
  model?: string;
  generated_at?: string;
  generatedAt?: string;
  metadata?: Record<string, unknown>;
}

interface ImpressionPayload {
  reportId?: string;
  findingsText?: string;
}

export const impressionClient = {
  async generateImpression({ reportId, findingsText }: ImpressionPayload): Promise<ImpressionServiceResponse> {
    return apiClient.post<ImpressionServiceResponse>(IMPRESSION_ENDPOINT, {
      report_id: reportId,
      findings_text: findingsText,
    });
  },
};
