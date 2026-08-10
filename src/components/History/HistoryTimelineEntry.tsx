import { Clock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { AuditLogEntry } from "@/services/auditMapping";
import { useEventTypeConfig } from "./eventTypeConfig";

interface HistoryTimelineEntryProps {
  entry: AuditLogEntry;
}

export function HistoryTimelineEntry({ entry }: HistoryTimelineEntryProps) {
  const { t } = useTranslation("common");
  const config = useEventTypeConfig()[entry.eventType];
  const Icon = config.icon;

  const elapsed = formatRelativeTime(entry.timestamp, {
    justNow: t("time.justNow"),
    minutes: (count) => `${count} min`,
    hours: (count) => `${count} h`,
    daysAgo: (count) => t("time.daysAgo", { count }),
    absolute: (date) => date.toLocaleDateString(),
  });

  return (
    <div className="relative mb-4 last:mb-0">
      {/* Timeline Dot */}
      <div
        className={cn(
          "absolute -left-5 w-6 h-6 rounded-full flex items-center justify-center",
          config.bgColor,
        )}
      >
        <Icon className={cn("h-3 w-3", config.color)} />
      </div>

      {/* Content */}
      <div className="bg-accent/30 rounded-lg p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("font-medium", config.color)}>{config.label}</span>
              <Badge variant="outline" className="text-xs">
                {entry.accessionNumber}
              </Badge>
            </div>
            <p className="text-sm text-foreground">{entry.patientName}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.actorName}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {elapsed}
              </span>
            </div>
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                {Object.entries(entry.metadata).map(([key, value]) => (
                  <span key={key} className="mr-3">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(entry.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
