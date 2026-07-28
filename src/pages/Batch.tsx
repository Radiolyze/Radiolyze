import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BarChart3, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBatchReports } from "@/hooks/useBatchReports";
import { useBatchFilters } from "@/hooks/useBatchFilters";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { useBatchBulkActions } from "@/hooks/useBatchBulkActions";
import { BatchStatsGrid } from "@/components/Batch/BatchStatsGrid";
import { BatchFilterBar } from "@/components/Batch/BatchFilterBar";
import { BatchReportsTable } from "@/components/Batch/BatchReportsTable";

export default function Batch() {
  const { t } = useTranslation("batch");
  const { t: tCommon } = useTranslation("common");

  const { reports, setReports, isLoading, errorMessage, wsConnected } = useBatchReports();

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    modalityFilter,
    setModalityFilter,
    filteredReports,
    stats,
    modalities,
  } = useBatchFilters(reports);

  const {
    selectedIds,
    setSelectedIds,
    handleSelectAll,
    handleSelectOne,
    isAllSelected,
    isSomeSelected,
    approvableSelected,
  } = useBatchSelection(filteredReports);

  const { isProcessing, processProgress, handleBulkApprove, handleBulkExport, handleBulkDelete } =
    useBatchBulkActions({ reports, selectedIds, setReports, setSelectedIds });

  const hasActiveFilters =
    Boolean(searchQuery) || statusFilter !== "all" || modalityFilter !== "all";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Badge variant="outline" className="ml-2">
          <BarChart3 className="h-3 w-3 mr-1" />
          Dashboard
        </Badge>

        {/* WebSocket connection status */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-success" />
              <span className="text-success hidden sm:inline">
                {tCommon("connection.liveUpdates")}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground hidden sm:inline">
                {tCommon("connection.connecting")}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <BatchStatsGrid stats={stats} />

        <BatchFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          modalityFilter={modalityFilter}
          onModalityFilterChange={setModalityFilter}
          modalities={modalities}
          selectedCount={selectedIds.size}
          approvableSelected={approvableSelected}
          isProcessing={isProcessing}
          processProgress={processProgress}
          onBulkApprove={handleBulkApprove}
          onBulkExport={handleBulkExport}
          onBulkDelete={handleBulkDelete}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Reports</span>
              <Badge variant="outline">
                {filteredReports.length}{" "}
                {t("table.noResults").includes("Ergebnisse") ? "Einträge" : "entries"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <BatchReportsTable
              reports={filteredReports}
              isLoading={isLoading}
              errorMessage={errorMessage}
              selectedIds={selectedIds}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              hasActiveFilters={hasActiveFilters}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
