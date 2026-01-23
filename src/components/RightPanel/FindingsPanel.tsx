import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Edit3, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfidenceBar } from '@/components/Common/ConfidenceBar';
import { useASR } from '@/hooks/useASR';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ReportEditor } from '@/components/Forms/ReportEditor';
import { cn } from '@/lib/utils';

interface FindingsPanelProps {
  reportId?: string;
  findings: string;
  onFindingsChange: (text: string) => void;
  onSave?: () => void;
  onAsrStatusChange?: (status: 'idle' | 'listening' | 'processing', confidence: number) => void;
  onAnalyzeImages?: () => Promise<void>;
  isAnalyzing?: boolean;
}

export function FindingsPanel({
  reportId,
  findings,
  onFindingsChange,
  onSave,
  onAsrStatusChange,
  onAnalyzeImages,
  isAnalyzing,
}: FindingsPanelProps) {
  const { t } = useTranslation('report');
  const { t: tCommon } = useTranslation('common');
  const [isEditing, setIsEditing] = useState(false);
  const { status, isRecording, confidence, startRecording, stopRecording } = useASR({ reportId });

  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        const timestamp = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const newText = findings 
          ? `${findings}\n\n[${timestamp}] ${result.text}`
          : `[${timestamp}] ${result.text}`;
        onFindingsChange(newText);
      }
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, findings, onFindingsChange]);

  useKeyboardShortcuts({
    onToggleMic: handleMicClick,
  });

  useEffect(() => {
    onAsrStatusChange?.(status, confidence);
  }, [status, confidence, onAsrStatusChange]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    onSave?.();
  }, [onSave]);

  const wordCount = findings.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="flex flex-col border-b border-border">
      {/* Header */}
      <div className="panel-header">
        <h3 className="text-sm font-semibold uppercase tracking-wide">{t('findings.title')}</h3>
        <div className="flex items-center gap-2">
          {/* AI Analysis Button */}
          {onAnalyzeImages && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAnalyzeImages}
              disabled={isAnalyzing || status === 'processing'}
              title={t('findings.analyzeImagesHint')}
              className={cn(
                'transition-all',
                isAnalyzing && 'animate-pulse'
              )}
            >
              <Sparkles className={cn('h-4 w-4 mr-1.5', isAnalyzing && 'animate-spin')} />
              {isAnalyzing ? t('findings.analyzing') : t('findings.analyzeImages')}
            </Button>
          )}

          {/* Mic Button */}
          <Button
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full transition-all',
              isRecording
                ? 'bg-warning text-warning-foreground animate-pulse-ring'
                : 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
              status === 'processing' && 'opacity-50 cursor-wait'
            )}
            onClick={handleMicClick}
            disabled={status === 'processing' || isAnalyzing}
            title={isRecording ? t('findings.stopDictation') : t('findings.startDictation')}
          >
            {isRecording ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            disabled={isAnalyzing}
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                {tCommon('actions.save')}
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 mr-1.5" />
                {tCommon('actions.edit')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ASR Status */}
      {status === 'processing' && (
        <div className="px-4 py-2 bg-info/10 border-b border-border flex items-center gap-2 text-sm text-info">
          <div className="w-4 h-4 border-2 border-info border-t-transparent rounded-full spinner" />
          {t('findings.processing')}
        </div>
      )}

      {/* Confidence Bar */}
      {confidence > 0 && status === 'idle' && (
        <div className="px-4 py-2 bg-panel-secondary/50 border-b border-border">
          <ConfidenceBar 
            value={confidence} 
            label={t('ai.confidence')} 
            size="sm" 
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-[200px] max-h-[300px]">
        {isEditing ? (
          <ReportEditor
            value={findings}
            onChange={onFindingsChange}
            placeholder={t('findings.placeholder')}
            className="h-full min-h-[200px]"
            ariaLabel={t('findings.title')}
          />
        ) : (
          <div className="h-full p-4 overflow-y-auto">
            {findings ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{findings}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {t('findings.placeholder')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-panel-tertiary/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('findings.wordCount', { count: wordCount })}</span>
        <span>Ctrl+M</span>
      </div>
    </div>
  );
}
