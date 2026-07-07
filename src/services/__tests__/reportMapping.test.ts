import { describe, it, expect } from "vitest";
import { mapReportResponse } from "../reportMapping";
import type { ReportResponsePayload } from "../reportClient";
import type { Report } from "@/types/radiology";

const basePayload: ReportResponsePayload = {
  id: "report-1",
  study_id: "study-1",
  patient_id: "patient-1",
  status: "draft",
  findings_text: "No acute findings.",
  impression_text: "Normal study.",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  qa_status: "pass",
  qa_warnings: [],
};

describe("mapReportResponse", () => {
  it("maps a fully populated payload from snake_case to camelCase", () => {
    const payload: ReportResponsePayload = {
      ...basePayload,
      approved_at: "2026-01-03T00:00:00Z",
      approved_by: "dr-house",
      qa_warnings: ["missing laterality"],
      inference_status: "completed",
      inference_summary: "AI summary",
      inference_confidence: 0.87,
      inference_model_version: "medgemma-v2",
      inference_job_id: "job-42",
      inference_completed_at: "2026-01-02T12:00:00Z",
    };

    const report = mapReportResponse(payload);

    expect(report).toMatchObject({
      id: "report-1",
      studyId: "study-1",
      patientId: "patient-1",
      status: "draft",
      findingsText: "No acute findings.",
      impressionText: "Normal study.",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      approvedAt: "2026-01-03T00:00:00Z",
      approvedBy: "dr-house",
      qaStatus: "pass",
      qaWarnings: ["missing laterality"],
      inferenceStatus: "completed",
      inferenceSummary: "AI summary",
      inferenceConfidence: 0.87,
      inferenceModelVersion: "medgemma-v2",
      inferenceJobId: "job-42",
      inferenceCompletedAt: "2026-01-02T12:00:00Z",
    });
  });

  it("falls back to a default status/qaStatus when the payload value is not a recognized enum member", () => {
    const payload: ReportResponsePayload = {
      ...basePayload,
      status: "not-a-real-status",
      qa_status: "not-a-real-qa-status",
    };

    const report = mapReportResponse(payload);

    expect(report.status).toBe("pending");
    expect(report.qaStatus).toBe("pending");
  });

  it("falls back to the existing report value when the payload status is invalid", () => {
    const payload: ReportResponsePayload = { ...basePayload, status: "bogus" };
    const existing = { status: "approved" } as Report;

    const report = mapReportResponse(payload, existing);

    expect(report.status).toBe("approved");
  });

  it("preserves client-only inference fields from the existing report since the API payload never carries them", () => {
    const existing = {
      inferenceImageRefs: [
        {
          studyId: "s",
          seriesId: "se",
          instanceId: "i",
          frameIndex: 0,
          stackIndex: 0,
          wadoUrl: "u",
        },
      ],
      inferenceEvidenceIndices: [1, 2, 3],
      inferenceMetadata: { foo: "bar" },
      aiStatus: "idle",
    } as unknown as Report;

    const report = mapReportResponse(basePayload, existing);

    expect(report.inferenceImageRefs).toBe(existing.inferenceImageRefs);
    expect(report.inferenceEvidenceIndices).toBe(existing.inferenceEvidenceIndices);
    expect(report.inferenceMetadata).toBe(existing.inferenceMetadata);
    expect(report.aiStatus).toBe("idle");
  });

  it("defaults findingsText/impressionText/qaWarnings to empty when absent and no existing report is given", () => {
    const payload: ReportResponsePayload = {
      ...basePayload,
      findings_text: undefined as unknown as string,
      impression_text: undefined as unknown as string,
      qa_warnings: undefined as unknown as string[],
    };

    const report = mapReportResponse(payload);

    expect(report.findingsText).toBe("");
    expect(report.impressionText).toBe("");
    expect(report.qaWarnings).toEqual([]);
  });
});
