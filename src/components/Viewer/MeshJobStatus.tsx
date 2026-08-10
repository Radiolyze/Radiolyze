import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface MeshJobProgressProps {
  /** Whole percent, 0..100. */
  progressPct: number;
}

/** Progress of a segmenter run, which can take several minutes. */
export function MeshJobProgress({ progressPct }: MeshJobProgressProps) {
  const { t } = useTranslation("viewer");

  return (
    <div className="absolute top-28 left-4 z-20 w-72 rounded-md border bg-card/90 p-3 backdrop-blur">
      <div className="text-xs font-medium mb-1">
        {t("mesh.status.running", { progress: progressPct })}
      </div>
      <Progress value={progressPct} className="h-1.5" />
    </div>
  );
}

interface MeshJobErrorProps {
  message: string;
  onRetry: () => void;
  canRetry: boolean;
}

/** Failed-job alert with a retry that re-queues the same series and preset. */
export function MeshJobError({ message, onRetry, canRetry }: MeshJobErrorProps) {
  const { t } = useTranslation("viewer");

  return (
    <div
      className="absolute top-28 left-4 z-20 flex w-80 items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
      role="alert"
    >
      <div className="flex-1">
        <div className="font-semibold">{t("mesh.status.failed")}</div>
        <div className="mt-0.5 break-words">{message}</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        disabled={!canRetry}
        aria-label={t("mesh.retry")}
      >
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
        {t("mesh.retry")}
      </Button>
    </div>
  );
}
