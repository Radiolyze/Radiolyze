import { useTranslation } from "react-i18next";
import { Download, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import type { ReportStatus } from "@/types/radiology";

interface BatchFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  modalityFilter: string;
  onModalityFilterChange: (value: string) => void;
  modalities: string[];
  selectedCount: number;
  approvableSelected: number;
  isProcessing: boolean;
  processProgress: number;
  onBulkApprove: () => void;
  onBulkExport: () => void;
  onBulkDelete: () => void;
}

const ALL_STATUSES: ReportStatus[] = ["pending", "in_progress", "draft", "approved", "finalized"];

export function BatchFilterBar({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  modalityFilter,
  onModalityFilterChange,
  modalities,
  selectedCount,
  approvableSelected,
  isProcessing,
  processProgress,
  onBulkApprove,
  onBulkExport,
  onBulkDelete,
}: BatchFilterBarProps) {
  const { t } = useTranslation("batch");
  const { t: tCommon } = useTranslation("common");

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
              {ALL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {tCommon(`status.${status === "in_progress" ? "inProgress" : status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modalityFilter} onValueChange={onModalityFilterChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t("filters.modality")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allModalities")}</SelectItem>
              {modalities.map((mod) => (
                <SelectItem key={mod} value={mod}>
                  {mod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary">{t("actions.selected", { count: selectedCount })}</Badge>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default" size="sm" disabled={approvableSelected === 0}>
                    <Send className="h-4 w-4 mr-1" />
                    {tCommon("actions.approve")} ({approvableSelected})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("bulk.confirmApprove", { count: approvableSelected })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("bulk.confirmApprove", { count: approvableSelected })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon("actions.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onBulkApprove}>
                      {tCommon("actions.approve")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" size="sm" onClick={onBulkExport}>
                <Download className="h-4 w-4 mr-1" />
                {tCommon("actions.export")}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    {tCommon("actions.delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{tCommon("actions.delete")}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {selectedCount} Reports werden dauerhaft gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon("actions.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {tCommon("actions.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {t("bulk.processing", { current: Math.round(processProgress), total: 100 })}
              </span>
              <span className="font-mono">{Math.round(processProgress)}%</span>
            </div>
            <Progress value={processProgress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
