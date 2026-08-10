import { useQuery } from "@tanstack/react-query";
import { getAnnotationCategories, getTrainingStats } from "@/services/trainingClient";

/**
 * Corpus stats and the annotation categories available as a filter.
 *
 * The stats are keyed on `verifiedOnly` because the toggle changes what is
 * being counted, not just what is exported.
 */
export function useTrainingData(verifiedOnly: boolean) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["training-stats", verifiedOnly],
    queryFn: () => getTrainingStats({ verifiedOnly }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["annotation-categories"],
    queryFn: getAnnotationCategories,
  });

  // Defensive: ensure categories is always an array
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  return { stats, statsLoading, categories };
}
