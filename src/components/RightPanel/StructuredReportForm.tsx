import { useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Schema definition for a single structured reporting field.
 */
export interface StructuredField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'checkbox';
  options?: string[];
  required?: boolean;
  default_value?: string;
  placeholder?: string;
}

export interface FieldsSchema {
  fields: StructuredField[];
}

interface StructuredReportFormProps {
  schema: FieldsSchema;
  data: Record<string, string | number | boolean>;
  onChange: (data: Record<string, string | number | boolean>) => void;
}

/**
 * Dynamic form renderer for structured report templates.
 *
 * Renders a JSON-schema defined form with field-level editing,
 * supporting text, select, number, and checkbox field types.
 * Designed for radiology structured reporting (RSNA/IHE MRRT inspired).
 */
export function StructuredReportForm({ schema, data, onChange }: StructuredReportFormProps) {
  const handleFieldChange = useCallback(
    (key: string, value: string | number | boolean) => {
      onChange({ ...data, [key]: value });
    },
    [data, onChange],
  );

  const renderedFields = useMemo(
    () =>
      schema.fields.map((field) => {
        const value = data[field.key] ?? field.default_value ?? '';

        return (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`sf-${field.key}`} className="text-xs font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>

            {field.type === 'text' && (
              <Input
                id={`sf-${field.key}`}
                value={String(value)}
                placeholder={field.placeholder}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="h-8 text-sm"
              />
            )}

            {field.type === 'number' && (
              <Input
                id={`sf-${field.key}`}
                type="number"
                value={String(value)}
                placeholder={field.placeholder}
                onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            )}

            {field.type === 'select' && (
              <select
                id={`sf-${field.key}`}
                value={String(value)}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">—</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <div className="flex items-center gap-2">
                <input
                  id={`sf-${field.key}`}
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-muted-foreground">{field.placeholder ?? 'Ja'}</span>
              </div>
            )}
          </div>
        );
      }),
    [schema.fields, data, handleFieldChange],
  );

  return <div className="space-y-3">{renderedFields}</div>;
}

/**
 * Generate free-text findings from structured data for backwards compatibility.
 */
export function structuredDataToText(
  schema: FieldsSchema,
  data: Record<string, string | number | boolean>,
): string {
  return schema.fields
    .filter((field) => data[field.key] !== undefined && data[field.key] !== '' && data[field.key] !== false)
    .map((field) => {
      const value = data[field.key];
      if (field.type === 'checkbox') {
        return `${field.label}: ${value ? 'Ja' : 'Nein'}`;
      }
      return `${field.label}: ${value}`;
    })
    .join('\n');
}
