import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Trash2, Edit3, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  listAnnotationsForSeries,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  verifyAnnotation,
} from '@/services/annotationClient';
import type {
  TrainingAnnotation,
  AnnotationCategory,
  AnnotationCreateRequest,
} from '@/types/annotations';
import { ANNOTATION_CATEGORIES, ANNOTATION_SEVERITIES } from '@/types/annotations';

interface AnnotationPanelProps {
  studyId: string | null;
  seriesId: string | null;
  currentFrameIndex: number;
  onAnnotationSelect?: (annotation: TrainingAnnotation) => void;
  className?: string;
}

export function AnnotationPanel({
  studyId,
  seriesId,
  currentFrameIndex,
  onAnnotationSelect,
  className,
}: AnnotationPanelProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState<AnnotationCategory>('other');
  const [editNotes, setEditNotes] = useState('');

  const {
    data: annotations = [],
    isLoading,
  } = useQuery({
    queryKey: ['annotations', studyId, seriesId],
    queryFn: () => listAnnotationsForSeries(studyId!, seriesId!),
    enabled: Boolean(studyId && seriesId),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', studyId, seriesId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateAnnotation>[1] }) =>
      updateAnnotation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', studyId, seriesId] });
      setEditingId(null);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, actorId }: { id: string; actorId: string }) =>
      verifyAnnotation(id, { actorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', studyId, seriesId] });
    },
  });

  const handleStartEdit = useCallback((ann: TrainingAnnotation) => {
    setEditingId(ann.id);
    setEditLabel(ann.label);
    setEditCategory(ann.category);
    setEditNotes(ann.notes || '');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      payload: {
        label: editLabel,
        category: editCategory,
        notes: editNotes || undefined,
      },
    });
  }, [editingId, editLabel, editCategory, editNotes, updateMutation]);

  const handleVerify = useCallback((ann: TrainingAnnotation) => {
    verifyMutation.mutate({ id: ann.id, actorId: 'current-user' });
  }, [verifyMutation]);

  const handleDelete = useCallback((ann: TrainingAnnotation) => {
    if (confirm(`Annotation "${ann.label}" löschen?`)) {
      deleteMutation.mutate(ann.id);
    }
  }, [deleteMutation]);

  // Filter annotations for current frame
  const currentFrameAnnotations = annotations.filter(
    (ann) => ann.frameIndex === currentFrameIndex
  );
  const otherAnnotations = annotations.filter(
    (ann) => ann.frameIndex !== currentFrameIndex
  );

  if (!studyId || !seriesId) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        Wählen Sie eine Serie aus
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Annotations
          <Badge variant="secondary" className="ml-auto">
            {annotations.length}
          </Badge>
        </h3>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : annotations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Keine Annotations vorhanden.
            <br />
            Verwenden Sie die Annotation-Tools, um Bereiche zu markieren.
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {/* Current frame annotations */}
            {currentFrameAnnotations.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground px-2 py-1">
                  Frame {currentFrameIndex + 1}
                </div>
                {currentFrameAnnotations.map((ann) => (
                  <AnnotationItem
                    key={ann.id}
                    annotation={ann}
                    isEditing={editingId === ann.id}
                    editLabel={editLabel}
                    editCategory={editCategory}
                    editNotes={editNotes}
                    onEditLabel={setEditLabel}
                    onEditCategory={setEditCategory}
                    onEditNotes={setEditNotes}
                    onStartEdit={() => handleStartEdit(ann)}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onVerify={() => handleVerify(ann)}
                    onDelete={() => handleDelete(ann)}
                    onClick={() => onAnnotationSelect?.(ann)}
                    isSaving={updateMutation.isPending}
                  />
                ))}
              </div>
            )}

            {/* Other frames */}
            {otherAnnotations.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground px-2 py-1">
                  Andere Frames
                </div>
                {otherAnnotations.map((ann) => (
                  <AnnotationItem
                    key={ann.id}
                    annotation={ann}
                    isEditing={editingId === ann.id}
                    editLabel={editLabel}
                    editCategory={editCategory}
                    editNotes={editNotes}
                    onEditLabel={setEditLabel}
                    onEditCategory={setEditCategory}
                    onEditNotes={setEditNotes}
                    onStartEdit={() => handleStartEdit(ann)}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onVerify={() => handleVerify(ann)}
                    onDelete={() => handleDelete(ann)}
                    onClick={() => onAnnotationSelect?.(ann)}
                    isSaving={updateMutation.isPending}
                    dimmed
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Stats footer */}
      <div className="p-2 border-t border-border text-xs text-muted-foreground flex justify-between">
        <span>
          Verifiziert: {annotations.filter((a) => a.verifiedBy).length}/{annotations.length}
        </span>
        <span>Frame: {currentFrameIndex + 1}</span>
      </div>
    </div>
  );
}

interface AnnotationItemProps {
  annotation: TrainingAnnotation;
  isEditing: boolean;
  editLabel: string;
  editCategory: AnnotationCategory;
  editNotes: string;
  onEditLabel: (v: string) => void;
  onEditCategory: (v: AnnotationCategory) => void;
  onEditNotes: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onVerify: () => void;
  onDelete: () => void;
  onClick?: () => void;
  isSaving?: boolean;
  dimmed?: boolean;
}

function AnnotationItem({
  annotation,
  isEditing,
  editLabel,
  editCategory,
  editNotes,
  onEditLabel,
  onEditCategory,
  onEditNotes,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onVerify,
  onDelete,
  onClick,
  isSaving,
  dimmed,
}: AnnotationItemProps) {
  if (isEditing) {
    return (
      <div className="p-2 bg-card rounded-lg border border-primary space-y-2">
        <Input
          value={editLabel}
          onChange={(e) => onEditLabel(e.target.value)}
          placeholder="Label"
          className="h-8 text-sm"
        />
        <Select value={editCategory} onValueChange={(v) => onEditCategory(v as AnnotationCategory)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ANNOTATION_CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={editNotes}
          onChange={(e) => onEditNotes(e.target.value)}
          placeholder="Notizen..."
          className="text-xs min-h-[60px]"
        />
        <div className="flex gap-1">
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={onSaveEdit} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Speichern'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancelEdit}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-2 bg-card rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors group',
        dimmed && 'opacity-60'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{annotation.label}</span>
            {annotation.verifiedBy && (
              <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {ANNOTATION_CATEGORIES[annotation.category] || annotation.category}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {annotation.toolType}
            </span>
            {!dimmed && (
              <span className="text-[10px] text-muted-foreground">
                • F{annotation.frameIndex + 1}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          {!annotation.verifiedBy && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-success"
              onClick={(e) => {
                e.stopPropagation();
                onVerify();
              }}
            >
              <CheckCircle2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {annotation.notes && (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
          {annotation.notes}
        </p>
      )}
    </div>
  );
}
