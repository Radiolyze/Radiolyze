import { useEffect, useMemo, useState } from 'react';
import { orthancClient } from '@/services/orthancClient';
import type { DicomJsonRecord } from '@/services/dicomWebMapping';
import { mapStudyRecordToPatient, mapStudyRecordToStudy } from '@/services/dicomWebMapping';

export interface StudyLookupEntry {
  studyId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  accessionNumber: string;
  modality: string;
  studyDescription: string;
  studyDate: string;
  referringPhysician: string;
}

const buildFallbackEntry = (studyId: string): StudyLookupEntry => ({
  studyId,
  patientId: `patient-${studyId}`,
  patientName: 'Unbekannt',
  mrn: `MRN-${studyId.slice(0, 8)}`,
  accessionNumber: `ACC-${studyId.slice(0, 8)}`,
  modality: 'CT',
  studyDescription: 'Unbekannte Studie',
  studyDate: new Date().toISOString().slice(0, 10),
  referringPhysician: 'Unbekannt',
});

const resolveStudyId = (record: DicomJsonRecord, fallback: string) =>
  (record['0020000D']?.Value?.[0] as string | undefined) ||
  (record.StudyInstanceUID as string | undefined) ||
  fallback;

export function useStudyLookup(studyIds: string[]) {
  const [studyMap, setStudyMap] = useState<Record<string, StudyLookupEntry>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueIds = useMemo(
    () => Array.from(new Set(studyIds.filter(Boolean))),
    [studyIds]
  );

  useEffect(() => {
    let isActive = true;
    const missingIds = uniqueIds.filter((id) => !studyMap[id]);

    if (missingIds.length === 0) {
      return;
    }

    const loadStudies = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          missingIds.map(async (studyId) => {
            const response = await orthancClient.listStudies({ studyId, limit: 1 });
            const records = Array.isArray(response)
              ? response
              : Array.isArray((response as { Studies?: unknown[] }).Studies)
                ? (response as { Studies: unknown[] }).Studies
                : [];
            const record = records[0];
            if (!record) {
              return { id: studyId, entry: buildFallbackEntry(studyId) };
            }

            if (typeof record === 'string') {
              return { id: studyId, entry: buildFallbackEntry(record) };
            }

            const dicomRecord = record as DicomJsonRecord;
            const resolvedStudyId = resolveStudyId(dicomRecord, studyId);
            const patient = mapStudyRecordToPatient(dicomRecord, resolvedStudyId);
            const study = mapStudyRecordToStudy(dicomRecord, patient.id, resolvedStudyId);

            return {
              id: studyId,
              entry: {
                studyId: study.id,
                patientId: patient.id,
                patientName: patient.name,
                mrn: patient.mrn,
                accessionNumber: study.accessionNumber,
                modality: study.modality,
                studyDescription: study.studyDescription,
                studyDate: study.studyDate,
                referringPhysician: study.referringPhysician,
              },
            };
          })
        );

        if (!isActive) return;

        setStudyMap((prev) => {
          const next = { ...prev };
          results.forEach(({ id, entry }) => {
            next[id] = entry;
          });
          return next;
        });
      } catch (err) {
        console.warn('Failed to load study lookup', err);
        if (isActive) {
          setError('Studieninformationen konnten nicht geladen werden.');
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
  }, [studyMap, uniqueIds]);

  return { studyMap, isLoading, error };
}
