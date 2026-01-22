import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ReportEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  readOnly?: boolean;
}

export function ReportEditor({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  readOnly = false,
}: ReportEditorProps) {
  const { t } = useTranslation('report');
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder || t('findings.placeholder')}
      readOnly={readOnly}
      aria-label={ariaLabel}
      className={cn(
        'border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent',
        className
      )}
    />
  );
}
