import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'number';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  section?: string;
}

interface StructuredFormProps {
  schema: {
    fields: FieldDefinition[];
    sections?: string[];
  } | null;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onConvertToText: (values: Record<string, unknown>) => string;
  isStructuredMode: boolean;
  onToggleMode: (structured: boolean) => void;
}

export function StructuredForm({
  schema,
  values,
  onChange,
  onConvertToText,
  isStructuredMode,
  onToggleMode,
}: StructuredFormProps) {
  const { t } = useTranslation('report');

  const sections = useMemo(() => {
    if (!schema) return {};
    const grouped: Record<string, FieldDefinition[]> = {};
    for (const field of schema.fields) {
      const section = field.section || t('structuredForm.general', 'Allgemein');
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(field);
    }
    return grouped;
  }, [schema, t]);

  const handleFieldChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  if (!schema) {
    return (
      <div className="text-center text-muted-foreground text-sm py-4">
        {t('structuredForm.noSchema', 'Kein strukturiertes Template verfügbar')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {isStructuredMode
              ? t('structuredForm.structured', 'Strukturiert')
              : t('structuredForm.freetext', 'Freitext')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t('structuredForm.toggleLabel', 'Strukturierte Eingabe')}
          </span>
          <Switch checked={isStructuredMode} onCheckedChange={onToggleMode} />
        </div>
      </div>

      {isStructuredMode && (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 pr-2">
            {Object.entries(sections).map(([sectionName, fields]) => (
              <div key={sectionName}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  {sectionName}
                </h4>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-0.5">*</span>}
                      </Label>
                      {field.type === 'text' && (
                        <Input
                          value={String(values[field.key] || '')}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="h-8 text-sm"
                        />
                      )}
                      {field.type === 'textarea' && (
                        <Textarea
                          value={String(values[field.key] || '')}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={2}
                          className="text-sm"
                        />
                      )}
                      {field.type === 'select' && field.options && (
                        <Select
                          value={String(values[field.key] || '')}
                          onValueChange={(v) => handleFieldChange(field.key, v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={field.placeholder || '—'} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {field.type === 'boolean' && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(values[field.key])}
                            onCheckedChange={(v) => handleFieldChange(field.key, v)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {values[field.key] ? 'Ja' : 'Nein'}
                          </span>
                        </div>
                      )}
                      {field.type === 'number' && (
                        <Input
                          type="number"
                          value={String(values[field.key] || '')}
                          onChange={(e) => handleFieldChange(field.key, e.target.valueAsNumber || '')}
                          placeholder={field.placeholder}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Validation summary */}
      {isStructuredMode && (
        <div className="flex items-center gap-1">
          {schema.fields
            .filter((f) => f.required && !values[f.key])
            .map((f) => (
              <Badge key={f.key} variant="outline" className="text-xs text-yellow-400 border-yellow-700">
                {f.label}
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
