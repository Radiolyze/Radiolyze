import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { Study } from "@/types/radiology";
import { usePriorStudies } from "@/hooks/usePriorStudies";
import { useDateFormat } from "@/hooks/useDateFormat";

interface PriorStudyForViewer {
  study: Study;
  label: string;
  date: string;
}

export interface UseWorkspacePriorsResult {
  priorStudies: Study[];
  /** The same studies, labelled and date-formatted for the comparison viewer. */
  priorStudiesForViewer: PriorStudyForViewer[];
  /** Series id → the study date of the prior study it belongs to. */
  priorStudyDateBySeries: Map<string, string>;
}

/**
 * The patient's prior studies, prepared for the comparison viewer.
 *
 * The series → study-date map is built here rather than at the point of use
 * because it is derived from nothing but the prior studies: a prior `ImageRef`
 * carries its series id but not the date of the study that series came from,
 * and the time delta shown against the current study needs that date.
 */
export function useWorkspacePriors(
  patientId?: string,
  currentStudyId?: string,
): UseWorkspacePriorsResult {
  const { formatDate } = useDateFormat();
  const { priorStudies: priorStudiesRaw, error } = usePriorStudies(patientId, currentStudyId);

  const priorStudies = useMemo(
    () => (Array.isArray(priorStudiesRaw) ? priorStudiesRaw : []),
    [priorStudiesRaw],
  );

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const priorStudyDateBySeries = useMemo(() => {
    const map = new Map<string, string>();
    priorStudies.forEach((study) => {
      study.series.forEach((series) => {
        map.set(series.id, study.studyDate);
      });
    });
    return map;
  }, [priorStudies]);

  const priorStudiesForViewer = useMemo(
    () =>
      priorStudies.map((study) => ({
        study,
        label: study.studyDescription,
        date: formatDate(study.studyDate),
      })),
    [priorStudies, formatDate],
  );

  return { priorStudies, priorStudiesForViewer, priorStudyDateBySeries };
}
