import { useMemo, useState } from "react";
import type { BatchReport } from "@/hooks/useBatchReports";

export interface BatchStats {
  total: number;
  pending: number;
  drafts: number;
  approved: number;
  avgTurnaround: number;
  qaWarnings: number;
}

export function useBatchFilters(reports: BatchReport[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalityFilter, setModalityFilter] = useState<string>("all");

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          report.patientName.toLowerCase().includes(query) ||
          report.accessionNumber.toLowerCase().includes(query) ||
          report.mrn.toLowerCase().includes(query);
        if (!matches) return false;
      }

      if (statusFilter !== "all" && report.status !== statusFilter) {
        return false;
      }

      if (modalityFilter !== "all" && report.modality !== modalityFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, statusFilter, modalityFilter, reports]);

  const stats: BatchStats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === "pending").length;
    const drafts = reports.filter((r) => r.status === "draft").length;
    const approved = reports.filter(
      (r) => r.status === "approved" || r.status === "finalized",
    ).length;
    const withTurnaround = reports.filter((r) => r.turnaroundMinutes !== undefined);
    const avgTurnaround =
      withTurnaround.reduce((acc, r) => acc + (r.turnaroundMinutes || 0), 0) /
      (withTurnaround.length || 1);
    const qaWarnings = reports.filter((r) => r.qaStatus === "warn" || r.qaStatus === "fail").length;

    return {
      total,
      pending,
      drafts,
      approved,
      avgTurnaround: Math.round(avgTurnaround),
      qaWarnings,
    };
  }, [reports]);

  const modalities = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.modality)));
  }, [reports]);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    modalityFilter,
    setModalityFilter,
    filteredReports,
    stats,
    modalities,
  };
}
