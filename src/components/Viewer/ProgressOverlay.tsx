import { useTranslation } from 'react-i18next';
import { Mic, Sparkles, ShieldCheck, ShieldAlert, ShieldX, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIStatus, QAStatus } from '@/types/radiology';

type ASRStatus = 'idle' | 'listening' | 'processing';

interface ProgressOverlayProps {
  asrStatus?: ASRStatus;
  asrConfidence?: number;
  aiStatus?: AIStatus;
  qaStatus?: QAStatus;
  className?: string;
}

const qaConfig: Record<QAStatus, { icon: typeof ShieldCheck; labelKey: string; className: string }> = {
  pending: { icon: Timer, labelKey: 'progress.qa.idle', className: 'bg-muted text-muted-foreground' },
  checking: { icon: Timer, labelKey: 'progress.qa.checking', className: 'bg-info/20 text-info' },
  pass: { icon: ShieldCheck, labelKey: 'progress.qa.passed', className: 'bg-success/20 text-success' },
  warn: { icon: ShieldAlert, labelKey: 'progress.qa.warnings', className: 'bg-warning/20 text-warning' },
  fail: { icon: ShieldX, labelKey: 'progress.qa.warnings', className: 'bg-destructive/20 text-destructive' },
};

export function ProgressOverlay({
  asrStatus = 'idle',
  asrConfidence,
  aiStatus = 'idle',
  qaStatus = 'pending',
  className,
}: ProgressOverlayProps) {
  const { t } = useTranslation('viewer');
  const shouldShow =
    asrStatus !== 'idle' ||
    aiStatus !== 'idle' ||
    qaStatus !== 'pending' ||
    (asrConfidence !== undefined && asrConfidence > 0);

  if (!shouldShow) {
    return null;
  }

  const qa = qaConfig[qaStatus];
  const QaIcon = qa.icon;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 min-w-[220px] shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Status</span>
        <span className="uppercase tracking-wide">Live</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Mic className="h-4 w-4 text-primary" />
          <span>ASR</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            asrStatus === 'listening' && 'bg-warning/20 text-warning border-warning/30',
            asrStatus === 'processing' && 'bg-info/20 text-info border-info/30',
            asrStatus === 'idle' && 'bg-muted text-muted-foreground'
          )}
        >
          {t(`progress.asr.${asrStatus}`)}
        </Badge>
      </div>

      {asrConfidence !== undefined && asrConfidence > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>ASR Konfidenz</span>
          <span className="font-medium text-foreground">{Math.round(asrConfidence * 100)}%</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>AI</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            aiStatus === 'queued' && 'bg-warning/20 text-warning border-warning/30',
            aiStatus === 'processing' && 'bg-info/20 text-info border-info/30',
            aiStatus === 'error' && 'bg-destructive/20 text-destructive border-destructive/30',
            aiStatus === 'idle' && 'bg-muted text-muted-foreground'
          )}
        >
          {aiStatus === 'queued'
            ? t('progress.ai.running')
            : aiStatus === 'processing'
              ? t('progress.ai.running')
              : aiStatus === 'error'
                ? t('progress.ai.idle')
                : t('progress.ai.idle')}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <QaIcon className="h-4 w-4" />
          <span>QA</span>
        </div>
        <Badge variant="outline" className={cn('text-[10px]', qa.className)}>
          {t(qa.labelKey)}
        </Badge>
      </div>
    </div>
  );
}
