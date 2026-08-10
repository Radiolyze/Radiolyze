import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ExportFormat } from "@/services/trainingClient";
import { FORMAT_ENTRIES } from "./formatInfo";

interface TrainingFormatSelectorProps {
  selectedFormat: ExportFormat;
  onSelectFormat: (format: ExportFormat) => void;
}

export function TrainingFormatSelector({
  selectedFormat,
  onSelectFormat,
}: TrainingFormatSelectorProps) {
  const { t } = useTranslation("training");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("formats.title")}</CardTitle>
        <CardDescription>{t("formats.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FORMAT_ENTRIES.map(([format, info]) => (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- pre-existing click-only selection pattern, keyboard support tracked separately
          <div
            key={format}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
              selectedFormat === format
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50",
            )}
            onClick={() => onSelectFormat(format)}
          >
            <div
              className={cn(
                "p-2 rounded-lg",
                selectedFormat === format ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <info.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {info.name}
                {selectedFormat === format && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <div className="text-sm text-muted-foreground">{t(`formats.${format}`)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
