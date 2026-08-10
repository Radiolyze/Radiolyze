import { useMemo } from "react";
import { AlertTriangle, Calendar, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { groupEntriesByDate, type AuditLogEntry } from "@/services/auditMapping";
import { HistoryTimelineEntry } from "./HistoryTimelineEntry";

interface HistoryTimelineProps {
  entries: AuditLogEntry[];
  isLoading: boolean;
  errorMessage: string | null;
}

export function HistoryTimeline({ entries, isLoading, errorMessage }: HistoryTimelineProps) {
  const { t } = useTranslation("common");

  const groupedEntries = useMemo(
    () =>
      groupEntriesByDate(entries, {
        today: t("time.today"),
        yesterday: t("time.yesterday"),
        other: (date) => date.toLocaleDateString(),
      }),
    [entries, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </span>
          <Badge variant="secondary">{entries.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-6 pt-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t("status.loading")}</p>
              </div>
            ) : errorMessage ? (
              <div className="text-center py-12 text-destructive">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-70" />
                <p>{errorMessage}</p>
              </div>
            ) : (
              <>
                {Array.from(groupedEntries.entries()).map(([dateLabel, groupEntries]) => (
                  <div key={dateLabel} className="mb-6">
                    {/* Date Header */}
                    <div className="sticky top-0 bg-card z-10 py-2 mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">{dateLabel}</h3>
                      <Separator className="mt-2" />
                    </div>

                    {/* Timeline Items */}
                    <div className="relative pl-8">
                      {/* Timeline Line */}
                      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

                      {groupEntries.map((entry) => (
                        <HistoryTimelineEntry key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}

                {entries.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{t("queue.empty")}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
