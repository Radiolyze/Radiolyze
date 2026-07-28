import { useCallback, useMemo, useState } from "react";
import type { BatchReport } from "@/hooks/useBatchReports";

export function useBatchSelection(filteredReports: BatchReport[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map((r) => r.id)));
    }
  }, [filteredReports, selectedIds.size]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isAllSelected = filteredReports.length > 0 && selectedIds.size === filteredReports.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredReports.length;

  const approvableSelected = useMemo(() => {
    return filteredReports.filter(
      (r) => selectedIds.has(r.id) && r.status === "draft" && r.qaStatus === "pass",
    ).length;
  }, [filteredReports, selectedIds]);

  return {
    selectedIds,
    setSelectedIds,
    handleSelectAll,
    handleSelectOne,
    isAllSelected,
    isSomeSelected,
    approvableSelected,
  };
}
