import { useCallback, useState } from "react";
import type { ClipAxis, UseMeshSceneResult } from "@/hooks/useMeshScene";

type ClipPlaneScene = Pick<
  UseMeshSceneResult,
  "enableClipPlane" | "setClipPlanePosition" | "getClipPlaneRange"
>;

export interface UseMeshClipPlaneResult {
  enabled: boolean;
  axis: ClipAxis;
  /** `null` until a plane is active and its range is known. */
  position: number | null;
  toggle: (enabled: boolean) => void;
  setAxis: (axis: ClipAxis) => void;
  setPosition: (value: number) => void;
  getRange: (axis?: ClipAxis) => [number, number] | null;
  /** Turns the plane off in the scene as well as in state. */
  reset: () => void;
}

/**
 * The single axis-aligned clipping plane, kept in step with the vtk scene.
 *
 * Enabling the plane or switching its axis re-centres it: the range is derived
 * from the loaded actors' bounds, so a position measured along one axis is
 * meaningless on another.
 */
export function useMeshClipPlane(scene: ClipPlaneScene): UseMeshClipPlaneResult {
  const { enableClipPlane, setClipPlanePosition, getClipPlaneRange } = scene;

  const [enabled, setEnabled] = useState(false);
  const [axis, setAxisState] = useState<ClipAxis>("z");
  const [position, setPositionState] = useState<number | null>(null);

  const centreOn = useCallback(
    (target: ClipAxis) => {
      const range = getClipPlaneRange(target);
      if (range) {
        setPositionState((range[0] + range[1]) / 2);
      }
    },
    [getClipPlaneRange],
  );

  const toggle = useCallback(
    (next: boolean) => {
      setEnabled(next);
      enableClipPlane(next, axis);
      if (next) {
        centreOn(axis);
      } else {
        setPositionState(null);
      }
    },
    [enableClipPlane, centreOn, axis],
  );

  const setAxis = useCallback(
    (next: ClipAxis) => {
      setAxisState(next);
      if (enabled) {
        enableClipPlane(true, next);
        centreOn(next);
      }
    },
    [enabled, enableClipPlane, centreOn],
  );

  const setPosition = useCallback(
    (value: number) => {
      setPositionState(value);
      setClipPlanePosition(value);
    },
    [setClipPlanePosition],
  );

  const reset = useCallback(() => {
    setEnabled(false);
    setPositionState(null);
    enableClipPlane(false);
  }, [enableClipPlane]);

  return {
    enabled,
    axis,
    position,
    toggle,
    setAxis,
    setPosition,
    getRange: getClipPlaneRange,
    reset,
  };
}
