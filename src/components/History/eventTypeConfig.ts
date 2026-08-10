import { useMemo } from "react";
import { AlertTriangle, CheckCircle, Download, Edit3, FileText, Mic, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AuditEventType } from "@/services/auditMapping";

export interface EventTypeConfig {
  icon: typeof FileText;
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Icon, label and colour per audit event type.
 *
 * Built through the hook rather than as a module constant so the labels follow a
 * language switch — a constant would be fixed at import time.
 */
export function useEventTypeConfig(): Record<AuditEventType, EventTypeConfig> {
  const { t } = useTranslation("common");
  const { t: tReport } = useTranslation("report");

  return useMemo(
    () => ({
      report_created: {
        icon: FileText,
        label: t("status.pending"),
        color: "text-primary",
        bgColor: "bg-primary/10",
      },
      report_opened: {
        icon: FileText,
        label: "Report opened",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      },
      findings_saved: {
        icon: Edit3,
        label: tReport("findings.title"),
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      },
      impression_generated: {
        icon: Sparkles,
        label: tReport("impression.aiDraft"),
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
      },
      asr_transcription: {
        icon: Mic,
        label: "ASR",
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
      },
      qa_check_run: {
        icon: AlertTriangle,
        label: tReport("qa.title"),
        color: "text-warning",
        bgColor: "bg-warning/10",
      },
      report_approved: {
        icon: CheckCircle,
        label: t("status.approved"),
        color: "text-success",
        bgColor: "bg-success/10",
      },
      report_amended: {
        icon: Edit3,
        label: t("actions.edit"),
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
      },
      report_exported: {
        icon: Download,
        label: t("actions.export"),
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      },
      inference_queued: {
        icon: Sparkles,
        label: tReport("ai.status.queued"),
        color: "text-info",
        bgColor: "bg-info/10",
      },
      other: { icon: FileText, label: "-", color: "text-muted-foreground", bgColor: "bg-muted" },
    }),
    [t, tReport],
  );
}
