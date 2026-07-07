import { describe, it, expect } from "vitest";
import {
  mapStudyRecordToPatient,
  mapStudyRecordToStudy,
  mapSeriesRecordToSeries,
  type DicomJsonRecord,
} from "../dicomWebMapping";

describe("mapStudyRecordToPatient", () => {
  it("extracts and normalizes patient fields from a DICOM JSON record", () => {
    const record: DicomJsonRecord = {
      "00100020": { Value: ["MRN-123"] },
      "00100010": { Value: [{ Alphabetic: "Doe^Jane" }] },
      "00100030": { Value: ["19800115"] },
      "00100040": { Value: ["F"] },
    };

    const patient = mapStudyRecordToPatient(record, "study-1");

    expect(patient).toEqual({
      id: "MRN-123",
      name: "Doe, Jane",
      dateOfBirth: "1980-01-15",
      gender: "F",
      mrn: "MRN-123",
    });
  });

  it("falls back to defaults when tags are missing", () => {
    const patient = mapStudyRecordToPatient({}, "study-42");

    expect(patient.id).toBe("patient-study-42");
    expect(patient.name).toBe("Unbekannt");
    expect(patient.dateOfBirth).toBe("");
    expect(patient.gender).toBe("O");
  });

  it('normalizes an unrecognized gender code to "O"', () => {
    const record: DicomJsonRecord = { "00100040": { Value: ["X"] } };
    expect(mapStudyRecordToPatient(record, "study-1").gender).toBe("O");
  });

  it("formats a person name without a first-name component using just the last name", () => {
    const record: DicomJsonRecord = { "00100010": { Value: ["Doe"] } };
    expect(mapStudyRecordToPatient(record, "study-1").name).toBe("Doe");
  });
});

describe("mapStudyRecordToStudy", () => {
  it("extracts and normalizes study fields, taking the first value of a multi-valued modality tag", () => {
    const record: DicomJsonRecord = {
      "00080050": { Value: ["ACC-999"] },
      "00080061": { Value: [["CT", "PT"]] },
      "00080020": { Value: ["20260115"] },
      "00081030": { Value: ["Chest CT"] },
      "00080090": { Value: [{ Alphabetic: "Smith^John" }] },
    };

    const study = mapStudyRecordToStudy(record, "patient-1", "study-1");

    expect(study).toEqual({
      id: "study-1",
      patientId: "patient-1",
      accessionNumber: "ACC-999",
      modality: "CT",
      studyDate: "2026-01-15",
      studyDescription: "Chest CT",
      referringPhysician: "Smith, John",
      series: [],
    });
  });

  it("falls back to defaults when tags are missing, including today's date for studyDate", () => {
    const study = mapStudyRecordToStudy({}, "patient-1", "study-7");

    expect(study.accessionNumber).toBe("ACC-study-7");
    expect(study.modality).toBe("CT");
    expect(study.studyDescription).toBe("Unbekannte Studie");
    expect(study.referringPhysician).toBe("Unbekannt");
    expect(study.studyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('normalizes an unsupported modality code to the "CT" default', () => {
    const record: DicomJsonRecord = { "00080061": { Value: ["ZZ"] } };
    expect(mapStudyRecordToStudy(record, "patient-1", "study-1").modality).toBe("CT");
  });
});

describe("mapSeriesRecordToSeries", () => {
  it("extracts series fields and reads frame count from the primary tag", () => {
    const record: DicomJsonRecord = {
      "0020000E": { Value: ["series-1"] },
      "00200011": { Value: [3] },
      "0008103E": { Value: ["Axial T1"] },
      "00080060": { Value: ["MR"] },
      "00201209": { Value: [64] },
    };

    const series = mapSeriesRecordToSeries(record, "study-1");

    expect(series).toEqual({
      id: "series-1",
      studyId: "study-1",
      seriesNumber: 3,
      seriesDescription: "Axial T1",
      modality: "MR",
      frameCount: 64,
    });
  });

  it("returns null when the series instance UID tag is absent", () => {
    expect(mapSeriesRecordToSeries({}, "study-1")).toBeNull();
  });

  it("falls back to NumberOfSeriesRelatedInstances when the primary frame-count tag is present but unparseable", () => {
    // Note: readNumber(undefined) resolves to 0 (Number('') is 0, not NaN), so this fallback is
    // only reachable when the primary tag exists with a non-numeric value, not when it's absent.
    const record = {
      "0020000E": { Value: ["series-2"] },
      "00201209": { Value: ["not-a-number"] },
      NumberOfSeriesRelatedInstances: 12,
    } as unknown as DicomJsonRecord;
    expect(mapSeriesRecordToSeries(record, "study-1")?.frameCount).toBe(12);
  });

  it("defaults frameCount to 0 (not 1) when the primary frame-count tag is simply absent", () => {
    const record: DicomJsonRecord = { "0020000E": { Value: ["series-3"] } };
    expect(mapSeriesRecordToSeries(record, "study-1")?.frameCount).toBe(0);
  });

  it("defaults seriesDescription/modality/seriesNumber when their tags are missing", () => {
    const record: DicomJsonRecord = { "0020000E": { Value: ["series-4"] } };
    const series = mapSeriesRecordToSeries(record, "study-1");

    expect(series?.seriesDescription).toBe("Serie");
    expect(series?.modality).toBe("OT");
    expect(series?.seriesNumber).toBe(0);
  });
});
