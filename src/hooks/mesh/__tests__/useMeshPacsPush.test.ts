import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  pushToPacs: vi.fn(),
}));

vi.mock("@/services/segmentationClient", () => ({
  segmentationClient: { pushToPacs: mocks.pushToPacs },
}));

import { useMeshPacsPush } from "../useMeshPacsPush";

describe("useMeshPacsPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushToPacs.mockResolvedValue({
      job_id: "job-1",
      dicom_seg_orthanc_url: "http://orthanc/studies/X",
      pushed_at: "2026-04-29T00:00:00Z",
    });
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useMeshPacsPush("job-1"));
    expect(result.current.state).toEqual({ phase: "idle" });
  });

  it("records the Orthanc URL on success", async () => {
    const { result } = renderHook(() => useMeshPacsPush("job-1"));
    await act(async () => {
      await result.current.push();
    });

    expect(mocks.pushToPacs).toHaveBeenCalledWith("job-1");
    expect(result.current.state).toEqual({
      phase: "pushed",
      url: "http://orthanc/studies/X",
    });
  });

  it("reports being in flight while the transfer runs", async () => {
    let release: (value: unknown) => void = () => {};
    mocks.pushToPacs.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const { result } = renderHook(() => useMeshPacsPush("job-1"));
    act(() => {
      void result.current.push();
    });
    await waitFor(() => expect(result.current.state.phase).toBe("pushing"));

    await act(async () => {
      release({ job_id: "job-1", dicom_seg_orthanc_url: "u", pushed_at: "t" });
    });
    expect(result.current.state.phase).toBe("pushed");
  });

  it("keeps a failure in state instead of throwing, so the meshes stay rendered", async () => {
    mocks.pushToPacs.mockRejectedValue(new Error("Orthanc refused the SEG"));
    const { result } = renderHook(() => useMeshPacsPush("job-1"));

    await act(async () => {
      await result.current.push();
    });

    expect(result.current.state).toEqual({
      phase: "failed",
      error: "Orthanc refused the SEG",
    });
  });

  it("stringifies a non-Error rejection", async () => {
    mocks.pushToPacs.mockRejectedValue("gateway timeout");
    const { result } = renderHook(() => useMeshPacsPush("job-1"));

    await act(async () => {
      await result.current.push();
    });

    expect(result.current.state).toEqual({ phase: "failed", error: "gateway timeout" });
  });

  it("does nothing without a job", async () => {
    const { result } = renderHook(() => useMeshPacsPush(null));
    await act(async () => {
      await result.current.push();
    });

    expect(mocks.pushToPacs).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ phase: "idle" });
  });

  it("returns to idle on reset, so a re-run does not show the previous job's URL", async () => {
    const { result } = renderHook(() => useMeshPacsPush("job-1"));
    await act(async () => {
      await result.current.push();
    });
    act(() => result.current.reset());

    expect(result.current.state).toEqual({ phase: "idle" });
  });
});
