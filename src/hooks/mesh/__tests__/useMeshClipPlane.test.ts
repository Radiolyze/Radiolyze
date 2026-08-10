import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMeshClipPlane } from "../useMeshClipPlane";

const scene = {
  enableClipPlane: vi.fn(),
  setClipPlanePosition: vi.fn(),
  getClipPlaneRange: vi.fn((): [number, number] | null => [-50, 50]),
};

describe("useMeshClipPlane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scene.getClipPlaneRange.mockReturnValue([-50, 50]);
  });

  it("starts disabled on the z axis with no position", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    expect(result.current.enabled).toBe(false);
    expect(result.current.axis).toBe("z");
    expect(result.current.position).toBeNull();
    expect(scene.enableClipPlane).not.toHaveBeenCalled();
  });

  it("enables the plane in the scene and centres it on the current axis", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.toggle(true));

    expect(scene.enableClipPlane).toHaveBeenCalledWith(true, "z");
    expect(result.current.enabled).toBe(true);
    expect(result.current.position).toBe(0);
  });

  it("leaves the position unset when the actors have no bounds yet", () => {
    scene.getClipPlaneRange.mockReturnValue(null);
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.toggle(true));

    expect(result.current.enabled).toBe(true);
    expect(result.current.position).toBeNull();
  });

  it("drops the position when switched off", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.toggle(true));
    act(() => result.current.toggle(false));

    expect(scene.enableClipPlane).toHaveBeenLastCalledWith(false, "z");
    expect(result.current.position).toBeNull();
  });

  it("re-centres on the new axis, because a position does not carry across axes", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.toggle(true));
    act(() => result.current.setPosition(42));
    expect(result.current.position).toBe(42);

    scene.getClipPlaneRange.mockReturnValue([0, 200]);
    act(() => result.current.setAxis("x"));

    expect(scene.enableClipPlane).toHaveBeenLastCalledWith(true, "x");
    expect(result.current.axis).toBe("x");
    expect(result.current.position).toBe(100);
  });

  it("changes the axis without touching the scene while the plane is off", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.setAxis("y"));

    expect(result.current.axis).toBe("y");
    expect(result.current.position).toBeNull();
    expect(scene.enableClipPlane).not.toHaveBeenCalled();
  });

  it("uses the axis it was just given when enabled after a change", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.setAxis("y"));
    act(() => result.current.toggle(true));

    expect(scene.enableClipPlane).toHaveBeenLastCalledWith(true, "y");
  });

  it("forwards a dragged position to the scene", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.toggle(true));
    act(() => result.current.setPosition(-12.5));

    expect(scene.setClipPlanePosition).toHaveBeenCalledWith(-12.5);
    expect(result.current.position).toBe(-12.5);
  });

  it("turns the plane off in the scene on reset", () => {
    const { result } = renderHook(() => useMeshClipPlane(scene));
    act(() => result.current.toggle(true));
    act(() => result.current.reset());

    expect(scene.enableClipPlane).toHaveBeenLastCalledWith(false);
    expect(result.current.enabled).toBe(false);
    expect(result.current.position).toBeNull();
  });
});
