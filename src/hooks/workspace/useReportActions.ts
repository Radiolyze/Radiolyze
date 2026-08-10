import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Report } from "@/types/radiology";
import { auditLogger } from "@/services/auditLogger";
import { reportClient } from "@/services/reportClient";
import { logger } from "@/lib/logger";

interface UseReportActionsOptions {
  report: Report | null;
  /** Draft findings text, which is what a save writes back. */
  findings: string;
  approveReport: (signature: string) => Promise<void>;
  updateFindings: (text: string) => Promise<void>;
}

export interface UseReportActionsResult {
  approve: (signature?: string) => Promise<void>;
  saveFindings: () => Promise<void>;
  exportStructuredReport: (format: "json" | "dicom") => Promise<void>;
}

/**
 * What a radiologist does to the open report: save it, sign it off, export it.
 *
 * Opening one is audited from here too, because the audit trail treats a read
 * as an event in its own right — a report that was looked at and left alone
 * still has to be accounted for.
 */
export function useReportActions({
  report,
  findings,
  approveReport,
  updateFindings,
}: UseReportActionsOptions): UseReportActionsResult {
  const reportId = report?.id;
  const studyId = report?.studyId;

  useEffect(() => {
    if (!reportId) return;
    auditLogger.logEvent({
      eventType: "report_opened",
      reportId,
      studyId,
    });
  }, [reportId, studyId]);

  const approve = useCallback(
    async (signature?: string) => {
      const name = signature?.trim();
      if (!name) {
        toast.error("Bitte Name/Unterschrift eingeben");
        return;
      }

      try {
        await approveReport(name);
        toast.success(`Report freigegeben (${name})`);
      } catch (error) {
        logger.warn("Report finalize failed", error);
        toast.error("Report-Freigabe fehlgeschlagen");
      }
    },
    [approveReport],
  );

  const saveFindings = useCallback(async () => {
    if (!reportId) {
      return;
    }
    try {
      await updateFindings(findings);
      toast.success("Befund gespeichert");
    } catch (error) {
      logger.warn("Findings update failed", error);
      toast.error("Befund speichern fehlgeschlagen");
    }
  }, [findings, reportId, updateFindings]);

  const exportStructuredReport = useCallback(
    async (format: "json" | "dicom") => {
      if (!reportId) {
        return;
      }

      let blobUrl: string | null = null;
      try {
        const result = await reportClient.exportStructuredReport(reportId, format);
        blobUrl = URL.createObjectURL(result.blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = result.fileName;
        link.click();
        toast.success(`DICOM SR exportiert (${format.toUpperCase()})`);
      } catch (error) {
        logger.warn("DICOM SR export failed", error);
        toast.error("DICOM SR Export fehlgeschlagen");
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    },
    [reportId],
  );

  return { approve, saveFindings, exportStructuredReport };
}
