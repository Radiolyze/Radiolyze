import { useCallback, useMemo, useState } from "react";
import type { ExportFormat } from "@/services/trainingClient";
import type { ExportSettingsValues } from "@/lib/trainingExport";

export interface UseExportSettingsResult {
  /** The settings as one value, ready to hand to the request builders. */
  settings: ExportSettingsValues;
  selectedFormat: ExportFormat;
  setSelectedFormat: (format: ExportFormat) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (verifiedOnly: boolean) => void;
  /** Single-element array, the shape the Slider reads and writes. */
  splitRatio: number[];
  setSplitRatio: (splitRatio: number[]) => void;
  selectedCategories: string[];
  toggleCategory: (category: string) => void;
  clearCategories: () => void;
  includeImages: boolean;
  setIncludeImages: (includeImages: boolean) => void;
}

/**
 * The export form's state.
 *
 * The split ratio is held as the Slider's single-element array rather than a
 * number so the control stays the source of truth for its own value; the scalar
 * the requests need is unpacked into `settings`.
 *
 * This holds no data of its own on purpose: `verifiedOnly` is an input to the
 * stats query, so the settings have to exist before the data they describe.
 */
export function useExportSettings(): UseExportSettingsResult {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("radiolyze");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [splitRatio, setSplitRatio] = useState([0.8]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeImages, setIncludeImages] = useState(false);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((entry) => entry !== category) : [...prev, category],
    );
  }, []);

  const clearCategories = useCallback(() => setSelectedCategories([]), []);

  const settings = useMemo<ExportSettingsValues>(
    () => ({
      format: selectedFormat,
      verifiedOnly,
      splitRatio: splitRatio[0],
      categories: selectedCategories,
      includeImages,
    }),
    [selectedFormat, verifiedOnly, splitRatio, selectedCategories, includeImages],
  );

  return {
    settings,
    selectedFormat,
    setSelectedFormat,
    verifiedOnly,
    setVerifiedOnly,
    splitRatio,
    setSplitRatio,
    selectedCategories,
    toggleCategory,
    clearCategories,
    includeImages,
    setIncludeImages,
  };
}
