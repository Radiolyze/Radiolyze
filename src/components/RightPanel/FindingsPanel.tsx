import { useState, useCallback } from 'react';
import { Mic, MicOff, Edit3, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfidenceBar } from '@/components/Common/ConfidenceBar';
import { useASR } from '@/hooks/useASR';
import { cn } from '@/lib/utils';

interface FindingsPanelProps {
  findings: string;
  onFindingsChange: (text: string) => void;
  onSave?: () => void;
}

export function FindingsPanel({ findings, onFindingsChange, onSave }: FindingsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { status, isRecording, confidence, startRecording, stopRecording } = useASR();

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

  const handleSave = useCallback(() => {
    setIsEditing(false);
    onSave?.();
  }, [onSave]);

  const wordCount = findings.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="flex flex-col border-b border-border">
      {/* Header */}
      <div className="panel-header">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Befund</h3>
        <div className="flex items-center gap-2">
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
            disabled={status === 'processing'}
            title={isRecording ? 'Aufnahme stoppen' : 'Diktat starten (Ctrl+M)'}
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
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                Speichern
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 mr-1.5" />
                Bearbeiten
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ASR Status */}
      {status === 'processing' && (
        <div className="px-4 py-2 bg-info/10 border-b border-border flex items-center gap-2 text-sm text-info">
          <div className="w-4 h-4 border-2 border-info border-t-transparent rounded-full spinner" />
          Verarbeite Audio...
        </div>
      )}

      {/* Confidence Bar */}
      {confidence > 0 && status === 'idle' && (
        <div className="px-4 py-2 bg-panel-secondary/50 border-b border-border">
          <ConfidenceBar 
            value={confidence} 
            label="ASR Konfidenz" 
            size="sm" 
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-[200px] max-h-[300px]">
        {isEditing ? (
          <Textarea
            value={findings}
            onChange={(e) => onFindingsChange(e.target.value)}
            placeholder="Klicken Sie auf das Mikrofon zum Diktieren oder tippen Sie hier..."
            className="h-full min-h-[200px] border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent"
          />
        ) : (
          <div className="h-full p-4 overflow-y-auto">
            {findings ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{findings}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Noch keine Befunde erfasst. Klicken Sie auf das Mikrofon zum Diktieren.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-panel-tertiary/30 flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount} Wörter</span>
        <span>Ctrl+M für Mikrofon</span>
      </div>
    </div>
  );
}
