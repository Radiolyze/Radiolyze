import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Save, Sparkles, RotateCcw, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { promptClient } from '@/services/promptClient';
import type { PromptList, PromptTemplate, PromptType } from '@/types/prompts';
import { toast } from 'sonner';

const promptOrder: PromptType[] = ['system', 'summary', 'impression'];

const renderPreview = (templateText: string, findingsSample: string) =>
  templateText.replace(/{{\s*findings_text\s*}}/g, findingsSample || '');

export function PromptSettings() {
  const { t } = useTranslation('settings');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<PromptType | null>(null);
  const [activeTab, setActiveTab] = useState<PromptType>('summary');
  const [promptData, setPromptData] = useState<PromptList | null>(null);
  const [drafts, setDrafts] = useState<Record<PromptType, string>>({
    system: '',
    summary: '',
    impression: '',
  });
  const [sampleFindings, setSampleFindings] = useState(
    t('prompts.sampleFindingsDefault')
  );

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await promptClient.listPrompts();
      setPromptData(response);
      setDrafts({
        system: response.prompts.find((prompt) => prompt.promptType === 'system')?.templateText ?? '',
        summary: response.prompts.find((prompt) => prompt.promptType === 'summary')?.templateText ?? '',
        impression: response.prompts.find((prompt) => prompt.promptType === 'impression')?.templateText ?? '',
      });
    } catch (error) {
      console.warn('Failed to load prompt templates', error);
      toast.error(t('prompts.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const promptsByType = useMemo(() => {
    const map: Record<PromptType, PromptTemplate | null> = {
      system: null,
      summary: null,
      impression: null,
    };
    promptData?.prompts.forEach((prompt) => {
      map[prompt.promptType] = prompt;
    });
    return map;
  }, [promptData]);

  const currentPrompt = promptsByType[activeTab];
  const currentDraft = drafts[activeTab];
  const editable = promptData?.editable ?? false;
  const maxLength = promptData?.maxLength ?? currentPrompt?.maxLength ?? 4000;

  const isDirty = currentPrompt ? currentDraft !== currentPrompt.templateText : false;
  const hasValidLength = currentDraft.length > 0 && currentDraft.length <= maxLength;
  const canSave = editable && isDirty && hasValidLength && !isSaving;

  const handleReset = useCallback(() => {
    if (!currentPrompt) return;
    setDrafts((prev) => ({ ...prev, [activeTab]: currentPrompt.defaultText }));
  }, [activeTab, currentPrompt]);

  const handleSave = useCallback(async () => {
    if (!currentPrompt) return;
    setIsSaving(activeTab);
    try {
      const updated = await promptClient.updatePrompt(activeTab, {
        templateText: currentDraft,
        name: currentPrompt.name,
      });
      setPromptData((prev) => {
        if (!prev) return prev;
        const prompts = prev.prompts.map((prompt) =>
          prompt.promptType === activeTab ? updated : prompt
        );
        return { ...prev, prompts };
      });
      setDrafts((prev) => ({ ...prev, [activeTab]: updated.templateText }));
      toast.success(t('prompts.saveSuccess'));
    } catch (error) {
      console.warn('Prompt update failed', error);
      toast.error(t('prompts.saveError'));
    } finally {
      setIsSaving(null);
    }
  }, [activeTab, currentDraft, currentPrompt, t]);

  const handleReload = useCallback(() => {
    loadPrompts();
  }, [loadPrompts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t('prompts.title')}
        </CardTitle>
        <CardDescription>{t('prompts.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editable && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>{t('prompts.readOnlyTitle')}</AlertTitle>
            <AlertDescription>{t('prompts.readOnlyDescription')}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('prompts.warningTitle')}</AlertTitle>
          <AlertDescription>{t('prompts.warningDescription')}</AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {t('prompts.maxLength', { count: maxLength })}
          </div>
          <Button variant="outline" size="sm" onClick={handleReload} disabled={isLoading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {t('prompts.reload')}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PromptType)}>
          <TabsList className="grid grid-cols-3 w-full">
            {promptOrder.map((promptType) => (
              <TabsTrigger key={promptType} value={promptType}>
                {t(`prompts.types.${promptType}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {promptOrder.map((promptType) => (
            <TabsContent key={promptType} value={promptType} className="space-y-4">
              {promptsByType[promptType] ? (
                <>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {t('prompts.source')}: {promptsByType[promptType]?.source ?? 'default'}
                    </Badge>
                    <Badge variant="outline">
                      {t('prompts.version')}: {promptsByType[promptType]?.version ?? '-'}
                    </Badge>
                    {isDirty && (
                      <Badge variant="secondary">{t('prompts.unsaved')}</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('prompts.promptLabel')}</Label>
                    <Textarea
                      value={drafts[promptType]}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [promptType]: event.target.value }))}
                      rows={10}
                      disabled={!editable || isLoading}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('prompts.length', { count: drafts[promptType].length })}</span>
                      {(promptData?.allowedVariables?.[promptType]?.length ?? 0) > 0 && (
                        <span>
                          {t('prompts.allowedVariables')}:{' '}
                          {(promptData?.allowedVariables?.[promptType] ?? []).map((variable) => `{{${variable}}}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={!canSave || promptType !== activeTab}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      {isSaving === promptType ? t('prompts.saving') : t('prompts.save')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={!editable || promptType !== activeTab}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      {t('prompts.reset')}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>{t('prompts.previewTitle')}</Label>
                    <Textarea
                      value={sampleFindings}
                      onChange={(event) => setSampleFindings(event.target.value)}
                      rows={3}
                      disabled={isLoading}
                      placeholder={t('prompts.sampleFindingsPlaceholder')}
                    />
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                      {renderPreview(drafts[promptType], sampleFindings)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">{t('prompts.noPrompt')}</div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
