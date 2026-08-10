import { useCallback, useRef, useState } from "react";
import type { ImageRef } from "@/types/radiology";
import { reportClient } from "@/services/reportClient";
import { computeDeltaDays } from "@/lib/studyDates";
import { logger } from "@/lib/logger";

export interface EvidenceSelection {
  seriesId: string;
  stackIndex: number;
}

interface UseWorkspaceImageRefsOptions {
  /** Study date of the study on screen, used to date its own images. */
  currentStudyDate?: string;
  /** Series id → study date, for dating prior images. */
  priorStudyDateBySeries: Map<string, string>;
  /** Report the comparison is recorded against, if one is open. */
  reportId?: string;
}

export interface UseWorkspaceImageRefsResult {
  imageRefs: ImageRef[];
  priorImageRefs: ImageRef[];
  evidenceSelection: EvidenceSelection | null;
  setImageRefs: (refs: ImageRef[]) => void;
  setPriorImageRefs: (refs: ImageRef[]) => void;
  selectEvidence: (ref: ImageRef) => void;
}

/**
 * The images the viewer currently has loaded, on their way to inference.
 *
 * The viewer reports plain refs; what inference needs is refs that know which
 * study they came from, whether they are current or prior, and how far apart
 * the two studies are. That enrichment happens on the way in, so every consumer
 * downstream sees complete refs.
 *
 * Choosing a prior also records the comparison on the report. That write is
 * guarded by the last-persisted key because the viewer re-emits its refs on
 * every load, and only a genuine change of prior is a new comparison.
 */
export function useWorkspaceImageRefs({
  currentStudyDate,
  priorStudyDateBySeries,
  reportId,
}: UseWorkspaceImageRefsOptions): UseWorkspaceImageRefsResult {
  const [imageRefs, setImageRefsState] = useState<ImageRef[]>([]);
  const [priorImageRefs, setPriorImageRefsState] = useState<ImageRef[]>([]);
  const [evidenceSelection, setEvidenceSelection] = useState<EvidenceSelection | null>(null);
  const lastPersistedComparisonKey = useRef<string | null>(null);

  const setImageRefs = useCallback(
    (refs: ImageRef[]) => {
      const enriched = refs.map((ref) => ({
        ...ref,
        studyDate: ref.studyDate ?? currentStudyDate,
        role: ref.role ?? "current",
        timeDeltaDays: currentStudyDate ? 0 : ref.timeDeltaDays,
      }));
      setImageRefsState(enriched);
    },
    [currentStudyDate],
  );

  const setPriorImageRefs = useCallback(
    (refs: ImageRef[]) => {
      const enriched = refs.map((ref) => {
        const priorStudyDate = ref.studyDate ?? priorStudyDateBySeries.get(ref.seriesId);
        return {
          ...ref,
          studyDate: priorStudyDate,
          role: ref.role ?? "prior",
          timeDeltaDays: computeDeltaDays(currentStudyDate, priorStudyDate),
        };
      });
      setPriorImageRefsState(enriched);

      const primary = enriched[0];
      if (reportId && primary?.studyId) {
        const key = `${reportId}:${primary.studyId}`;
        if (lastPersistedComparisonKey.current !== key) {
          lastPersistedComparisonKey.current = key;
          reportClient
            .createComparison(reportId, {
              priorStudyUid: primary.studyId,
              priorSeriesUid: primary.seriesId,
              timeDeltaDays: primary.timeDeltaDays,
            })
            .catch((error) => {
              logger.error("Failed to persist report comparison", error);
            });
        }
      }
    },
    [priorStudyDateBySeries, currentStudyDate, reportId],
  );

  const selectEvidence = useCallback((ref: ImageRef) => {
    setEvidenceSelection({ seriesId: ref.seriesId, stackIndex: ref.stackIndex });
  }, []);

  return {
    imageRefs,
    priorImageRefs,
    evidenceSelection,
    setImageRefs,
    setPriorImageRefs,
    selectEvidence,
  };
}
