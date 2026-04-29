import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

type RGB = [number, number, number];

interface MeshColorPickerProps {
  currentColor: RGB;
  defaultColor: RGB;
  onChange: (rgb: RGB) => void;
  onReset: () => void;
}

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function fromByte(value: number): number {
  return Math.max(0, Math.min(1, value / 255));
}

function rgbToHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((channel) =>
        toByte(channel).toString(16).padStart(2, '0').toUpperCase(),
      )
      .join('')
  );
}

export function MeshColorPicker({
  currentColor,
  defaultColor,
  onChange,
  onReset,
}: MeshColorPickerProps) {
  const { t } = useTranslation('viewer');
  const [r, g, b] = currentColor;
  const hex = useMemo(() => rgbToHex(currentColor), [currentColor]);
  const isDirty = useMemo(
    () => currentColor.some((value, idx) => value !== defaultColor[idx]),
    [currentColor, defaultColor],
  );

  const setChannel = (index: 0 | 1 | 2) => (byte: number) => {
    const next: RGB = [...currentColor] as RGB;
    next[index] = fromByte(byte);
    onChange(next);
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-6 w-6 rounded border"
          style={{ backgroundColor: hex }}
        />
        <span className="font-mono text-[11px] text-muted-foreground">{hex}</span>
        {isDirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-6 px-2 text-[11px]"
            onClick={onReset}
          >
            {t('mesh.colorReset')}
          </Button>
        )}
      </div>
      <ChannelSlider
        label={t('mesh.colorPicker.r')}
        value={toByte(r)}
        onChange={setChannel(0)}
      />
      <ChannelSlider
        label={t('mesh.colorPicker.g')}
        value={toByte(g)}
        onChange={setChannel(1)}
      />
      <ChannelSlider
        label={t('mesh.colorPicker.b')}
        value={toByte(b)}
        onChange={setChannel(2)}
      />
    </div>
  );
}

interface ChannelSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function ChannelSlider({ label, value, onChange }: ChannelSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[10px] uppercase text-muted-foreground">
        {label}
      </span>
      <Slider
        value={[value]}
        min={0}
        max={255}
        step={1}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
        className="flex-1"
      />
      <span className="w-8 text-right tabular-nums text-[11px]">{value}</span>
    </div>
  );
}
