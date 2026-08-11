import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `initCornerstone` reaches into the DICOM image loader through optional
 * chaining (`wadors?.register`, `internal?.setOptions`, ...) and swallows the
 * whole block in a try/catch. That is deliberate — a missing codec must not
 * take the viewer down — but it means a renamed or removed upstream API does
 * not fail: it registers nothing, logs nothing at default level, and the
 * viewer comes up looking fine until a series refuses to load.
 *
 * These tests are the guard for that. They assert against the real installed
 * package, so a Cornerstone major that moves one of these entry points turns
 * into a red test rather than a silently inert loader.
 */

const registerImageLoader = vi.fn();
const addProvider = vi.fn();
const registerWorker = vi.fn();
const addTool = vi.fn();

vi.mock("@cornerstonejs/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cornerstonejs/core")>();
  return {
    ...actual,
    init: vi.fn(),
    isCornerstoneInitialized: () => false,
    imageLoader: { ...actual.imageLoader, registerImageLoader },
    metaData: { ...actual.metaData, addProvider },
    getWebWorkerManager: () => ({ registerWorker }),
  };
});

vi.mock("@cornerstonejs/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cornerstonejs/tools")>();
  return { ...actual, init: vi.fn(), addTool };
});

describe("the DICOM image loader API the viewer depends on", () => {
  it("exposes the entry points initCornerstone calls optionally", async () => {
    const loader = await import("@cornerstonejs/dicom-image-loader");

    expect(typeof loader.internal?.setOptions).toBe("function");
    expect(typeof loader.wadors?.register).toBe("function");
    expect(typeof loader.wadors?.loadImage).toBe("function");
    expect(typeof loader.wadouri?.register).toBe("function");
    expect(typeof loader.wadouri?.loadImage).toBe("function");
    // prefetchWadorsMetadata writes every frame's metadata through this one.
    expect(typeof loader.wadors?.metaDataManager?.add).toBe("function");
  });
});

describe("initCornerstone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("registers an image loader for both DICOMweb schemes", async () => {
    const { initCornerstone } = await import("@/services/cornerstone");
    await initCornerstone();

    const schemes = registerImageLoader.mock.calls.map(([scheme]) => scheme);
    expect(schemes).toContain("wadors");
    expect(schemes).toContain("wadouri");
    for (const [, loadImage] of registerImageLoader.mock.calls) {
      expect(typeof loadImage).toBe("function");
    }
  });

  it("registers the fallback metadata provider behind every other provider", async () => {
    const { initCornerstone } = await import("@/services/cornerstone");
    await initCornerstone();

    expect(addProvider).toHaveBeenCalledTimes(1);
    const [provider, priority] = addProvider.mock.calls[0];
    // A low priority number would put these defaults ahead of the real DICOM
    // metadata rather than behind it.
    expect(priority).toBe(10000);
    expect(provider("imagePlaneModule", "wadors:whatever")).toMatchObject({
      pixelSpacing: [1, 1],
      sliceThickness: 1,
    });
    expect(provider("imagePixelModule", "wadors:whatever")).toBeUndefined();
  });

  it("registers the pre-bundled worker rather than the package's own URL", async () => {
    const { initCornerstone } = await import("@/services/cornerstone");
    await initCornerstone();

    expect(registerWorker).toHaveBeenCalledTimes(1);
    const [name, workerFn, options] = registerWorker.mock.calls[0];
    expect(name).toBe("dicomImageLoader");
    expect(typeof workerFn).toBe("function");
    expect(options.maxWorkerInstances).toBeGreaterThanOrEqual(1);
  });

  it("registers every tool the viewer binds to a tool group", async () => {
    const { initCornerstone, cornerstoneToolNames } = await import("@/services/cornerstone");
    await initCornerstone();

    const registered = addTool.mock.calls.map(([tool]) => tool.toolName);
    for (const toolName of Object.values(cornerstoneToolNames)) {
      // An import that resolved to undefined would leave the tool name
      // undefined here, and the tool group binding would quietly do nothing.
      expect(toolName).toEqual(expect.any(String));
      expect(registered).toContain(toolName);
    }
  });

  it("runs its registrations once, however many viewports mount", async () => {
    const { initCornerstone } = await import("@/services/cornerstone");
    await initCornerstone();
    await initCornerstone();

    expect(registerWorker).toHaveBeenCalledTimes(1);
    expect(addProvider).toHaveBeenCalledTimes(1);
  });
});
