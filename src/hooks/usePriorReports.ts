import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReportResponsePayload } from "@/services/reportClient";
import { reportClient } from "@/services/reportClient";

export const priorReportsQueryKey = (patientId: string | undefined) =>
  ["priorReports", patientId] as const;

interface UsePriorReportsReturn {
  priorReports: ReportResponsePayload[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches prior reports for a patient, excluding the current report.
 *
 * Used to enable report comparison / diff views between the current
 * and previous reports for the same patient.
 *
 * Keyed on the patient rather than on the report, so the exclusion of the
 * current report is a filter over cached data: opening a second report for
 * the same patient reuses the fetch the first one made.
 */
export function usePriorReports(
  patientId: string | undefined,
  currentReportId: string | undefined,
): UsePriorReportsReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: priorReportsQueryKey(patientId),
    queryFn: () => reportClient.getReportsByPatient(patientId as string),
    enabled: Boolean(patientId),
  });

  const priorReports = useMemo(() => {
    const reports = data ?? [];
    return currentReportId ? reports.filter((report) => report.id !== currentReportId) : reports;
  }, [data, currentReportId]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    priorReports,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load prior reports") : null,
    refresh,
  };
}
