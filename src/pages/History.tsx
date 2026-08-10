import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useHistoryFilters } from "@/hooks/useHistoryFilters";
import { HistoryStatsGrid } from "@/components/History/HistoryStatsGrid";
import { HistoryFilterBar } from "@/components/History/HistoryFilterBar";
import { HistoryTimeline } from "@/components/History/HistoryTimeline";

export default function History() {
  const { t } = useTranslation("common");

  const { entries, isLoading, isError } = useAuditLog();

  const {
    searchQuery,
    setSearchQuery,
    eventFilter,
    setEventFilter,
    actorFilter,
    setActorFilter,
    actors,
    filteredEntries,
    stats,
  } = useHistoryFilters(entries);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("navigation.history")}</h1>
        <Badge variant="outline" className="ml-2">
          Audit Log
        </Badge>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <HistoryStatsGrid stats={stats} />

        <HistoryFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          eventFilter={eventFilter}
          onEventFilterChange={setEventFilter}
          actorFilter={actorFilter}
          onActorFilterChange={setActorFilter}
          actors={actors}
        />

        <HistoryTimeline
          entries={filteredEntries}
          isLoading={isLoading}
          errorMessage={isError ? t("status.error") : null}
        />
      </main>
    </div>
  );
}
