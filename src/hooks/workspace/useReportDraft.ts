import { useCallback, useEffect, useState } from "react";
import type { Report } from "@/types/radiology";

export interface UseReportDraftResult {
  findings: string;
  setFindings: React.Dispatch<React.SetStateAction<string>>;
  impression: string;
  setImpression: React.Dispatch<React.SetStateAction<string>>;
  /** Seed both fields from a report, used when the workspace switches reports. */
  loadFromReport: (report: Report) => void;
}

/**
 * The editable findings and impression text.
 *
 * The text is held here rather than read straight off the report because the
 * user types into it between saves: the report holds what the backend has, this
 * holds what is on screen. The two are re-synced whenever the report's own text
 * changes underneath — an approval, a finished inference job, or a WebSocket
 * update — so an external write is not left invisible behind stale local state.
 */
export function useReportDraft(report: Report | null): UseReportDraftResult {
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");

  useEffect(() => {
    if (!report) return;
    setFindings((prev) => (prev !== report.findingsText ? report.findingsText : prev));
    setImpression((prev) => (prev !== report.impressionText ? report.impressionText : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally watching only specific fields, not whole report object
  }, [report?.findingsText, report?.impressionText]);

  const loadFromReport = useCallback((next: Report) => {
    setFindings(next.findingsText);
    setImpression(next.impressionText);
  }, []);

  return { findings, setFindings, impression, setImpression, loadFromReport };
}
