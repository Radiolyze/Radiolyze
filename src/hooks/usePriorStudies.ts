import i18n from "@/i18n";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Series, Study } from "@/types/radiology";
import { orthancClient } from "@/services/orthancClient";
import type { DicomJsonRecord } from "@/services/dicomWebMapping";
import {
  mapSeriesRecordToSeries,
  mapStudyRecordToPatient,
  mapStudyRecordToStudy,
} from "@/services/dicomWebMapping";
import { logger } from "@/lib/logger";

export const priorStudiesQueryKey = (patientId: string | undefined, limit: number) =>
  ["priorStudies", patientId, limit] as const;

const buildFallbackStudy = (studyId: string, patientId: string): Study => ({
  id: studyId,
  patientId,
  accessionNumber: `ACC-${studyId.slice(0, 8)}`,
  modality: "CT",
  studyDate: new Date().toISOString().slice(0, 10),
  studyDescription: "Unbekannte Studie",
  referringPhysician: "Unbekannt",
  series: [],
});

const resolveSeries = async (studyId: string): Promise<Series[]> => {
  const response = await orthancClient.listSeries(studyId);
  const rawSeries = Array.isArray(response)
    ? response
    : Array.isArray((response as { Series?: unknown[] }).Series)
      ? (response as { Series: unknown[] }).Series
      : [];

  return rawSeries
    .map((entry) => mapSeriesRecordToSeries(entry as DicomJsonRecord, studyId))
    .filter((series): series is Series => Boolean(series));
};

const getStudyDateValue = (study: Study) => {
  const parsed = Date.parse(study.studyDate);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const loadPriorStudies = async (patientId: string, limit: number): Promise<Study[]> => {
  const response = await orthancClient.listStudies({ limit, patientId });
  const records = Array.isArray(response)
    ? response
    : Array.isArray((response as { Studies?: unknown[] }).Studies)
      ? (response as { Studies: unknown[] }).Studies
      : [];

  const mapped = await Promise.all(
    records.map(async (record) => {
      if (typeof record === "string") {
        const studyId = record;
        return buildFallbackStudy(studyId, patientId);
      }

      const dicomRecord = record as DicomJsonRecord;
      const studyId =
        (dicomRecord["0020000D"]?.Value?.[0] as string | undefined) ||
        (dicomRecord.StudyInstanceUID as string | undefined);
      if (!studyId) return null;

      const patient = mapStudyRecordToPatient(dicomRecord, studyId);
      if (patient.id !== patientId) {
        return null;
      }

      const study = mapStudyRecordToStudy(dicomRecord, patient.id, studyId);
      const series = await resolveSeries(study.id);
      return { ...study, series };
    }),
  );

  return mapped
    .filter((study): study is Study => Boolean(study))
    .sort((a, b) => getStudyDateValue(b) - getStudyDateValue(a));
};

interface PriorStudiesState {
  priorStudies: Study[];
  isLoading: boolean;
  error: string | null;
}

/**
 * The patient's other studies, newest first, minus the one on screen.
 *
 * The request is keyed on the patient alone: moving between studies of the
 * same patient — the common case when reading priors — re-filters the cached
 * list instead of re-querying Orthanc and re-resolving every series.
 */
export function usePriorStudies(
  patientId?: string,
  currentStudyId?: string,
  limit = 12,
): PriorStudiesState {
  const {
    data,
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: priorStudiesQueryKey(patientId, limit),
    queryFn: () => loadPriorStudies(patientId as string, limit),
    enabled: Boolean(patientId),
  });

  useEffect(() => {
    if (queryError) {
      logger.warn("Failed to load prior studies", queryError);
    }
  }, [queryError]);

  const priorStudies = useMemo(
    () => (data ?? []).filter((study) => study.id !== currentStudyId),
    [data, currentStudyId],
  );

  return {
    priorStudies,
    isLoading,
    error: isError ? i18n.t("errors:dicomweb.priorsLoadFailed") : null,
  };
}
