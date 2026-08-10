import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ManifestResponse } from "@/services/trainingClient";

/** Manifest entries listed on screen; the rest are summarised as a count. */
const VISIBLE_ENTRIES = 3;

interface TrainingManifestPanelProps {
  manifest: ManifestResponse | null;
  isPending: boolean;
  isDownloading: boolean;
  canGenerate: boolean;
  onGeneratePreview: () => void;
  onCheckImages: () => void;
  onDownload: () => void;
}

export function TrainingManifestPanel({
  manifest,
  isPending,
  isDownloading,
  canGenerate,
  onGeneratePreview,
  onCheckImages,
  onDownload,
}: TrainingManifestPanelProps) {
  const { t } = useTranslation("training");
  const errorEntries = manifest?.images.filter((entry) => entry.status === "error") ?? [];

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onGeneratePreview}
          disabled={isPending || !canGenerate}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("dataCapture.generatingManifest")}
            </>
          ) : (
            t("dataCapture.generateManifest")
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCheckImages}
          disabled={isPending || !canGenerate}
        >
          {t("dataCapture.checkImages")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          disabled={isDownloading || !canGenerate}
        >
          {isDownloading ? t("dataCapture.downloadingManifest") : t("dataCapture.downloadManifest")}
        </Button>
      </div>

      {manifest && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("dataCapture.catalogCount", { count: manifest.total })}
            {/* A preview asked for fewer entries than exist; say so rather than
                letting the shorter list read as the whole catalogue. */}
            {manifest.images.length !== manifest.total && (
              <span className="text-muted-foreground">
                {t("dataCapture.previewCount", { count: manifest.images.length })}
              </span>
            )}
          </div>
          {manifest.status && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{t("dataCapture.statusOk", { count: manifest.status.ok })}</span>
              <span>{t("dataCapture.statusError", { count: manifest.status.error })}</span>
            </div>
          )}
          <div className="space-y-1">
            {manifest.images.slice(0, VISIBLE_ENTRIES).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded bg-background px-2 py-1 text-xs"
              >
                <span className="font-mono">{entry.id}</span>
                <span className="text-muted-foreground">
                  {entry.splits.join(", ")}
                  {entry.status === "error" && ` · ${t("dataCapture.entryError")}`}
                </span>
              </div>
            ))}
            {manifest.images.length > VISIBLE_ENTRIES && (
              <div className="text-xs text-muted-foreground">
                {t("dataCapture.moreEntries", {
                  count: manifest.images.length - VISIBLE_ENTRIES,
                })}
              </div>
            )}
          </div>
          {manifest.status?.error ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t("dataCapture.errorListTitle")}
              </div>
              {errorEntries.slice(0, VISIBLE_ENTRIES).map((entry) => (
                <div
                  key={`${entry.id}-error`}
                  className="rounded border border-warning/30 bg-warning/5 px-2 py-1 text-xs"
                >
                  <div className="font-mono">{entry.id}</div>
                  <div className="text-muted-foreground">
                    {entry.error || t("dataCapture.fetchFailed")}
                  </div>
                </div>
              ))}
              {/* Counted from the status total, not the listed entries: a
                  preview can report more failures than it returned rows for. */}
              {manifest.status.error > VISIBLE_ENTRIES && (
                <div className="text-xs text-muted-foreground">
                  {t("dataCapture.moreErrors", {
                    count: manifest.status.error - VISIBLE_ENTRIES,
                  })}
                </div>
              )}
            </div>
          ) : null}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            {t("dataCapture.manifestHint")}
          </div>
        </div>
      )}
    </div>
  );
}
