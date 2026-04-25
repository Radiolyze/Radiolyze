import { apiClient } from './apiClient';

export interface GuidelinePayload {
  id: string;
  title: string;
  category: string;
  body: string;
  source?: string | null;
  keywords?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const guidelinesClient = {
  async search(q: string, category?: string, limit = 20): Promise<GuidelinePayload[]> {
    const params = new URLSearchParams({ q });
    if (category) params.set('category', category);
    params.set('limit', String(limit));
    return apiClient.get<GuidelinePayload[]>(`/api/v1/guidelines/search?${params}`);
  },

  /** Vector similarity search; server falls back to ILIKE automatically. */
  async semanticSearch(q: string, category?: string, limit = 20): Promise<GuidelinePayload[]> {
    const params = new URLSearchParams({ q });
    if (category) params.set('category', category);
    params.set('limit', String(limit));
    return apiClient.get<GuidelinePayload[]>(`/api/v1/guidelines/semantic-search?${params}`);
  },

  async list(limit = 50): Promise<GuidelinePayload[]> {
    return apiClient.get<GuidelinePayload[]>(`/api/v1/guidelines?limit=${limit}`);
  },
};
