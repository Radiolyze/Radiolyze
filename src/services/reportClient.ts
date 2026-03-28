import { apiClient } from './apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const REPORTS_CREATE_ENDPOINT = import.meta.env.VITE_REPORTS_CREATE_URL ?? '/api/v1/reports/create';
const REPORTS_ENDPOINT = import.meta.env.VITE_REPORTS_URL ?? '/api/v1/reports';
const SR_EXPORT_ENDPOINT = import.meta.env.VITE_SR_EXPORT_URL ?? '/api/v1/reports';

const buildUrl = (path: string) => new URL(path, API_BASE_URL || window.location.origin).toString();

/** Build auth headers matching apiClient's pattern. */
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('medgemma-auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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

export interface ReportCreatePayload {
  reportId?: string;
  studyId: string;
  patientId: string;
  status?: string;
  findingsText?: string;
  impressionText?: string;
}

interface ReportListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ReportRevisionPayload {
  id: string;
  report_id: string;
  findings_text: string;
  impression_text: string;
  changed_by: string | null;
  changed_at: string;
  change_reason: string | null;
}

export interface PdfExportResult {
  blob: Blob;
  fileName: string;
}

export const reportClient = {
  async getReport(reportId: string): Promise<ReportResponsePayload> {
    return apiClient.get<ReportResponsePayload>(`${REPORTS_ENDPOINT}/${reportId}`);
  },
  async listReports(params: ReportListParams = {}): Promise<ReportResponsePayload[]> {
    return apiClient.get<ReportResponsePayload[]>(REPORTS_ENDPOINT, {
      query: {
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      },
    });
  },
  async createReport(payload: ReportCreatePayload): Promise<ReportResponsePayload> {
    return apiClient.post<ReportResponsePayload>(REPORTS_CREATE_ENDPOINT, {
      report_id: payload.reportId,
      study_id: payload.studyId,
      patient_id: payload.patientId,
      status: payload.status,
      findings_text: payload.findingsText,
      impression_text: payload.impressionText,
    });
  },
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
        headers: authHeaders(),
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
  async getRevisions(reportId: string): Promise<ReportRevisionPayload[]> {
    return apiClient.get<ReportRevisionPayload[]>(`${REPORTS_ENDPOINT}/${reportId}/revisions`);
  },
  async getReportsByPatient(patientId: string, limit = 20): Promise<ReportResponsePayload[]> {
    return apiClient.get<ReportResponsePayload[]>(
      `${REPORTS_ENDPOINT}/by-patient/${patientId}`,
      { query: { limit } },
    );
  },
  async exportPdf(reportId: string): Promise<PdfExportResult> {
    const response = await fetch(
      buildUrl(`${REPORTS_ENDPOINT}/${reportId}/export-pdf`),
      { method: 'GET', headers: authHeaders() }
    );
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'PDF export failed');
    }
    const blob = await response.blob();
    const fileName =
      getFileNameFromDisposition(response.headers.get('content-disposition')) ??
      `report-${reportId}.pdf`;
    return { blob, fileName };
  },

  /**
   * Stream impression tokens via SSE.
   *
   * Returns an async generator that yields text chunks as the model produces
   * them. Falls back to a single non-streaming response when streaming is not
   * supported.
   *
   * @example
   * let text = '';
   * for await (const chunk of reportClient.streamImpression({ findingsText })) {
   *   text += chunk;
   *   setImpression(text);
   * }
   */
  async *streamImpression(params: {
    findingsText?: string;
    imageUrls?: string[];
    reportId?: string;
  }): AsyncGenerator<string> {
    const body = JSON.stringify({
      findings_text: params.findingsText ?? '',
      image_urls: params.imageUrls ?? [],
      report_id: params.reportId,
    });

    const response = await fetch(buildUrl('/api/v1/reports/stream-impression'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body,
    });

    if (!response.ok || !response.body) {
      const msg = await response.text().catch(() => 'Unknown error');
      throw new Error(`Stream impression failed (${response.status}): ${msg}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice('data:'.length).trim();
        if (payload === '[DONE]') return;
        // Restore escaped newlines
        yield payload.replace(/\\n/g, '\n');
      }
    }
  },
};
