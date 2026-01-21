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
  async listEvents(params: ListAuditEventsParams = {}) {
    return apiClient.get<AuditEventResponse[]>(AUDIT_ENDPOINT, {
      query: {
        study_id: params.studyId,
        report_id: params.reportId,
        limit: params.limit,
        offset: params.offset,
      },
    });
  },
};
