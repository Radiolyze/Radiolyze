import { useCallback, useEffect, useState } from 'react';
import type { ReportResponsePayload } from '@/services/reportClient';
import { reportClient } from '@/services/reportClient';

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
 */
export function usePriorReports(
  patientId: string | undefined,
  currentReportId: string | undefined,
): UsePriorReportsReturn {
  const [priorReports, setPriorReports] = useState<ReportResponsePayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!patientId) return;

    setIsLoading(true);
    setError(null);
    try {
      const reports = await reportClient.getReportsByPatient(patientId);
      // Exclude current report from the list
      const filtered = currentReportId
        ? reports.filter((r) => r.id !== currentReportId)
        : reports;
      setPriorReports(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prior reports');
      setPriorReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, currentReportId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { priorReports, isLoading, error, refresh: fetch };
}
