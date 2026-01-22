export const DICOM_WEB_URL = import.meta.env.VITE_DICOM_WEB_URL ?? 'http://localhost:8042/dicom-web';
const DICOM_WEB_INFERENCE_URL = import.meta.env.VITE_DICOM_WEB_INFERENCE_URL ?? DICOM_WEB_URL;
const DICOM_WEB_USERNAME = import.meta.env.VITE_DICOM_WEB_USERNAME;
const DICOM_WEB_PASSWORD = import.meta.env.VITE_DICOM_WEB_PASSWORD;

const buildAuthHeaders = () => {
  if (!DICOM_WEB_USERNAME || !DICOM_WEB_PASSWORD) {
    return {};
  }
  const token = btoa(`${DICOM_WEB_USERNAME}:${DICOM_WEB_PASSWORD}`);
  return { Authorization: `Basic ${token}` };
};

const buildDicomWebUrl = (
  path: string,
  query?: Record<string, string | number | undefined>,
  baseOverride?: string
) => {
  const baseUrl = baseOverride ?? DICOM_WEB_URL;
  const resolvedBaseUrl =
    typeof window !== 'undefined' && baseUrl.startsWith('/')
      ? `${window.location.origin}${baseUrl}`
      : baseUrl;
  const base = resolvedBaseUrl.endsWith('/') ? resolvedBaseUrl : `${resolvedBaseUrl}/`;
  const sanitizedPath = path.replace(/^\//, '');
  const url = new URL(sanitizedPath, base);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

const fetchDicomWebJson = async (path: string, query?: Record<string, string | number | undefined>) => {
  const response = await fetch(buildDicomWebUrl(path, query), {
    headers: buildAuthHeaders(),
  });
  if (response.ok) {
    return response.json();
  }

  if (query?.includefield) {
    const fallbackResponse = await fetch(buildDicomWebUrl(path), {
      headers: buildAuthHeaders(),
    });
    if (fallbackResponse.ok) {
      return fallbackResponse.json();
    }
  }

  throw new Error(`Failed to fetch DICOMweb resource: ${path}`);
};

export const buildWadorsImageId = (
  studyId: string,
  seriesId: string,
  instanceId: string,
  frame = 1
) => `wadors:${buildDicomWebUrl(`studies/${studyId}/series/${seriesId}/instances/${instanceId}/frames/${frame}`)}`;

export const buildWadorsFrameUrl = (
  studyId: string,
  seriesId: string,
  instanceId: string,
  frame = 1
) =>
  buildDicomWebUrl(
    `studies/${studyId}/series/${seriesId}/instances/${instanceId}/frames/${frame}`,
    undefined,
    DICOM_WEB_INFERENCE_URL
  );

interface ListStudiesOptions {
  limit?: number;
  patientId?: string;
  studyId?: string;
}

export const orthancClient = {
  async listSeries(studyId: string) {
    return fetchDicomWebJson(`studies/${studyId}/series`, { includefield: 'all' });
  },

  async listInstances(studyId: string, seriesId: string) {
    return fetchDicomWebJson(`studies/${studyId}/series/${seriesId}/instances`, { includefield: 'all' });
  },

  async fetchInstanceFrame(studyId: string, seriesId: string, instanceId: string) {
    const response = await fetch(
      buildDicomWebUrl(`studies/${studyId}/series/${seriesId}/instances/${instanceId}/frames/1`),
      {
        headers: buildAuthHeaders(),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch instance frame');
    }
    return response.arrayBuffer();
  },

  async listStudies(options: ListStudiesOptions = {}) {
    const { limit = 25, patientId, studyId } = options;
    return fetchDicomWebJson('studies', {
      includefield: 'all',
      limit,
      PatientID: patientId,
      StudyInstanceUID: studyId,
    });
  },
};
