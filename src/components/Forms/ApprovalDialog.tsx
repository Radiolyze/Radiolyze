import { useState } from 'react';
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
  triggerLabel = 'Freigeben & Abschliessen',
  title = 'Report finalisieren',
  description = 'Bitte geben Sie Ihre Signatur ein, um den Report freizugeben.',
}: ApprovalDialogProps) {
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
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="report-signature">
            Signatur
          </label>
          <Input
            id="report-signature"
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            placeholder="Dr. Radiologe"
            autoComplete="name"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!signature.trim()}>
            Freigeben
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
