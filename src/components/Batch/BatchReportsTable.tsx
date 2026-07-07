import { useTranslation } from "react-i18next";
import { CheckCircle, Clock, FileText, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Common/EmptyState";
import { cn } from "@/lib/utils";
import type { ReportStatus, QAStatus } from "@/types/radiology";
import type { BatchReport } from "@/hooks/useBatchReports";

interface BatchReportsTableProps {
  reports: BatchReport[];
  isLoading: boolean;
  errorMessage: string | null;
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  hasActiveFilters: boolean;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
}

export function BatchReportsTable({
  reports,
  isLoading,
  errorMessage,
  selectedIds,
  isAllSelected,
  isSomeSelected,
  hasActiveFilters,
  onSelectAll,
  onSelectOne,
}: BatchReportsTableProps) {
  const { t } = useTranslation("batch");
  const { t: tCommon } = useTranslation("common");
  const { t: tReport } = useTranslation("report");

  const statusConfig: Record<
    ReportStatus,
    { label: string; color: string; icon: typeof FileText }
  > = {
    pending: {
      label: tCommon("status.pending"),
      color: "bg-muted text-muted-foreground",
      icon: Clock,
    },
    in_progress: {
      label: tCommon("status.inProgress"),
      color: "bg-blue-500/10 text-blue-500",
      icon: RefreshCw,
    },
    draft: { label: tCommon("status.draft"), color: "bg-warning/10 text-warning", icon: FileText },
    approved: {
      label: tCommon("status.approved"),
      color: "bg-success/10 text-success",
      icon: CheckCircle,
    },
    finalized: {
      label: tCommon("status.finalized"),
      color: "bg-primary/10 text-primary",
      icon: CheckCircle,
    },
  };

  const qaStatusConfig: Record<QAStatus, { label: string; color: string }> = {
    pending: { label: tCommon("status.pending"), color: "text-muted-foreground" },
    checking: { label: tReport("qa.checking"), color: "text-blue-500" },
    pass: { label: tReport("qa.passed"), color: "text-success" },
    warn: { label: tReport("qa.warning"), color: "text-warning" },
    fail: { label: tReport("qa.failed"), color: "text-destructive" },
  };

  const priorityConfig = {
    normal: { label: tCommon("priority.normal"), color: "bg-muted text-muted-foreground" },
    urgent: {
      label: tCommon("priority.urgent"),
      color: "bg-warning/10 text-warning border-warning",
    },
    stat: {
      label: tCommon("priority.stat"),
      color: "bg-destructive/10 text-destructive border-destructive",
    },
  };

  return (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                // @ts-expect-error - indeterminate is valid
                indeterminate={isSomeSelected}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>{t("table.patient")}</TableHead>
            <TableHead>Accession</TableHead>
            <TableHead>{t("table.study")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead>QA</TableHead>
            <TableHead>{t("table.priority")}</TableHead>
            <TableHead>-</TableHead>
            <TableHead className="text-right">TAT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-4 rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          {errorMessage && !isLoading && (
            <TableRow>
              <TableCell colSpan={9}>
                <EmptyState
                  icon={XCircle}
                  title={errorMessage}
                  description="Bitte versuchen Sie es erneut oder kontaktieren Sie den Support."
                />
              </TableCell>
            </TableRow>
          )}
          {reports.map((report, index) => {
            const statusConf = statusConfig[report.status];
            const qaConf = qaStatusConfig[report.qaStatus];
            const priorityConf = priorityConfig[report.priority];
            const isSelected = selectedIds.has(report.id);

            return (
              <TableRow
                key={report.id}
                className={cn(
                  "cursor-pointer transition-colors animate-fade-in",
                  isSelected && "bg-accent",
                )}
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                onClick={() => onSelectOne(report.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={isSelected} onCheckedChange={() => onSelectOne(report.id)} />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{report.patientName}</p>
                    <p className="text-xs text-muted-foreground">{report.mrn}</p>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{report.accessionNumber}</TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{report.studyDescription}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.modality} • {report.studyDate}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusConf.color}>
                    {statusConf.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={cn("text-sm font-medium", qaConf.color)}>{qaConf.label}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(priorityConf.color, "text-xs")}>
                    {priorityConf.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{report.assignedTo}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {report.turnaroundMinutes ? `${report.turnaroundMinutes}m` : "—"}
                </TableCell>
              </TableRow>
            );
          })}

          {reports.length === 0 && !isLoading && !errorMessage && (
            <TableRow>
              <TableCell colSpan={9}>
                <EmptyState
                  icon={FileText}
                  title={t("table.noResults")}
                  description={
                    hasActiveFilters
                      ? "Passen Sie die Filter an um mehr Ergebnisse zu sehen."
                      : "Es sind noch keine Reports vorhanden."
                  }
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
