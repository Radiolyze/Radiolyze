import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditClient } from "@/services/auditClient";
import {
  enrichEntriesWithStudyDetails,
  mapAuditEventsToEntries,
  type AuditLogEntry,
} from "@/services/auditMapping";
import { useStudyLookup } from "@/hooks/useStudyLookup";
import { logger } from "@/lib/logger";

/** Query key of the audit event list, exported so a write can invalidate it. */
export const AUDIT_EVENTS_QUERY_KEY = ["auditEvents"] as const;

export interface UseAuditLogResult {
  /** Events mapped for display, with study details filled in where known. */
  entries: AuditLogEntry[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * The audit event list behind the history timeline.
 *
 * Events name a study but not the patient on it, so the DICOM study lookup runs
 * on the studies the events reference and its results are merged in — which is
 * why fetching and enrichment live together in one hook rather than in the page.
 */
export function useAuditLog(): UseAuditLogResult {
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: AUDIT_EVENTS_QUERY_KEY,
    queryFn: () => auditClient.listEvents(),
    select: mapAuditEventsToEntries,
  });

  const studyIds = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.studyId).filter(Boolean))) as string[],
    [entries],
  );

  const { studyMap, error: studyLookupError } = useStudyLookup(studyIds);

  useEffect(() => {
    if (studyLookupError) {
      logger.warn(studyLookupError);
    }
  }, [studyLookupError]);

  const displayEntries = useMemo(
    () => enrichEntriesWithStudyDetails(entries, studyMap),
    [entries, studyMap],
  );

  return { entries: displayEntries, isLoading, isError };
}
