import type { Patient, Series, Study } from '@/types/radiology';

export type DicomJsonRecord = Record<string, { Value?: unknown[] }>;

const getTagValue = (record: DicomJsonRecord, tag: string) => {
  const entry = record[tag];
  if (entry && Array.isArray(entry.Value) && entry.Value.length > 0) {
    return entry.Value[0];
  }
  return undefined;
};

const toText = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.Alphabetic === 'string') {
      return record.Alphabetic;
    }
  }
  return '';
};

const formatPersonName = (value: unknown) => {
  const raw = toText(value);
  if (!raw) return '';
  if (raw.includes('^')) {
    const [last, first] = raw.split('^');
    if (!first) return last;
    return `${last}, ${first}`.trim();
  }
  return raw;
};

const formatDicomDate = (value: unknown) => {
  const raw = toText(value);
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return raw;
};

const normalizeGender = (value: unknown): Patient['gender'] => {
  const raw = toText(value).toUpperCase();
  if (raw === 'M' || raw === 'F' || raw === 'O') {
    return raw as Patient['gender'];
  }
  return 'O';
};

const normalizeModality = (value: unknown): Study['modality'] => {
  const raw = toText(value).toUpperCase();
  const allowed: Study['modality'][] = ['CT', 'MR', 'CR', 'DX', 'US', 'NM', 'PT'];
  return (allowed.includes(raw as Study['modality']) ? raw : 'CT') as Study['modality'];
};

const normalizeSeriesModality = (value: unknown): Series['modality'] => {
  const raw = toText(value).toUpperCase();
  return raw || 'OT';
};

const readNumber = (value: unknown) => {
  const parsed = Number(toText(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const mapStudyRecordToPatient = (record: DicomJsonRecord, studyId: string): Patient => {
  const patientId = toText(getTagValue(record, '00100020')) || `patient-${studyId}`;
  const patientName = formatPersonName(getTagValue(record, '00100010')) || 'Unbekannt';
  const dob = formatDicomDate(getTagValue(record, '00100030'));
  const mrn = patientId;

  return {
    id: patientId,
    name: patientName,
    dateOfBirth: dob || '',
    gender: normalizeGender(getTagValue(record, '00100040')),
    mrn,
  };
};

export const mapStudyRecordToStudy = (
  record: DicomJsonRecord,
  patientId: string,
  studyId: string
): Study => {
  const accessionNumber = toText(getTagValue(record, '00080050')) || `ACC-${studyId}`;
  const modalities = getTagValue(record, '00080061');
  const modality = Array.isArray(modalities) ? modalities[0] : modalities;

  return {
    id: studyId,
    patientId,
    accessionNumber,
    modality: normalizeModality(modality),
    studyDate: formatDicomDate(getTagValue(record, '00080020')) || new Date().toISOString().slice(0, 10),
    studyDescription: toText(getTagValue(record, '00081030')) || 'Unbekannte Studie',
    referringPhysician: formatPersonName(getTagValue(record, '00080090')) || 'Unbekannt',
    series: [],
  };
};

export const mapSeriesRecordToSeries = (
  record: DicomJsonRecord,
  studyId: string
): Series | null => {
  const seriesId = toText(getTagValue(record, '0020000E'));
  if (!seriesId) {
    return null;
  }

  const seriesNumber = readNumber(getTagValue(record, '00200011')) ?? 0;
  const frameCount =
    readNumber(getTagValue(record, '00201209')) ??
    readNumber((record as Record<string, unknown>).NumberOfSeriesRelatedInstances) ??
    1;

  return {
    id: seriesId,
    studyId,
    seriesNumber,
    seriesDescription: toText(getTagValue(record, '0008103E')) || 'Serie',
    modality: normalizeSeriesModality(getTagValue(record, '00080060')),
    frameCount,
  };
};
