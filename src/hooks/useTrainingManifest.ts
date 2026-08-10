import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  downloadBlob,
  getTrainingManifest,
  type ExportStats,
  type ManifestResponse,
} from "@/services/trainingClient";
import {
  buildManifestRequest,
  manifestFilename,
  type ExportSettingsValues,
} from "@/lib/trainingExport";

/** Entries the on-screen previews ask for; the download takes the whole set. */
const PREVIEW_LIMIT = 50;

export interface UseTrainingManifestResult {
  /** The manifest currently on screen, or `null` when there is none to show. */
  manifest: ManifestResponse | null;
  isPending: boolean;
  isDownloading: boolean;
  /** Disabled when there is nothing to catalogue. */
  canGenerate: boolean;
  generatePreview: () => void;
  checkImages: () => void;
  downloadManifest: () => Promise<void>;
}

type ManifestSettings = Pick<
  ExportSettingsValues,
  "verifiedOnly" | "splitRatio" | "categories" | "includeImages"
>;

/**
 * The image manifest: a preview of what an export with images would contain.
 *
 * A displayed manifest is only true of the settings it was generated from, so
 * it is discarded whenever those change — otherwise a radiologist could narrow
 * the categories and still be looking at counts for the wider set. The download
 * deliberately bypasses the mutation: it fetches the unlimited manifest without
 * replacing the preview on screen, so the two cannot overwrite each other.
 */
export function useTrainingManifest(
  settings: ManifestSettings,
  stats?: ExportStats,
): UseTrainingManifestResult {
  const { t } = useTranslation("training");
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { verifiedOnly, splitRatio, categories, includeImages } = settings;

  const manifestMutation = useMutation({
    mutationFn: getTrainingManifest,
    onSuccess: (data) => {
      setManifest(data);
      toast.success(t("toast.manifestReady"), {
        description: t("toast.manifestReadyDescription", { count: data.total }),
      });
    },
    onError: (error: Error) => {
      toast.error(t("toast.manifestError"), {
        description: error.message,
      });
    },
  });

  const { mutate } = manifestMutation;

  const generatePreview = useCallback(() => {
    mutate(buildManifestRequest({ verifiedOnly, splitRatio, categories }, PREVIEW_LIMIT));
  }, [mutate, verifiedOnly, splitRatio, categories]);

  const checkImages = useCallback(() => {
    mutate(buildManifestRequest({ verifiedOnly, splitRatio, categories }, PREVIEW_LIMIT, true));
  }, [mutate, verifiedOnly, splitRatio, categories]);

  const downloadManifest = useCallback(async () => {
    setIsDownloading(true);
    try {
      const data = await getTrainingManifest(
        buildManifestRequest({ verifiedOnly, splitRatio, categories }, undefined, true),
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, manifestFilename());
      toast.success(t("toast.manifestDownloaded"));
    } catch (error) {
      toast.error(t("toast.manifestDownloadError"), {
        description: error instanceof Error ? error.message : t("toast.unknownError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [t, verifiedOnly, splitRatio, categories]);

  // Hiding the images section hides the manifest with it, so re-opening it does
  // not surface a result the user can no longer see the controls for.
  useEffect(() => {
    if (!includeImages) {
      setManifest(null);
    }
  }, [includeImages]);

  // Any change to what would be catalogued invalidates the displayed manifest.
  // Keyed on the categories' contents rather than the array's identity: a
  // caller that rebuilds the list each render would otherwise clear a manifest
  // the moment it was set, and nothing about that array's identity is a
  // promise this hook should depend on.
  const categoriesKey = categories.join("\u0000");
  useEffect(() => {
    setManifest(null);
  }, [verifiedOnly, splitRatio, categoriesKey]);

  return {
    manifest,
    isPending: manifestMutation.isPending,
    isDownloading,
    canGenerate: Boolean(stats?.totalAnnotations),
    generatePreview,
    checkImages,
    downloadManifest,
  };
}
