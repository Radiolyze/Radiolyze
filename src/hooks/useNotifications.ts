import { useCallback, useEffect, useMemo, useState } from 'react';
import { auditClient, type AuditEventResponse } from '@/services/auditClient';
import { useStudyLookup } from '@/hooks/useStudyLookup';

export type NotificationType = 'report' | 'urgent' | 'system' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface UseNotificationsOptions {
  limit?: number;
}

const DEFAULT_LIMIT = 20;
const STORAGE_READ_KEY = 'medgemma.notifications.read';
const STORAGE_DISMISS_KEY = 'medgemma.notifications.dismissed';

const loadIdSet = (key: string): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string'));
  } catch {
    return new Set();
  }
};

const saveIdSet = (key: string, value: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
  } catch {
    // Ignore persistence errors.
  }
};

const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE');
};

const eventTitleMap: Record<string, string> = {
  report_created: 'Neuer Report',
  report_opened: 'Report geöffnet',
  findings_saved: 'Befund gespeichert',
  impression_generated: 'KI-Beurteilung generiert',
  asr_transcription: 'Diktat transkribiert',
  qa_check_run: 'QA-Prüfung',
  report_approved: 'Report freigegeben',
  report_amended: 'Report korrigiert',
  report_exported: 'Report exportiert',
  inference_queued: 'KI-Analyse gestartet',
  inference_started: 'KI-Analyse läuft',
  inference_completed: 'KI-Analyse abgeschlossen',
  inference_failed: 'KI-Analyse fehlgeschlagen',
};

const resolveNotificationType = (event: AuditEventResponse): NotificationType => {
  const metadata = event.metadata ?? {};
  if (event.event_type === 'qa_check_run') {
    const status = metadata.status;
    if (status === 'fail' || status === 'warn') return 'urgent';
    if (status === 'pass') return 'success';
  }
  if (event.event_type === 'report_approved' || event.event_type === 'report_exported') return 'success';
  if (event.event_type === 'inference_failed') return 'urgent';
  if (
    event.event_type === 'report_created' ||
    event.event_type === 'impression_generated' ||
    event.event_type === 'asr_transcription' ||
    event.event_type === 'findings_saved' ||
    event.event_type === 'report_amended'
  ) {
    return 'report';
  }
  return 'system';
};

const getMetadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

const buildMessage = (event: AuditEventResponse, studyInfo?: { patientName: string; accessionNumber: string; studyDescription: string }) => {
  const metadata = event.metadata ?? {};
  const studyDescription =
    getMetadataString(metadata, 'study_description') || studyInfo?.studyDescription || '';
  const patientName = getMetadataString(metadata, 'patient_name') || studyInfo?.patientName || '';
  const accessionNumber =
    getMetadataString(metadata, 'accession_number') || studyInfo?.accessionNumber || '';

  const parts = [studyDescription, patientName].filter(Boolean);
  let message = parts.join(' • ');
  if (accessionNumber) {
    message = message ? `${message} (${accessionNumber})` : accessionNumber;
  }

  if (!message) {
    if (event.report_id) return `Report ${event.report_id.slice(0, 8)}...`;
    if (event.study_id) return `Studie ${event.study_id.slice(0, 8)}...`;
    return 'Neues Ereignis';
  }

  return message;
};

export function useNotifications(options: UseNotificationsOptions = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const [events, setEvents] = useState<AuditEventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIdSet(STORAGE_READ_KEY));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadIdSet(STORAGE_DISMISS_KEY));

  const studyIds = useMemo(
    () => Array.from(new Set(events.map((event) => event.study_id).filter(Boolean))) as string[],
    [events]
  );
  const { studyMap } = useStudyLookup(studyIds);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await auditClient.listEvents({ limit });
      setEvents(response);
    } catch (error) {
      console.warn('Failed to load notifications', error);
      setErrorMessage('Benachrichtigungen konnten nicht geladen werden.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    saveIdSet(STORAGE_READ_KEY, readIds);
  }, [readIds]);

  useEffect(() => {
    saveIdSet(STORAGE_DISMISS_KEY, dismissedIds);
  }, [dismissedIds]);

  const notifications = useMemo(() => {
    return events
      .filter((event) => !dismissedIds.has(event.id))
      .map((event) => {
        const studyInfo = event.study_id ? studyMap[event.study_id] : undefined;
        return {
          id: event.id,
          type: resolveNotificationType(event),
          title: eventTitleMap[event.event_type] ?? 'System-Meldung',
          message: buildMessage(event, studyInfo),
          time: formatRelativeTime(event.timestamp),
          read: readIds.has(event.id),
        } satisfies Notification;
      });
  }, [events, dismissedIds, readIds, studyMap]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds(new Set(notifications.map((item) => item.id)));
  }, [notifications]);

  const clearAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((item) => next.add(item.id));
      return next;
    });
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    errorMessage,
    refresh,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
