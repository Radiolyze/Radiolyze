import { apiClient } from './apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const REPORTS_ENDPOINT = import.meta.env.VITE_REPORTS_URL ?? '/api/v1/reports';
const SR_EXPORT_ENDPOINT = import.meta.env.VITE_SR_EXPORT_URL ?? '/api/v1/reports';

const buildUrl = (path: string) => new URL(path, API_BASE_URL || window.location.origin).toString();

const getFileNameFromDisposition = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
};

export type SrExportFormat = 'json' | 'dicom';

export interface SrExportResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface ReportResponsePayload {
  id: string;
  study_id: string;
  patient_id: string;
  status: string;
  findings_text: string;
  impression_text: string;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  qa_status: string;
  qa_warnings: string[];
  inference_status?: string | null;
  inference_summary?: string | null;
  inference_confidence?: number | null;
  inference_model_version?: string | null;
  inference_job_id?: string | null;
  inference_completed_at?: string | null;
}

export interface ReportUpdatePayload {
  findingsText?: string;
  impressionText?: string;
  status?: string;
  actorId?: string;
}

export const reportClient = {
  async finalizeReport(reportId: string, signature?: string): Promise<ReportResponsePayload> {
    return apiClient.post<ReportResponsePayload>(`${REPORTS_ENDPOINT}/${reportId}/finalize`, {
      approvedBy: signature,
      signature,
    });
  },
  async updateReport(reportId: string, payload: ReportUpdatePayload): Promise<ReportResponsePayload> {
    return apiClient.patch<ReportResponsePayload>(`${REPORTS_ENDPOINT}/${reportId}`, {
      findings_text: payload.findingsText,
      impression_text: payload.impressionText,
      status: payload.status,
      actorId: payload.actorId,
    });
  },
  async exportStructuredReport(reportId: string, format: SrExportFormat = 'dicom'): Promise<SrExportResult> {
    const response = await fetch(
      buildUrl(`${SR_EXPORT_ENDPOINT}/${reportId}/export-sr?format=${format}`),
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'DICOM SR export failed');
    }

    const blob = await response.blob();
    const fallbackType = format === 'dicom' ? 'application/dicom' : 'application/dicom+json';
    const contentType = response.headers.get('content-type') || fallbackType;
    const fileName =
      getFileNameFromDisposition(response.headers.get('content-disposition')) ??
      `report-${reportId}-sr.${format === 'dicom' ? 'dcm' : 'json'}`;

    return { blob, fileName, contentType };
  },
};
