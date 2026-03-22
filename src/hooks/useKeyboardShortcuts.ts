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
  onQACheck?: () => void;
  onNextCase?: () => void;
  onToggleDictation?: () => void;
  onPauseDictation?: () => void;
  onToggleCine?: () => void;
  onNextSeries?: () => void;
  onPrevSeries?: () => void;
  onFocusFindings?: () => void;
  onFocusImpression?: () => void;
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
      const allowedKeys = new Set(['s', 'm', 'e', 'Enter', 'q']);
      if (!(modKey && allowedKeys.has(key))) {
        // Allow F-keys anywhere
        if (!key.startsWith('F')) return;
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

    // Ctrl+Q: Run QA Check
    if (modKey && key === 'q') {
      event.preventDefault();
      handlers.onQACheck?.();
      return;
    }

    // Ctrl+N: Next Case in Queue
    if (modKey && key === 'n') {
      event.preventDefault();
      handlers.onNextCase?.();
      return;
    }

    // F2: Start/Stop Dictation
    if (key === 'F2') {
      event.preventDefault();
      handlers.onToggleDictation?.();
      return;
    }

    // F3: Pause/Resume Dictation
    if (key === 'F3') {
      event.preventDefault();
      handlers.onPauseDictation?.();
      return;
    }

    // Arrow keys and tool shortcuts (without modifier)
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
        case ' ':
          event.preventDefault();
          handlers.onToggleCine?.();
          break;
      }
    }

    // PageUp/PageDown: Series navigation
    if (key === 'PageUp') {
      event.preventDefault();
      handlers.onPrevSeries?.();
    }
    if (key === 'PageDown') {
      event.preventDefault();
      handlers.onNextSeries?.();
    }

    // Tab: Switch between findings/impression (only without modifier, outside text areas)
    if (key === 'Tab' && !modKey && !shiftKey) {
      if (
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        handlers.onFocusFindings?.();
      }
    }
    if (key === 'Tab' && !modKey && shiftKey) {
      if (
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        handlers.onFocusImpression?.();
      }
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
