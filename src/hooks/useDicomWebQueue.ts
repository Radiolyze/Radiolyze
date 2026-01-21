import { useEffect, useState } from 'react';
import type { QueueItem, Report, Series, Study } from '@/types/radiology';
import { orthancClient } from '@/services/orthancClient';
import { ApiError } from '@/services/apiClient';
import { reportClient } from '@/services/reportClient';
import { mapReportResponse } from '@/services/reportMapping';
import type { DicomJsonRecord } from '@/services/dicomWebMapping';
import { mapSeriesRecordToSeries, mapStudyRecordToPatient, mapStudyRecordToStudy } from '@/services/dicomWebMapping';
import { mockQueueItems } from '@/data/mockData';

const allowMockFallback = import.meta.env.VITE_ALLOW_MOCK_FALLBACK === 'true';

const buildReport = (study: Study): Report => {
  const now = new Date().toISOString();
  return {
    id: `report-${study.id}`,
    studyId: study.id,
    patientId: study.patientId,
    status: 'pending',
    findingsText: '',
    impressionText: '',
    createdAt: now,
    updatedAt: now,
    qaStatus: 'pending',
    qaWarnings: [],
    aiStatus: 'idle',
  };
};

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

const buildFallbackPatient = (studyId: string) => ({
  id: `patient-${studyId}`,
  name: 'Unbekannt',
  dateOfBirth: '',
  gender: 'O' as const,
  mrn: `MRN-${studyId.slice(0, 8)}`,
});

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

const resolveReport = async (study: Study, patientId: string): Promise<Report> => {
  const reportId = `report-${study.id}`;

  try {
    const response = await reportClient.getReport(reportId);
    return mapReportResponse(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      try {
        const response = await reportClient.createReport({
          reportId,
          studyId: study.id,
          patientId,
          status: 'pending',
          findingsText: '',
          impressionText: '',
        });
        return mapReportResponse(response);
      } catch (createError) {
        if (allowMockFallback) {
          console.warn('Report create failed, using local report fallback.', createError);
          return buildReport(study);
        }
        throw createError;
      }
    }

    if (allowMockFallback) {
      console.warn('Report fetch failed, using local report fallback.', error);
      return buildReport(study);
    }
    throw error;
  }
};

export function useDicomWebQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const useMockQueue = import.meta.env.VITE_USE_MOCK_QUEUE === 'true';

    const loadStudies = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (useMockQueue) {
          if (isActive) {
            setItems(mockQueueItems);
            setIsLoading(false);
          }
          return;
        }

        const response = await orthancClient.listStudies();
        const records = Array.isArray(response)
          ? response
          : Array.isArray((response as { Studies?: unknown[] }).Studies)
            ? (response as { Studies: unknown[] }).Studies
            : [];

        const parsedStudies = records
          .map((record) => {
            if (typeof record === 'string') {
              const patient = buildFallbackPatient(record);
              const study = buildFallbackStudy(record, patient.id);
              return { study, patient };
            }

            const dicomRecord = record as DicomJsonRecord;
            const studyId =
              (dicomRecord['0020000D']?.Value?.[0] as string | undefined) ||
              (dicomRecord.StudyInstanceUID as string | undefined);

            if (!studyId) return null;

            const patient = mapStudyRecordToPatient(dicomRecord, studyId);
            const study = mapStudyRecordToStudy(dicomRecord, patient.id, studyId);
            return { study, patient };
          })
          .filter((item): item is { study: Study; patient: ReturnType<typeof mapStudyRecordToPatient> } => Boolean(item));

        const queueItems = await Promise.all(
          parsedStudies.map(async ({ study, patient }) => {
            const [series, report] = await Promise.all([
              resolveSeries(study.id),
              resolveReport(study, patient.id),
            ]);
            return {
              id: `queue-${study.id}`,
              patient,
              study: { ...study, series },
              report,
              priority: 'normal' as const,
            };
          })
        );

        if (isActive) {
          setItems(queueItems);
        }
      } catch (err) {
        console.warn('Failed to load DICOM studies', err);
        if (isActive) {
          setError('DICOMweb-Studien konnten nicht geladen werden.');
          setItems([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadStudies();

    return () => {
      isActive = false;
    };
  }, []);

  return { items, isLoading, error };
}
