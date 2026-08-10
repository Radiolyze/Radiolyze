import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MANIFEST_PREVIEW_LIMIT,
  buildManifestRequest,
  manifestBlob,
  manifestFilename,
  type ExportSettingsValues,
} from "@/lib/trainingExport";
import {
  downloadBlob,
  getTrainingManifest,
  type ManifestResponse,
} from "@/services/trainingClient";

/**
 * The data-capture manifest: which frames an export would write, and — when
 * asked — whether each one can actually be fetched.
 *
 * Three entry points share one manifest slot. Preview and check go through the
 * mutation and are capped; download asks for the whole catalogue and writes it
 * to disk without displaying it, so it carries its own pending flag rather than
 * blocking the preview buttons.
 */
export function useTrainingManifest(settings: ExportSettingsValues) {
  const { t } = useTranslation("training");
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { mutate, isPending } = useMutation({
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

  const generateManifest = useCallback(() => {
    mutate(buildManifestRequest(settings, { limit: MANIFEST_PREVIEW_LIMIT }));
  }, [mutate, settings]);

  const checkImages = useCallback(() => {
    mutate(buildManifestRequest(settings, { limit: MANIFEST_PREVIEW_LIMIT, checkImages: true }));
  }, [mutate, settings]);

  const downloadManifest = useCallback(async () => {
    setIsDownloading(true);
    try {
      const data = await getTrainingManifest(buildManifestRequest(settings, { checkImages: true }));
      downloadBlob(manifestBlob(data), manifestFilename());
      toast.success(t("toast.manifestDownloaded"));
    } catch (error) {
      toast.error(t("toast.manifestDownloadError"), {
        description: error instanceof Error ? error.message : t("toast.unknownError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [settings, t]);

  // A manifest only describes the settings it was generated from. Once any of
  // those move it is stale, and showing it beside the new settings would be a
  // lie about what the next export contains.
  //
  // The format is deliberately not in here: it decides how the frames are
  // serialised, not which ones the catalogue holds.
  //
  // Categories are compared by contents rather than array identity, so a caller
  // that rebuilds the list each render does not silently discard the manifest
  // on every re-render.
  const { includeImages, verifiedOnly, splitRatio, categories } = settings;
  // Stringified rather than joined: a separator a category name could itself
  // contain would make two different selections look like the same one.
  const categoryKey = JSON.stringify(categories);

  useEffect(() => {
    if (!includeImages) {
      setManifest(null);
    }
  }, [includeImages]);

  useEffect(() => {
    setManifest(null);
  }, [categoryKey, verifiedOnly, splitRatio]);

  return {
    manifest,
    generateManifest,
    checkImages,
    downloadManifest,
    isGenerating: isPending,
    isDownloading,
  };
}

export type UseTrainingManifestReturn = ReturnType<typeof useTrainingManifest>;
