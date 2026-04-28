import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export function MeshNotForDiagnosticBanner() {
  const { t } = useTranslation('viewer');
  return (
    <div className="absolute top-2 left-2 right-2 z-30 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive backdrop-blur">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{t('mesh.disclaimer')}</span>
    </div>
  );
}
