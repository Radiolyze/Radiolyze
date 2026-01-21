import { useEffect, useState } from 'react';
import type { Series, Study } from '@/types/radiology';
import { orthancClient } from '@/services/orthancClient';
import type { DicomJsonRecord } from '@/services/dicomWebMapping';
import { mapSeriesRecordToSeries, mapStudyRecordToPatient, mapStudyRecordToStudy } from '@/services/dicomWebMapping';

const buildFallbackStudy = (studyId: string, patientId: string): Study => ({
  id: studyId,
  patientId,
  accessionNumber: `ACC-${studyId.slice(0, 8)}`,
  modality: 'CT',
  studyDate: new Date().toISOString().slice(0, 10),
  studyDescription: 'Unbekannte Studie',
  referringPhysician: 'Unbekannt',
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

interface PriorStudiesState {
  priorStudies: Study[];
  isLoading: boolean;
  error: string | null;
}

export function usePriorStudies(patientId?: string, currentStudyId?: string, limit = 12): PriorStudiesState {
  const [priorStudies, setPriorStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!patientId) {
      setPriorStudies([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const loadPriorStudies = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await orthancClient.listStudies({ limit, patientId });
        const records = Array.isArray(response)
          ? response
          : Array.isArray((response as { Studies?: unknown[] }).Studies)
            ? (response as { Studies: unknown[] }).Studies
            : [];

        const mapped = await Promise.all(
          records.map(async (record) => {
            if (typeof record === 'string') {
              const studyId = record;
              return buildFallbackStudy(studyId, patientId);
            }

            const dicomRecord = record as DicomJsonRecord;
            const studyId =
              (dicomRecord['0020000D']?.Value?.[0] as string | undefined) ||
              (dicomRecord.StudyInstanceUID as string | undefined);
            if (!studyId) return null;

            const patient = mapStudyRecordToPatient(dicomRecord, studyId);
            if (patientId && patient.id !== patientId) {
              return null;
            }

            const study = mapStudyRecordToStudy(dicomRecord, patient.id, studyId);
            const series = await resolveSeries(study.id);
            return { ...study, series };
          })
        );

        const filtered = mapped
          .filter((study): study is Study => Boolean(study))
          .filter((study) => study.id !== currentStudyId)
          .sort((a, b) => getStudyDateValue(b) - getStudyDateValue(a));

        if (isActive) {
          setPriorStudies(filtered);
        }
      } catch (err) {
        console.warn('Failed to load prior studies', err);
        if (isActive) {
          setError('Voruntersuchungen konnten nicht geladen werden.');
          setPriorStudies([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadPriorStudies();

    return () => {
      isActive = false;
    };
  }, [patientId, currentStudyId, limit]);

  return { priorStudies, isLoading, error };
}
