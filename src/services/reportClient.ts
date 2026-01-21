const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const SR_EXPORT_ENDPOINT = import.meta.env.VITE_SR_EXPORT_URL ?? '/api/v1/reports';

const buildUrl = (path: string) => new URL(path, API_BASE_URL || window.location.origin).toString();

const getFileNameFromDisposition = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
};

export interface SrExportResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export const reportClient = {
  async exportStructuredReport(reportId: string): Promise<SrExportResult> {
    const response = await fetch(buildUrl(`${SR_EXPORT_ENDPOINT}/${reportId}/export-sr`), {
      method: 'GET',
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'DICOM SR export failed');
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/dicom+json';
    const fileName =
      getFileNameFromDisposition(response.headers.get('content-disposition')) ??
      `report-${reportId}-sr.json`;

    return { blob, fileName, contentType };
  },
};
