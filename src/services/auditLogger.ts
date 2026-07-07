import type { AuditEvent } from '@/types/radiology';
import { apiClient } from './apiClient';
import { logger } from '@/lib/logger';

const AUDIT_ENDPOINT = import.meta.env.VITE_AUDIT_LOG_URL ?? '/api/v1/audit-log';

export const auditLogger = {
  async logEvent(event: AuditEvent) {
    const payload = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };

    try {
      await apiClient.post(AUDIT_ENDPOINT, payload);
    } catch (error) {
      // Non-blocking: audit logging must not break workflow
      logger.warn('Audit log failed', error);
    }
  },
};
