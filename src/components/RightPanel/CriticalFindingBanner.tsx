import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CriticalAlert {
  id: string;
  report_id: string;
  finding_type: string;
  severity: string;
  matched_text?: string;
  notified_at: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

interface CriticalFindingBannerProps {
  alerts: CriticalAlert[];
  onAcknowledge: (alertId: string, acknowledgedBy: string) => void;
}

export function CriticalFindingBanner({ alerts, onAcknowledge }: CriticalFindingBannerProps) {
  const { t } = useTranslation('report');
  const [ackDialogAlert, setAckDialogAlert] = useState<CriticalAlert | null>(null);
  const [signature, setSignature] = useState('');

  const unacknowledged = alerts.filter((a) => !a.acknowledged_at);
  const acknowledged = alerts.filter((a) => a.acknowledged_at);

  if (alerts.length === 0) return null;

  const handleAcknowledge = () => {
    if (ackDialogAlert && signature.trim()) {
      onAcknowledge(ackDialogAlert.id, signature.trim());
      setAckDialogAlert(null);
      setSignature('');
    }
  };

  return (
    <>
      {unacknowledged.length > 0 && (
        <div className="rounded-lg border-2 border-red-500 bg-red-950/30 p-3 mb-3 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="font-bold text-red-300 text-sm">
              {t('criticalFinding.title', 'KRITISCHER BEFUND')}
            </span>
            <Badge variant="destructive" className="text-xs">
              {unacknowledged.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {unacknowledged.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <span className="text-red-200 text-sm font-medium">{alert.finding_type}</span>
                  <span className="text-red-400 text-xs ml-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(alert.notified_at).toLocaleTimeString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setAckDialogAlert(alert)}
                  className="text-xs"
                >
                  {t('criticalFinding.acknowledge', 'Bestätigen')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {acknowledged.length > 0 && (
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-950/20 p-2 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Check className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-400 text-xs font-medium">
              {t('criticalFinding.acknowledged', 'Bestätigte kritische Befunde')}
            </span>
          </div>
          <div className="space-y-1">
            {acknowledged.map((alert) => (
              <div key={alert.id} className="text-xs text-muted-foreground">
                {alert.finding_type} — {alert.acknowledged_by} ({new Date(alert.acknowledged_at!).toLocaleString()})
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!ackDialogAlert} onOpenChange={(open) => !open && setAckDialogAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('criticalFinding.ackTitle', 'Kritischen Befund bestätigen')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'criticalFinding.ackDescription',
                'Bitte bestätigen Sie die Kenntnisnahme des kritischen Befundes und dokumentieren Sie Ihren Namen.'
              )}
            </DialogDescription>
          </DialogHeader>
          {ackDialogAlert && (
            <div className="py-2">
              <p className="text-sm font-medium mb-3">
                {t('criticalFinding.findingType', 'Befundtyp')}: <strong>{ackDialogAlert.finding_type}</strong>
              </p>
              <Input
                placeholder={t('criticalFinding.signaturePlaceholder', 'Dr. Name')}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAcknowledge()}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckDialogAlert(null)}>
              {t('criticalFinding.cancel', 'Abbrechen')}
            </Button>
            <Button variant="destructive" onClick={handleAcknowledge} disabled={!signature.trim()}>
              {t('criticalFinding.confirmAck', 'Kenntnisnahme bestätigen')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
