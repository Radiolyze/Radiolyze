const DICOM_WEB_URL = import.meta.env.VITE_DICOM_WEB_URL ?? 'http://localhost:8042/dicom-web';

export const orthancClient = {
  async listSeries(studyId: string) {
    const response = await fetch(`${DICOM_WEB_URL}/studies/${studyId}/series`);
    if (!response.ok) {
      throw new Error('Failed to fetch series list');
    }
    return response.json();
  },

  async listInstances(studyId: string, seriesId: string) {
    const response = await fetch(`${DICOM_WEB_URL}/studies/${studyId}/series/${seriesId}/instances`);
    if (!response.ok) {
      throw new Error('Failed to fetch instances list');
    }
    return response.json();
  },

  async fetchInstanceFrame(studyId: string, seriesId: string, instanceId: string) {
    const response = await fetch(
      `${DICOM_WEB_URL}/studies/${studyId}/series/${seriesId}/instances/${instanceId}/frames/1`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch instance frame');
    }
    return response.arrayBuffer();
  },
};
