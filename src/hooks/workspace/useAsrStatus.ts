import { useCallback, useState } from "react";

export type AsrStatus = "idle" | "listening" | "processing";

export interface UseAsrStatusResult {
  status: AsrStatus;
  confidence: number;
  /** Both values arrive together from the dictation panel. */
  handleStatusChange: (status: AsrStatus, confidence: number) => void;
}

/**
 * Dictation state, reported upward by the findings editor so the viewer can
 * show the microphone indicator next to the AI and QA ones.
 */
export function useAsrStatus(): UseAsrStatusResult {
  const [status, setStatus] = useState<AsrStatus>("idle");
  const [confidence, setConfidence] = useState(0);

  const handleStatusChange = useCallback((nextStatus: AsrStatus, nextConfidence: number) => {
    setStatus(nextStatus);
    setConfidence(nextConfidence);
  }, []);

  return { status, confidence, handleStatusChange };
}
