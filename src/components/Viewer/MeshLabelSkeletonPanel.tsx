import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 5;

/**
 * Placeholder rail shown while the segmenter runs, so the right-hand side of
 * the workspace stays populated during a run that takes minutes rather than
 * collapsing to empty space.
 */
export function MeshLabelSkeletonPanel() {
  const { t } = useTranslation("viewer");

  return (
    <div
      className="absolute top-12 right-4 z-20 flex max-h-[85%] w-80 flex-col gap-2 rounded-md border bg-card/90 p-3 backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">
        {t("mesh.skeleton.loading")}
      </h3>
      <ul className="space-y-3" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
          <li key={idx} className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
              <Skeleton className="h-3.5 w-4 shrink-0" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3 w-10 shrink-0" />
            </div>
            <Skeleton className="h-2 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
