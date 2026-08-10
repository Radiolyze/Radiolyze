import { useMemo, useState } from "react";
import { isOnSameDay, type AuditLogEntry } from "@/services/auditMapping";

export interface HistoryStats {
  /** Events recorded today. */
  today: number;
  approved: number;
  impressions: number;
}

/**
 * Search, event-type and actor filters over the audit timeline.
 *
 * Stats are counted over the unfiltered list on purpose: they describe the day's
 * activity, not the current view.
 */
export function useHistoryFilters(entries: AuditLogEntry[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");

  const actors = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.actorName).filter(Boolean))),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return entries.filter((entry) => {
      if (query) {
        const fields = [
          entry.patientName,
          entry.accessionNumber,
          entry.reportId ?? "",
          entry.studyId ?? "",
          entry.actorName,
          entry.actorId ?? "",
        ];
        if (!fields.some((value) => value.toLowerCase().includes(query))) return false;
      }

      if (eventFilter !== "all" && entry.eventType !== eventFilter) return false;
      if (actorFilter !== "all" && entry.actorName !== actorFilter) return false;

      return true;
    });
  }, [entries, searchQuery, eventFilter, actorFilter]);

  const stats: HistoryStats = useMemo(
    () => ({
      today: entries.filter((entry) => isOnSameDay(entry.timestamp)).length,
      approved: entries.filter((entry) => entry.eventType === "report_approved").length,
      impressions: entries.filter((entry) => entry.eventType === "impression_generated").length,
    }),
    [entries],
  );

  return {
    searchQuery,
    setSearchQuery,
    eventFilter,
    setEventFilter,
    actorFilter,
    setActorFilter,
    actors,
    filteredEntries,
    stats,
  };
}
