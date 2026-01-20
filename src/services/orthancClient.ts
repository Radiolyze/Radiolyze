export const DICOM_WEB_URL = import.meta.env.VITE_DICOM_WEB_URL ?? 'http://localhost:8042/dicom-web';

const buildDicomWebUrl = (path: string, query?: Record<string, string | number | undefined>) => {
  const base = DICOM_WEB_URL.endsWith('/') ? DICOM_WEB_URL : `${DICOM_WEB_URL}/`;
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
  const response = await fetch(buildDicomWebUrl(path, query));
  if (response.ok) {
    return response.json();
  }

  if (query?.includefield) {
    const fallbackResponse = await fetch(buildDicomWebUrl(path));
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

export const orthancClient = {
  async listSeries(studyId: string) {
    return fetchDicomWebJson(`studies/${studyId}/series`, { includefield: 'all' });
  },

  async listInstances(studyId: string, seriesId: string) {
    return fetchDicomWebJson(`studies/${studyId}/series/${seriesId}/instances`, { includefield: 'all' });
  },

  async fetchInstanceFrame(studyId: string, seriesId: string, instanceId: string) {
    const response = await fetch(
      buildDicomWebUrl(`studies/${studyId}/series/${seriesId}/instances/${instanceId}/frames/1`)
    );
    if (!response.ok) {
      throw new Error('Failed to fetch instance frame');
    }
    return response.arrayBuffer();
  },

  async listStudies(limit = 25) {
    return fetchDicomWebJson('studies', { includefield: 'all', limit });
  },
};
