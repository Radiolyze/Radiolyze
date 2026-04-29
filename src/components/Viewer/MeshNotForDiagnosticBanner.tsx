import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export function MeshNotForDiagnosticBanner() {
  const { t } = useTranslation('viewer');
  return (
    <div className="absolute top-2 left-2 right-2 z-30 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive backdrop-blur">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{t('mesh.disclaimer')}</span>
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={t('mesh.attribution.aria')}
            className="rounded p-0.5 hover:bg-destructive/20"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="end"
          className="w-80 text-xs leading-relaxed text-foreground"
        >
          <p className="font-semibold">{t('mesh.attribution.title')}</p>
          <p className="mt-1">{t('mesh.attribution.body')}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">TotalSegmentator</span>{' '}
              · Apache-2.0 ·{' '}
              <a
                href="https://github.com/wasserth/TotalSegmentator"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                wasserth/TotalSegmentator
              </a>
            </li>
            <li>
              <span className="font-medium text-foreground">nnU-Net v2</span>{' '}
              · Apache-2.0 ·{' '}
              <a
                href="https://github.com/MIC-DKFZ/nnUNet"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                MIC-DKFZ/nnUNet
              </a>
            </li>
          </ul>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
