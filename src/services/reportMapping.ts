import type { Report, ReportStatus, QAStatus } from '@/types/radiology';
import type { ReportResponsePayload } from './reportClient';

const reportStatusValues: ReportStatus[] = ['pending', 'in_progress', 'draft', 'approved', 'finalized'];
const qaStatusValues: QAStatus[] = ['pending', 'checking', 'pass', 'warn', 'fail'];

const isReportStatus = (value?: string): value is ReportStatus =>
  Boolean(value && reportStatusValues.includes(value as ReportStatus));

const isQaStatus = (value?: string): value is QAStatus =>
  Boolean(value && qaStatusValues.includes(value as QAStatus));

export const mapReportResponse = (payload: ReportResponsePayload, existing?: Report | null): Report => ({
  id: payload.id,
  studyId: payload.study_id,
  patientId: payload.patient_id,
  status: isReportStatus(payload.status) ? payload.status : existing?.status ?? 'pending',
  findingsText: payload.findings_text ?? existing?.findingsText ?? '',
  impressionText: payload.impression_text ?? existing?.impressionText ?? '',
  createdAt: payload.created_at ?? existing?.createdAt ?? new Date().toISOString(),
  updatedAt: payload.updated_at ?? existing?.updatedAt ?? new Date().toISOString(),
  approvedAt: payload.approved_at ?? undefined,
  approvedBy: payload.approved_by ?? undefined,
  qaStatus: isQaStatus(payload.qa_status) ? payload.qa_status : existing?.qaStatus ?? 'pending',
  qaWarnings: payload.qa_warnings ?? existing?.qaWarnings ?? [],
  inferenceStatus: payload.inference_status ?? existing?.inferenceStatus,
  inferenceSummary: payload.inference_summary ?? existing?.inferenceSummary,
  inferenceConfidence: payload.inference_confidence ?? existing?.inferenceConfidence,
  inferenceModelVersion: payload.inference_model_version ?? existing?.inferenceModelVersion,
  inferenceJobId: payload.inference_job_id ?? existing?.inferenceJobId,
  inferenceCompletedAt: payload.inference_completed_at ?? existing?.inferenceCompletedAt,
  inferenceImageRefs: existing?.inferenceImageRefs,
  aiStatus: existing?.aiStatus,
});
