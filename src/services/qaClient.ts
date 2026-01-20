import type { QACheck } from '@/types/radiology';
import { apiClient } from './apiClient';

const QA_ENDPOINT = import.meta.env.VITE_QA_CHECK_URL ?? '/api/v1/reports/qa-check';

export interface QAServiceResponse {
  passes?: boolean;
  failures?: string[];
  warnings?: string[];
  quality_score?: number;
  checks?: QACheck[];
}

interface RunChecksPayload {
  reportId?: string;
  findingsText?: string;
  impressionText?: string;
}

export const qaClient = {
  async runChecks({ reportId, findingsText, impressionText }: RunChecksPayload): Promise<QAServiceResponse> {
    return apiClient.post<QAServiceResponse>(QA_ENDPOINT, {
      report_id: reportId,
      findings_text: findingsText,
      impression_text: impressionText,
    });
  },
};
