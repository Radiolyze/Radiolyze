import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAnnotationCategories,
  getTrainingStats,
  type CategoryCount,
  type ExportStats,
} from "@/services/trainingClient";

export interface UseTrainingDataResult {
  stats?: ExportStats;
  statsLoading: boolean;
  /** Annotation categories with their counts, always an array. */
  categories: CategoryCount[];
}

/**
 * The two reads behind the training-export page.
 *
 * The stats are keyed on `verifiedOnly` because the toggle changes what the
 * backend counts, not just what is displayed — flipping it refetches.
 */
export function useTrainingData(verifiedOnly: boolean): UseTrainingDataResult {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["training-stats", verifiedOnly],
    queryFn: () => getTrainingStats({ verifiedOnly }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["annotation-categories"],
    queryFn: getAnnotationCategories,
  });

  // Defensive: a non-array response would otherwise take the page down at
  // `.map` rather than simply rendering no category filters.
  const categories = useMemo(
    () => (Array.isArray(categoriesData) ? categoriesData : []),
    [categoriesData],
  );

  return { stats, statsLoading, categories };
}
