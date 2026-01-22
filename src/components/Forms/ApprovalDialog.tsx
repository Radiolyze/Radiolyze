import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ApprovalDialogProps {
  onConfirm: (signature: string) => void;
  disabled?: boolean;
  triggerLabel?: string;
  title?: string;
  description?: string;
}

export function ApprovalDialog({
  onConfirm,
  disabled = false,
  triggerLabel,
  title,
  description,
}: ApprovalDialogProps) {
  const { t } = useTranslation('report');
  const [signature, setSignature] = useState('');
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    const trimmed = signature.trim();
    if (!trimmed) {
      return;
    }
    onConfirm(trimmed);
    setSignature('');
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="w-full" size="lg" disabled={disabled}>
          <CheckCircle className="h-5 w-5 mr-2" />
          {triggerLabel || t('approval.approve')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || t('approval.title')}</AlertDialogTitle>
          <AlertDialogDescription>{description || t('approval.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="report-signature">
            {t('approval.signature')}
          </label>
          <Input
            id="report-signature"
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            placeholder={t('approval.signaturePlaceholder')}
            autoComplete="name"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('approval.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!signature.trim()}>
            {t('approval.approve')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
