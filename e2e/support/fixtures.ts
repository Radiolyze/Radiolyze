/**
 * DICOMweb and report fixtures for the core-workflow E2E specs.
 *
 * The shapes here mirror what Orthanc's DICOMweb endpoints and the backend's
 * `/api/v1/reports` return, so `dicomWebMapping.ts` and `reportMapping.ts` do
 * the same work against these as against a live stack.
 */

/**
 * The report wire format, declared here rather than imported from
 * `src/services/reportClient` on purpose: these specs are a black-box client of
 * the HTTP contract, so they should fail when the *wire format* changes, not
 * when an internal type is refactored. (The e2e project also deliberately
 * excludes `src` from its tsconfig.)
 */
export interface ReportPayload {
  id: string;
  study_id: string;
  patient_id: string;
  status: string;
  findings_text: string;
  impression_text: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  qa_status: string;
  qa_warnings: string[];
}

/** DICOM JSON: a tag entry is `{ vr, Value: [...] }`. */
type TagValue = { Value?: unknown[] };
export type DicomRecord = Record<string, TagValue>;

export interface SeriesFixture {
  uid: string;
  number: number;
  description: string;
  modality: string;
  /** One entry per instance; each instance contributes one frame. */
  instanceUids: string[];
}

export interface StudyFixture {
  uid: string;
  patientId: string;
  /** DICOM person name, e.g. `Doe^Jane`. */
  patientName: string;
  /** How `formatPersonName` renders `patientName` in the UI. */
  patientDisplayName: string;
  patientBirthDate: string;
  patientSex: "M" | "F" | "O";
  accessionNumber: string;
  studyDate: string;
  description: string;
  modality: string;
  series: SeriesFixture[];
}

export const STUDY_CT: StudyFixture = {
  uid: "1.2.826.0.1.3680043.8.498.10000001",
  patientId: "PAT-0001",
  patientName: "Doe^Jane",
  patientDisplayName: "Doe, Jane",
  patientBirthDate: "19710304",
  patientSex: "F",
  accessionNumber: "ACC-10001",
  studyDate: "20260715",
  description: "CT Thorax",
  modality: "CT",
  series: [
    {
      uid: "1.2.826.0.1.3680043.8.498.10000001.1",
      number: 1,
      description: "Topogram",
      modality: "CT",
      instanceUids: ["1.2.826.0.1.3680043.8.498.10000001.1.1"],
    },
    {
      uid: "1.2.826.0.1.3680043.8.498.10000001.2",
      number: 2,
      description: "Thorax 1.0 B70f",
      modality: "CT",
      instanceUids: [
        "1.2.826.0.1.3680043.8.498.10000001.2.1",
        "1.2.826.0.1.3680043.8.498.10000001.2.2",
        "1.2.826.0.1.3680043.8.498.10000001.2.3",
      ],
    },
  ],
};

export const STUDY_CR: StudyFixture = {
  uid: "1.2.826.0.1.3680043.8.498.20000002",
  patientId: "PAT-0002",
  patientName: "Roe^Richard",
  patientDisplayName: "Roe, Richard",
  patientBirthDate: "19580912",
  patientSex: "M",
  accessionNumber: "ACC-20002",
  studyDate: "20260721",
  description: "Thorax PA",
  modality: "CR",
  series: [
    {
      uid: "1.2.826.0.1.3680043.8.498.20000002.1",
      number: 1,
      description: "Thorax PA stehend",
      modality: "CR",
      instanceUids: ["1.2.826.0.1.3680043.8.498.20000002.1.1"],
    },
  ],
};

export const STUDIES: StudyFixture[] = [STUDY_CT, STUDY_CR];

/** The report id `useDicomWebQueue` derives for a study. */
export const reportIdForStudy = (study: StudyFixture) => `report-${study.uid}`;

export const qidoStudyRecord = (study: StudyFixture): DicomRecord => ({
  "0020000D": { Value: [study.uid] },
  "00100020": { Value: [study.patientId] },
  "00100010": { Value: [{ Alphabetic: study.patientName }] },
  "00100030": { Value: [study.patientBirthDate] },
  "00100040": { Value: [study.patientSex] },
  "00080050": { Value: [study.accessionNumber] },
  "00080020": { Value: [study.studyDate] },
  "00080030": { Value: ["101500"] },
  "00080061": { Value: [study.modality] },
  "00081030": { Value: [study.description] },
  "00080090": { Value: [{ Alphabetic: "Ref^Physician" }] },
});

export const qidoSeriesRecord = (series: SeriesFixture): DicomRecord => ({
  "0020000E": { Value: [series.uid] },
  "00200011": { Value: [series.number] },
  "0008103E": { Value: [series.description] },
  "00080060": { Value: [series.modality] },
  "00201209": { Value: [series.instanceUids.length] },
});

export const qidoInstanceRecord = (instanceUid: string, instanceNumber: number): DicomRecord => ({
  "00080018": { Value: [instanceUid] },
  "00200013": { Value: [instanceNumber] },
  "00280008": { Value: ["1"] },
  "00280030": { Value: [0.68, 0.68] },
  "00180050": { Value: [1] },
  "00200032": { Value: [-150, -150, instanceNumber * 1.0] },
  "00201041": { Value: [instanceNumber * 1.0] },
});

/** Total frames a series contributes to the viewer stack. */
export const frameCount = (series: SeriesFixture) => series.instanceUids.length;

export const buildReport = (
  study: StudyFixture,
  overrides: Partial<ReportPayload> = {},
): ReportPayload => ({
  id: reportIdForStudy(study),
  study_id: study.uid,
  patient_id: study.patientId,
  status: "pending",
  findings_text: "",
  impression_text: "",
  created_at: "2026-07-21T10:15:00+00:00",
  updated_at: "2026-07-21T10:15:00+00:00",
  approved_at: null,
  approved_by: null,
  qa_status: "pending",
  qa_warnings: [],
  ...overrides,
});
