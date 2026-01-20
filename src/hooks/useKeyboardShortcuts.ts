import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onToggleMic?: () => void;
  onSave?: () => void;
  onApprove?: () => void;
  onNextFrame?: () => void;
  onPrevFrame?: () => void;
  onZoomTool?: () => void;
  onPanTool?: () => void;
  onMeasureTool?: () => void;
  onResetView?: () => void;
  onToggleEdit?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { ctrlKey, metaKey, key, shiftKey } = event;
    const modKey = ctrlKey || metaKey;

    // Ignore if typing in input/textarea unless it is a global shortcut
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      const allowedKeys = new Set(['s', 'm', 'e', 'Enter']);
      if (!(modKey && allowedKeys.has(key))) {
        return;
      }
    }

    // Ctrl+M: Toggle Microphone
    if (modKey && key === 'm') {
      event.preventDefault();
      handlers.onToggleMic?.();
      return;
    }

    // Ctrl+S: Save Draft
    if (modKey && key === 's') {
      event.preventDefault();
      handlers.onSave?.();
      return;
    }

    // Ctrl+Enter: Approve/Submit
    if (modKey && key === 'Enter') {
      event.preventDefault();
      handlers.onApprove?.();
      return;
    }

    // Ctrl+E: Toggle Edit Mode
    if (modKey && key === 'e') {
      event.preventDefault();
      handlers.onToggleEdit?.();
      return;
    }

    // Arrow keys for frame navigation (without modifier)
    if (!modKey && !shiftKey) {
      switch (key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          event.preventDefault();
          handlers.onPrevFrame?.();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          event.preventDefault();
          handlers.onNextFrame?.();
          break;
        case 'z':
        case 'Z':
          event.preventDefault();
          handlers.onZoomTool?.();
          break;
        case 'p':
        case 'P':
          event.preventDefault();
          handlers.onPanTool?.();
          break;
        case 'm':
        case 'M':
          // Only if not Ctrl+M
          if (!modKey) {
            event.preventDefault();
            handlers.onMeasureTool?.();
          }
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          handlers.onResetView?.();
          break;
      }
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
