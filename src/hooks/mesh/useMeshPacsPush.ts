import { useCallback, useState } from "react";
import { segmentationClient } from "@/services/segmentationClient";

export type PacsPushState =
  | { phase: "idle" }
  | { phase: "pushing" }
  | { phase: "pushed"; url: string }
  | { phase: "failed"; error: string };

export interface UseMeshPacsPushResult {
  state: PacsPushState;
  push: () => Promise<void>;
  reset: () => void;
}

/**
 * Sends the job's DICOM SEG to the PACS.
 *
 * A failure is kept in state rather than thrown: the push is a side errand off
 * the viewer, so a rejected transfer surfaces next to the button and leaves the
 * rendered meshes alone.
 */
export function useMeshPacsPush(jobId: string | null): UseMeshPacsPushResult {
  const [state, setState] = useState<PacsPushState>({ phase: "idle" });

  const push = useCallback(async () => {
    if (!jobId) return;
    setState({ phase: "pushing" });
    try {
      const response = await segmentationClient.pushToPacs(jobId);
      setState({ phase: "pushed", url: response.dicom_seg_orthanc_url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: "failed", error: message });
    }
  }, [jobId]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, push, reset };
}
