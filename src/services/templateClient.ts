import { apiClient } from './apiClient';

const TEMPLATES_ENDPOINT = '/api/v1/report-templates';

export interface TemplatePayload {
  id: string;
  name: string;
  modality?: string | null;
  bodyRegion?: string | null;
  description?: string | null;
  templateText: string;
  sections: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PopulatePayload {
  templateId: string;
  modality?: string;
  bodyPart?: string;
  studyDescription?: string;
  comparisonDate?: string;
  patientAge?: string;
  patientSex?: string;
}

export interface PopulateResult {
  text: string;
  template_id: string;
  template_name: string;
}

export const templateClient = {
  async listTemplates(modality?: string): Promise<TemplatePayload[]> {
    return apiClient.get<TemplatePayload[]>(TEMPLATES_ENDPOINT, {
      query: { modality, activeOnly: true },
    });
  },

  async createTemplate(payload: {
    name: string;
    modality?: string;
    bodyRegion?: string;
    description?: string;
    templateText: string;
    sections: string[];
  }): Promise<TemplatePayload> {
    return apiClient.post<TemplatePayload>(TEMPLATES_ENDPOINT, payload);
  },

  async populateTemplate(payload: PopulatePayload): Promise<PopulateResult> {
    return apiClient.post<PopulateResult>(`${TEMPLATES_ENDPOINT}/populate`, payload);
  },
};
