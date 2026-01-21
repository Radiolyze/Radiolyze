import { apiClient } from './apiClient';

const AUDIT_ENDPOINT = import.meta.env.VITE_AUDIT_LOG_URL ?? '/api/v1/audit-log';

export interface AuditEventResponse {
  id: string;
  event_type: string;
  actor_id?: string | null;
  report_id?: string | null;
  study_id?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}

interface ListAuditEventsParams {
  studyId?: string;
  reportId?: string;
  limit?: number;
  offset?: number;
}

export const auditClient = {
  async listEvents(params: ListAuditEventsParams = {}): Promise<AuditEventResponse[]> {
    try {
      const response = await apiClient.get<AuditEventResponse[] | unknown>(AUDIT_ENDPOINT, {
        query: {
          study_id: params.studyId,
          report_id: params.reportId,
          limit: params.limit,
          offset: params.offset,
        },
      });
      // Guard against non-array responses (e.g., HTML fallback from dev server)
      return Array.isArray(response) ? response : [];
    } catch {
      return [];
    }
  },
};
