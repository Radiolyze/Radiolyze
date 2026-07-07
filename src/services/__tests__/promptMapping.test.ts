import { describe, it, expect } from 'vitest';
import {
  mapPromptTemplateResponse,
  mapPromptListResponse,
  type PromptTemplateResponsePayload,
  type PromptListResponsePayload,
} from '../promptMapping';

describe('mapPromptTemplateResponse', () => {
  it('maps a snake_case payload to a PromptTemplate', () => {
    const payload: PromptTemplateResponsePayload = {
      prompt_type: 'impression',
      name: 'impression-v2',
      template_text: 'Summarize: {{findings}}',
      version: 2,
      is_active: true,
      variables: ['findings'],
      created_by: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      source: 'db',
      default_text: 'default',
      editable: true,
      max_length: 2000,
      allowed_variables: ['findings', 'patientAge'],
    };

    expect(mapPromptTemplateResponse(payload)).toEqual({
      promptType: 'impression',
      name: 'impression-v2',
      templateText: 'Summarize: {{findings}}',
      version: 2,
      isActive: true,
      variables: ['findings'],
      createdBy: 'admin',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      source: 'db',
      defaultText: 'default',
      editable: true,
      maxLength: 2000,
      allowedVariables: ['findings', 'patientAge'],
    });
  });

  it('prefers camelCase fields over snake_case when both are present', () => {
    const payload: PromptTemplateResponsePayload = {
      promptType: 'system',
      prompt_type: 'summary',
      templateText: 'camel',
      template_text: 'snake',
      isActive: false,
      is_active: true,
      maxLength: 100,
      max_length: 4000,
    };

    const result = mapPromptTemplateResponse(payload);

    expect(result.promptType).toBe('system');
    expect(result.templateText).toBe('camel');
    expect(result.isActive).toBe(false);
    expect(result.maxLength).toBe(100);
  });

  it('falls back to "summary" prompt type and sensible defaults when fields are missing', () => {
    const result = mapPromptTemplateResponse({});

    expect(result.promptType).toBe('summary');
    expect(result.name).toBe('summary-template');
    expect(result.templateText).toBe('');
    expect(result.version).toBeNull();
    expect(result.isActive).toBe(true);
    expect(result.variables).toEqual([]);
    expect(result.editable).toBe(false);
    expect(result.maxLength).toBe(4000);
    expect(result.allowedVariables).toEqual([]);
  });

  it('ignores an unrecognized prompt_type value and falls back to "summary"', () => {
    const result = mapPromptTemplateResponse({ prompt_type: 'not-a-real-type' });
    expect(result.promptType).toBe('summary');
  });
});

describe('mapPromptListResponse', () => {
  it('maps a full payload including nested prompts', () => {
    const payload: PromptListResponsePayload = {
      editable: true,
      max_length: 3000,
      allowed_variables: {
        system: ['a'],
        summary: ['b', 'c'],
        impression: [],
      },
      prompts: [
        { prompt_type: 'system', name: 'sys' },
        { prompt_type: 'impression', name: 'imp' },
      ],
    };

    const result = mapPromptListResponse(payload);

    expect(result.editable).toBe(true);
    expect(result.maxLength).toBe(3000);
    expect(result.allowedVariables).toEqual({
      system: ['a'],
      summary: ['b', 'c'],
      impression: [],
    });
    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0].name).toBe('sys');
    expect(result.prompts[1].promptType).toBe('impression');
  });

  it('defaults editable/maxLength/prompts and zero-fills allowedVariables when the payload is empty', () => {
    const result = mapPromptListResponse({});

    expect(result.editable).toBe(false);
    expect(result.maxLength).toBe(4000);
    expect(result.allowedVariables).toEqual({ system: [], summary: [], impression: [] });
    expect(result.prompts).toEqual([]);
  });

  it('drops entries in allowed_variables whose key is not a recognized PromptType', () => {
    const payload: PromptListResponsePayload = {
      allowed_variables: { system: ['a'], bogus: ['b'] } as unknown as Record<string, string[]>,
    };

    const result = mapPromptListResponse(payload);

    expect(result.allowedVariables.system).toEqual(['a']);
    expect(result.allowedVariables).not.toHaveProperty('bogus');
  });
});
