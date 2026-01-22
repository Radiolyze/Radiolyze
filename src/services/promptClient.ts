import { apiClient } from './apiClient';
import type { PromptList, PromptTemplate, PromptType } from '@/types/prompts';
import { mapPromptListResponse, mapPromptTemplateResponse, type PromptListResponsePayload, type PromptTemplateResponsePayload } from './promptMapping';

const PROMPT_LIST_ENDPOINT = import.meta.env.VITE_PROMPT_LIST_URL ?? '/api/v1/prompts';
const PROMPT_ENDPOINT = import.meta.env.VITE_PROMPT_URL ?? '/api/v1/prompts';

export interface PromptUpdatePayload {
  templateText: string;
  name?: string;
  actorId?: string;
}

export const promptClient = {
  async listPrompts(): Promise<PromptList> {
    const payload = await apiClient.get<PromptListResponsePayload>(PROMPT_LIST_ENDPOINT);
    return mapPromptListResponse(payload);
  },
  async getPrompt(promptType: PromptType): Promise<PromptTemplate> {
    const payload = await apiClient.get<PromptTemplateResponsePayload>(`${PROMPT_ENDPOINT}/${promptType}`);
    return mapPromptTemplateResponse(payload);
  },
  async updatePrompt(promptType: PromptType, payload: PromptUpdatePayload): Promise<PromptTemplate> {
    const response = await apiClient.put<PromptTemplateResponsePayload>(`${PROMPT_ENDPOINT}/${promptType}`, {
      templateText: payload.templateText,
      name: payload.name,
      actorId: payload.actorId,
    });
    return mapPromptTemplateResponse(response);
  },
};
