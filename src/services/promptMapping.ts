import type { PromptList, PromptSource, PromptTemplate, PromptType } from '@/types/prompts';

const promptTypes: PromptType[] = ['system', 'summary', 'impression'];

const isPromptType = (value?: string): value is PromptType =>
  Boolean(value && promptTypes.includes(value as PromptType));

const readString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const readNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);
const readBoolean = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);

export type PromptTemplateResponsePayload = {
  prompt_type?: string;
  promptType?: string;
  name?: string;
  template_text?: string;
  templateText?: string;
  version?: number | null;
  is_active?: boolean;
  isActive?: boolean;
  variables?: string[];
  created_by?: string | null;
  createdBy?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  source?: PromptSource;
  default_text?: string;
  defaultText?: string;
  editable?: boolean;
  max_length?: number;
  maxLength?: number;
  allowed_variables?: string[];
  allowedVariables?: string[];
};

export type PromptListResponsePayload = {
  editable?: boolean;
  max_length?: number;
  maxLength?: number;
  allowed_variables?: Record<string, string[]>;
  allowedVariables?: Record<string, string[]>;
  prompts?: PromptTemplateResponsePayload[];
};

export const mapPromptTemplateResponse = (payload: PromptTemplateResponsePayload): PromptTemplate => {
  const promptType = isPromptType(payload.promptType)
    ? payload.promptType
    : isPromptType(payload.prompt_type)
      ? payload.prompt_type
      : 'summary';
  const source = (payload.source as PromptSource) ?? 'default';
  return {
    promptType,
    name: readString(payload.name, `${promptType}-template`),
    templateText: readString(payload.templateText ?? payload.template_text),
    version: readNumber(payload.version) ?? payload.version ?? null,
    isActive: readBoolean(payload.isActive ?? payload.is_active, true),
    variables: Array.isArray(payload.variables) ? payload.variables : [],
    createdBy: readString(payload.createdBy ?? payload.created_by, ''),
    createdAt: readString(payload.createdAt ?? payload.created_at, ''),
    updatedAt: readString(payload.updatedAt ?? payload.updated_at, ''),
    source,
    defaultText: readString(payload.defaultText ?? payload.default_text),
    editable: readBoolean(payload.editable, false),
    maxLength: typeof payload.maxLength === 'number'
      ? payload.maxLength
      : typeof payload.max_length === 'number'
        ? payload.max_length
        : 4000,
    allowedVariables: Array.isArray(payload.allowedVariables)
      ? payload.allowedVariables
      : Array.isArray(payload.allowed_variables)
        ? payload.allowed_variables
        : [],
  };
};

const normalizeAllowedVariables = (
  raw?: Record<string, string[]>
): Record<PromptType, string[]> => {
  const allowed: Record<PromptType, string[]> = {
    system: [],
    summary: [],
    impression: [],
  };
  if (!raw) return allowed;
  Object.entries(raw).forEach(([key, values]) => {
    if (isPromptType(key) && Array.isArray(values)) {
      allowed[key] = values;
    }
  });
  return allowed;
};

export const mapPromptListResponse = (payload: PromptListResponsePayload): PromptList => {
  const prompts = Array.isArray(payload.prompts) ? payload.prompts.map(mapPromptTemplateResponse) : [];
  return {
    editable: readBoolean(payload.editable, false),
    maxLength: typeof payload.maxLength === 'number'
      ? payload.maxLength
      : typeof payload.max_length === 'number'
        ? payload.max_length
        : 4000,
    allowedVariables: normalizeAllowedVariables(payload.allowedVariables ?? payload.allowed_variables),
    prompts,
  };
};
