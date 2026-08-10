import { useCallback, useMemo, useState } from "react";
import { SPLIT_DEFAULT, type ExportSettingsValues } from "@/lib/trainingExport";
import type { ExportFormat } from "@/services/trainingClient";

/**
 * The export configuration the page is built around: format, corpus filters and
 * the train/validation split.
 *
 * `splitRatio` stays a single-element array because that is the shape the
 * slider reads and writes; `values.splitRatio` is the number everything else
 * wants, so no caller has to remember which is which.
 */
export function useExportSettings() {
  const [format, setFormat] = useState<ExportFormat>("radiolyze");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [splitRatio, setSplitRatio] = useState([SPLIT_DEFAULT]);
  const [categories, setCategories] = useState<string[]>([]);
  const [includeImages, setIncludeImages] = useState(false);

  const toggleCategory = useCallback((category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }, []);

  const clearCategories = useCallback(() => setCategories([]), []);

  const values: ExportSettingsValues = useMemo(
    () => ({
      format,
      verifiedOnly,
      splitRatio: splitRatio[0],
      categories,
      includeImages,
    }),
    [format, verifiedOnly, splitRatio, categories, includeImages],
  );

  return {
    format,
    setFormat,
    verifiedOnly,
    setVerifiedOnly,
    splitRatio,
    setSplitRatio,
    categories,
    toggleCategory,
    clearCategories,
    includeImages,
    setIncludeImages,
    values,
  };
}

export type UseExportSettingsReturn = ReturnType<typeof useExportSettings>;
