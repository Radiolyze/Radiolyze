export type PromptType = 'system' | 'summary' | 'impression';

export type PromptSource = 'db' | 'env' | 'default';

export interface PromptTemplate {
  promptType: PromptType;
  name: string;
  templateText: string;
  version?: number | null;
  isActive: boolean;
  variables: string[];
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source: PromptSource;
  defaultText: string;
  editable: boolean;
  maxLength: number;
  allowedVariables: string[];
}

export interface PromptList {
  editable: boolean;
  maxLength: number;
  allowedVariables: Record<PromptType, string[]>;
  prompts: PromptTemplate[];
}
