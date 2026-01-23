import { useState, useCallback } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AnnotationCategory, AnnotationCreateRequest } from '@/types/annotations';
import { ANNOTATION_CATEGORIES } from '@/types/annotations';

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
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<AnnotationCategory>('other');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!label.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(label.trim(), category);
      setLabel('');
      setCategory('other');
    } finally {
      setIsSaving(false);
    }
  }, [label, category, onSave]);

  const handleCancel = useCallback(() => {
    setLabel('');
    setCategory('other');
    onCancel();
  }, [onCancel]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      handleCancel();
    }
    onOpenChange(isOpen);
  }, [handleCancel, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annotation beschriften</DialogTitle>
          <DialogDescription>
            Geben Sie ein Label und eine Kategorie für die Annotation ein.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="annotation-label">Label</Label>
            <Input
              id="annotation-label"
              placeholder="z.B. Rundlicher Nodulus 1.2cm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && label.trim()) {
                  handleSave();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as AnnotationCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ANNOTATION_CATEGORIES).map(([key, displayLabel]) => (
                  <SelectItem key={key} value={key}>
                    {displayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pendingAnnotation?.toolType && (
            <div className="text-xs text-muted-foreground">
              Tool: {pendingAnnotation.toolType} • Frame: {(pendingAnnotation.frameIndex ?? 0) + 1}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
