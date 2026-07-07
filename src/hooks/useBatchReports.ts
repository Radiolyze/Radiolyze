import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { reportClient, type ReportResponsePayload } from "@/services/reportClient";
import { mapReportResponse } from "@/services/reportMapping";
import { useStudyLookup } from "@/hooks/useStudyLookup";
import { useWebSocket, type ReportStatusEvent } from "@/hooks/useWebSocket";
import type { ReportStatus, QAStatus } from "@/types/radiology";

export interface BatchReport {
  id: string;
  patientName: string;
  mrn: string;
  accessionNumber: string;
  modality: string;
  studyDescription: string;
  studyDate: string;
  status: ReportStatus;
  qaStatus: QAStatus;
  assignedTo: string;
  priority: "normal" | "urgent" | "stat";
  createdAt: string;
  turnaroundMinutes?: number;
}

const resolveTurnaroundMinutes = (createdAt: string, updatedAt: string) => {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return undefined;
  const diffMinutes = Math.round((updated - created) / 60000);
  return diffMinutes > 0 ? diffMinutes : undefined;
};

export function useBatchReports() {
  const { t } = useTranslation("batch");
  const { t: tCommon } = useTranslation("common");
  const { t: tReport } = useTranslation("report");

  const [reports, setReports] = useState<BatchReport[]>([]);

  const {
    data: reportPayloads = [],
    isLoading,
    isError: hasReportsError,
  } = useQuery<ReportResponsePayload[]>({
    queryKey: ["batchReports"],
    queryFn: () => reportClient.listReports({ limit: 200 }),
  });
  const errorMessage = hasReportsError ? t("table.loading") : null;

  const studyIds = useMemo(
    () => Array.from(new Set(reportPayloads.map((report) => report.study_id).filter(Boolean))),
    [reportPayloads],
  );
  const { studyMap, error: studyLookupError } = useStudyLookup(studyIds);

  useEffect(() => {
    if (studyLookupError) {
      toast.error(studyLookupError);
    }
  }, [studyLookupError]);

  const mappedReports = useMemo(() => {
    const safePayloads = Array.isArray(reportPayloads) ? reportPayloads : [];
    return safePayloads.map((payload) => {
      const report = mapReportResponse(payload);
      const study = studyMap[report.studyId];
      const fallbackAccession = report.studyId ? report.studyId.slice(0, 8) : "—";

      return {
        id: report.id,
        patientName: study?.patientName ?? `Report ${report.id.slice(0, 8)}...`,
        mrn: study?.mrn ?? report.patientId,
        accessionNumber: study?.accessionNumber ?? fallbackAccession,
        modality: study?.modality ?? "CT",
        studyDescription: study?.studyDescription ?? tCommon("study.study"),
        studyDate: study?.studyDate ?? report.createdAt.slice(0, 10),
        status: report.status,
        qaStatus: report.qaStatus,
        assignedTo: report.approvedBy ?? "-",
        priority: "normal" as const,
        createdAt: report.createdAt,
        turnaroundMinutes: resolveTurnaroundMinutes(report.createdAt, report.updatedAt),
      };
    });
  }, [reportPayloads, studyMap, tCommon]);

  useEffect(() => {
    if (mappedReports.length === 0) {
      if (!isLoading) {
        setReports([]);
      }
      return;
    }

    setReports((prev) => {
      if (prev.length === 0) return mappedReports;
      const prevMap = new Map(prev.map((report) => [report.id, report]));
      return mappedReports.map((report) => {
        const existing = prevMap.get(report.id);
        if (!existing) return report;
        return {
          ...report,
          qaStatus: existing.qaStatus ?? report.qaStatus,
        };
      });
    });
  }, [mappedReports, isLoading]);

  const handleReportStatus = useCallback(
    (event: ReportStatusEvent) => {
      const { reportId, payload } = event;

      setReports((prev) =>
        prev.map((report) => {
          if (report.id !== reportId) return report;
          return {
            ...report,
            qaStatus: payload.qaStatus || report.qaStatus,
          };
        }),
      );

      if (payload.qaStatus === "fail") {
        toast.error(`Report ${reportId.slice(0, 8)}... ${tReport("qa.failed")}`);
      } else if (payload.qaStatus === "pass") {
        toast.success(`Report ${reportId.slice(0, 8)}... ${tReport("qa.passed")}`);
      }
    },
    [tReport],
  );

  const { isConnected: wsConnected } = useWebSocket({
    onReportStatus: handleReportStatus,
  });

  return { reports, setReports, isLoading, errorMessage, wsConnected };
}
