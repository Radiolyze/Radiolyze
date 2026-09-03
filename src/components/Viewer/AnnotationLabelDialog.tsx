import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AnnotationCategory, AnnotationCreateRequest } from "@/types/annotations";
import { ANNOTATION_CATEGORY_KEYS } from "@/types/annotations";

interface AnnotationLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAnnotation: Partial<AnnotationCreateRequest> | null;
  onSave: (label: string, category: AnnotationCategory) => Promise<void>;
  onCancel: () => void;
}

export function AnnotationLabelDialog({
  open,
  onOpenChange,
  pendingAnnotation,
  onSave,
  onCancel,
}: AnnotationLabelDialogProps) {
  const { t } = useTranslation(["viewer", "common"]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<AnnotationCategory>("other");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!label.trim()) return;

    setIsSaving(true);
    try {
      await onSave(label.trim(), category);
      setLabel("");
      setCategory("other");
    } finally {
      setIsSaving(false);
    }
  }, [label, category, onSave]);

  const handleCancel = useCallback(() => {
    setLabel("");
    setCategory("other");
    onCancel();
  }, [onCancel]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        handleCancel();
      }
      onOpenChange(isOpen);
    },
    [handleCancel, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("viewer:annotations.title")}</DialogTitle>
          <DialogDescription>{t("viewer:annotations.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="annotation-label">{t("viewer:annotations.label")}</Label>
            <Input
              id="annotation-label"
              placeholder={t("viewer:annotations.labelPlaceholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: focuses the label input when the dialog opens
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && label.trim()) {
                  handleSave();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("viewer:annotations.categoryLabel")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as AnnotationCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ANNOTATION_CATEGORY_KEYS).map(([key, categoryKey]) => (
                  <SelectItem key={key} value={key}>
                    {t(`viewer:${categoryKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pendingAnnotation?.toolType && (
            <div className="text-xs text-muted-foreground">
              {t("viewer:annotations.toolFrame", {
                tool: pendingAnnotation.toolType,
                frame: (pendingAnnotation.frameIndex ?? 0) + 1,
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
