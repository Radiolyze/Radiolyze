import { useCallback } from "react";
import type { Report } from "@/types/radiology";
import { reportClient } from "@/services/reportClient";
import { mapReportResponse } from "@/services/reportMapping";

interface UseReportMutationsParams {
  report: Report | null;
  setReport: React.Dispatch<React.SetStateAction<Report | null>>;
  setIsLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
}

export interface UseReportMutationsReturn {
  updateFindings: (text: string) => Promise<void>;
  updateImpression: (text: string) => Promise<void>;
  approveReport: (signature: string) => Promise<void>;
}

/**
 * The persisted edits on a report: findings, impression, approval.
 *
 * Each one round-trips through `reportClient` and replaces local state with
 * the server's answer. A report with no `id` has not been created yet, so the
 * text edits fall back to updating in memory — that is what keeps the editor
 * usable before the first save.
 */
export function useReportMutations({
  report,
  setReport,
  setIsLoading,
  setError,
}: UseReportMutationsParams): UseReportMutationsReturn {
  const reportId = report?.id;

  /**
   * Run a `reportClient` call and adopt its response as the new report.
   *
   * Errors are surfaced twice on purpose: stored for the UI to render, and
   * rethrown so the caller can react (a failed approval must not look like a
   * successful one).
   */
  const applyServerUpdate = useCallback(
    async (request: () => Promise<Parameters<typeof mapReportResponse>[0]>, failure: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await request();
        setReport((prev) =>
          prev ? mapReportResponse(response, prev) : mapReportResponse(response),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : failure);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setError, setIsLoading, setReport],
  );

  const updateFindings = useCallback(
    async (text: string) => {
      if (!reportId) {
        setReport((prev) =>
          prev
            ? { ...prev, findingsText: text, updatedAt: new Date().toISOString(), status: "draft" }
            : null,
        );
        return;
      }
      await applyServerUpdate(
        () => reportClient.updateReport(reportId, { findingsText: text }),
        "Failed to update findings",
      );
    },
    [applyServerUpdate, reportId, setReport],
  );

  const updateImpression = useCallback(
    async (text: string) => {
      if (!reportId) {
        setReport((prev) =>
          prev ? { ...prev, impressionText: text, updatedAt: new Date().toISOString() } : null,
        );
        return;
      }
      await applyServerUpdate(
        () => reportClient.updateReport(reportId, { impressionText: text }),
        "Failed to update impression",
      );
    },
    [applyServerUpdate, reportId, setReport],
  );

  const approveReport = useCallback(
    async (signature: string) => {
      // Approval is only meaningful for a persisted report; there is no
      // in-memory equivalent to a signature.
      if (!reportId) return;
      await applyServerUpdate(
        () => reportClient.finalizeReport(reportId, signature),
        "Failed to approve report",
      );
    },
    [applyServerUpdate, reportId],
  );

  return { updateFindings, updateImpression, approveReport };
}
