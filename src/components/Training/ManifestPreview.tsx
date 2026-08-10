import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { MANIFEST_PREVIEW_ROWS, manifestErrorEntries } from "@/lib/trainingExport";
import type { ManifestResponse } from "@/services/trainingClient";

interface ManifestPreviewProps {
  manifest: ManifestResponse;
}

/**
 * What the catalogue contains, and — when the manifest was fetched with an
 * image check — which entries could not be read. `total` is the whole corpus
 * while `images` is only the capped preview, so the two are shown separately
 * whenever they disagree.
 */
export function ManifestPreview({ manifest }: ManifestPreviewProps) {
  const { t } = useTranslation("training");

  const errorEntries = manifestErrorEntries(manifest);
  const hiddenEntries = manifest.images.length - MANIFEST_PREVIEW_ROWS;
  const hiddenErrors = (manifest.status?.error ?? 0) - MANIFEST_PREVIEW_ROWS;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        {t("dataCapture.catalogCount", { count: manifest.total })}
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
        {manifest.images.slice(0, MANIFEST_PREVIEW_ROWS).map((entry) => (
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
        {hiddenEntries > 0 && (
          <div className="text-xs text-muted-foreground">
            {t("dataCapture.moreEntries", { count: hiddenEntries })}
          </div>
        )}
      </div>

      {manifest.status?.error ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t("dataCapture.errorListTitle")}
          </div>
          {errorEntries.map((entry) => (
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
          {hiddenErrors > 0 && (
            <div className="text-xs text-muted-foreground">
              {t("dataCapture.moreErrors", { count: hiddenErrors })}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5" />
        {t("dataCapture.manifestHint")}
      </div>
    </div>
  );
}
