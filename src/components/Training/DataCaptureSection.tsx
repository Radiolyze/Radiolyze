import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ManifestPreview } from "./ManifestPreview";
import type { UseTrainingManifestReturn } from "@/hooks/training/useTrainingManifest";

interface DataCaptureSectionProps {
  includeImages: boolean;
  onIncludeImagesChange: (value: boolean) => void;
  /** False while the corpus is empty — there is nothing to catalogue. */
  hasAnnotations: boolean;
  manifest: UseTrainingManifestReturn;
}

export function DataCaptureSection({
  includeImages,
  onIncludeImagesChange,
  hasAnnotations,
  manifest,
}: DataCaptureSectionProps) {
  const { t } = useTranslation("training");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="include-images">{t("dataCapture.includeImages")}</Label>
          <p className="text-sm text-muted-foreground">{t("dataCapture.includeImagesHint")}</p>
        </div>
        <Switch
          id="include-images"
          checked={includeImages}
          onCheckedChange={onIncludeImagesChange}
        />
      </div>

      {includeImages && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={manifest.generateManifest}
              disabled={manifest.isGenerating || !hasAnnotations}
            >
              {manifest.isGenerating ? (
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
              onClick={manifest.checkImages}
              disabled={manifest.isGenerating || !hasAnnotations}
            >
              {t("dataCapture.checkImages")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={manifest.downloadManifest}
              disabled={manifest.isDownloading || !hasAnnotations}
            >
              {manifest.isDownloading
                ? t("dataCapture.downloadingManifest")
                : t("dataCapture.downloadManifest")}
            </Button>
          </div>

          {manifest.manifest && <ManifestPreview manifest={manifest.manifest} />}
        </div>
      )}
    </div>
  );
}
