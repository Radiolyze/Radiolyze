import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Save, Sparkles, RotateCcw, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { promptClient } from "@/services/promptClient";
import type { PromptList, PromptTemplate, PromptType } from "@/types/prompts";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const promptOrder: PromptType[] = ["system", "summary", "impression"];

const renderPreview = (templateText: string, findingsSample: string) =>
  templateText.replace(/{{\s*findings_text\s*}}/g, findingsSample || "");

const PROMPTS_QUERY_KEY = ["prompts"] as const;

export function PromptSettings() {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PromptType>("summary");
  // Unsaved edits only. Anything not in here shows the server's text, so a
  // refetch cannot silently overwrite what someone is typing.
  const [drafts, setDrafts] = useState<Partial<Record<PromptType, string>>>({});
  const [sampleFindings, setSampleFindings] = useState(t("prompts.sampleFindingsDefault"));

  const {
    data: promptData,
    isPending: isLoading,
    error,
  } = useQuery({
    queryKey: PROMPTS_QUERY_KEY,
    queryFn: () => promptClient.listPrompts(),
  });

  // Reporting the failure is a side effect of it happening, so it belongs in an
  // effect — keyed on the error object so a retry that fails again re-reports,
  // while a re-render for any other reason does not.
  useEffect(() => {
    if (!error) return;
    logger.warn("Failed to load prompt templates", error);
    toast.error(t("prompts.loadError"));
  }, [error, t]);

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

  const textFor = useCallback(
    (promptType: PromptType) => drafts[promptType] ?? promptsByType[promptType]?.templateText ?? "",
    [drafts, promptsByType],
  );

  const currentPrompt = promptsByType[activeTab];
  const currentDraft = textFor(activeTab);
  const editable = promptData?.editable ?? false;
  const maxLength = promptData?.maxLength ?? currentPrompt?.maxLength ?? 4000;

  const saveMutation = useMutation({
    mutationFn: (promptType: PromptType) => {
      const prompt = promptsByType[promptType];
      return promptClient.updatePrompt(promptType, {
        templateText: textFor(promptType),
        name: prompt?.name ?? "",
      });
    },
    onSuccess: (updated, promptType) => {
      queryClient.setQueryData<PromptList>(PROMPTS_QUERY_KEY, (previous) =>
        previous
          ? {
              ...previous,
              prompts: previous.prompts.map((prompt) =>
                prompt.promptType === promptType ? updated : prompt,
              ),
            }
          : previous,
      );
      // The draft has landed on the server — drop it and show the stored text.
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[promptType];
        return next;
      });
      toast.success(t("prompts.saveSuccess"));
    },
    onError: (error) => {
      logger.warn("Prompt update failed", error);
      toast.error(t("prompts.saveError"));
    },
  });

  const isSaving = saveMutation.isPending ? saveMutation.variables : null;

  const isDirty = currentPrompt ? currentDraft !== currentPrompt.templateText : false;
  const hasValidLength = currentDraft.length > 0 && currentDraft.length <= maxLength;
  const canSave = editable && isDirty && hasValidLength && !isSaving;

  const handleReset = useCallback(() => {
    if (!currentPrompt) return;
    setDrafts((prev) => ({ ...prev, [activeTab]: currentPrompt.defaultText }));
  }, [activeTab, currentPrompt]);

  const handleSave = useCallback(() => {
    if (!currentPrompt) return;
    saveMutation.mutate(activeTab);
  }, [activeTab, currentPrompt, saveMutation]);

  const handleReload = useCallback(() => {
    // An explicit reload discards unsaved edits, as it did before.
    setDrafts({});
    queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY_KEY });
  }, [queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t("prompts.title")}
        </CardTitle>
        <CardDescription>{t("prompts.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editable && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>{t("prompts.readOnlyTitle")}</AlertTitle>
            <AlertDescription>{t("prompts.readOnlyDescription")}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("prompts.warningTitle")}</AlertTitle>
          <AlertDescription>{t("prompts.warningDescription")}</AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {t("prompts.maxLength", { count: maxLength })}
          </div>
          <Button variant="outline" size="sm" onClick={handleReload} disabled={isLoading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {t("prompts.reload")}
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
                      {t("prompts.source")}: {promptsByType[promptType]?.source ?? "default"}
                    </Badge>
                    <Badge variant="outline">
                      {t("prompts.version")}: {promptsByType[promptType]?.version ?? "-"}
                    </Badge>
                    {isDirty && <Badge variant="secondary">{t("prompts.unsaved")}</Badge>}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("prompts.promptLabel")}</Label>
                    <Textarea
                      value={textFor(promptType)}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [promptType]: event.target.value }))
                      }
                      rows={10}
                      disabled={!editable || isLoading}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("prompts.length", { count: textFor(promptType).length })}</span>
                      {(promptData?.allowedVariables?.[promptType]?.length ?? 0) > 0 && (
                        <span>
                          {t("prompts.allowedVariables")}:{" "}
                          {(promptData?.allowedVariables?.[promptType] ?? [])
                            .map((variable) => `{{${variable}}}`)
                            .join(", ")}
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
                      {isSaving === promptType ? t("prompts.saving") : t("prompts.save")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={!editable || promptType !== activeTab}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      {t("prompts.reset")}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>{t("prompts.previewTitle")}</Label>
                    <Textarea
                      value={sampleFindings}
                      onChange={(event) => setSampleFindings(event.target.value)}
                      rows={3}
                      disabled={isLoading}
                      placeholder={t("prompts.sampleFindingsPlaceholder")}
                    />
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                      {renderPreview(textFor(promptType), sampleFindings)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">{t("prompts.noPrompt")}</div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
