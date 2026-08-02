import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reportClient } from "@/services/reportClient";
import { apiClient } from "@/services/apiClient";

vi.mock("@/services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A binary-download response: what the SR/PDF export paths read off `fetch`. */
function fileResponse(
  body: string,
  headers: Record<string, string> = {},
  init: { status?: number; ok?: boolean } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(headers),
    blob: async () => new Blob([body]),
    text: async () => body,
  } as unknown as Response;
}

describe("report endpoints", () => {
  it("reads a single report by id", async () => {
    get.mockResolvedValue({ id: "r-1" });
    await expect(reportClient.getReport("r-1")).resolves.toEqual({ id: "r-1" });
    expect(get).toHaveBeenCalledWith("/api/v1/reports/r-1");
  });

  it("passes list filters through as query parameters", async () => {
    get.mockResolvedValue([]);
    await reportClient.listReports({ status: "draft", limit: 10, offset: 20 });
    expect(get).toHaveBeenCalledWith("/api/v1/reports", {
      query: { status: "draft", limit: 10, offset: 20 },
    });
  });

  it("sends undefined filters rather than inventing defaults", async () => {
    get.mockResolvedValue([]);
    await reportClient.listReports();
    expect(get).toHaveBeenCalledWith("/api/v1/reports", {
      query: { status: undefined, limit: undefined, offset: undefined },
    });
  });

  it("converts a create payload to the backend's snake_case field names", async () => {
    post.mockResolvedValue({ id: "r-1" });
    await reportClient.createReport({
      reportId: "r-1",
      studyId: "s-1",
      patientId: "p-1",
      status: "draft",
      findingsText: "findings",
      impressionText: "impression",
    });

    expect(post).toHaveBeenCalledWith("/api/v1/reports/create", {
      report_id: "r-1",
      study_id: "s-1",
      patient_id: "p-1",
      status: "draft",
      findings_text: "findings",
      impression_text: "impression",
    });
  });

  it("converts an update payload the same way", async () => {
    patch.mockResolvedValue({ id: "r-1" });
    await reportClient.updateReport("r-1", {
      findingsText: "new findings",
      status: "in_progress",
      actorId: "u-1",
    });

    expect(patch).toHaveBeenCalledWith("/api/v1/reports/r-1", {
      findings_text: "new findings",
      impression_text: undefined,
      status: "in_progress",
      actorId: "u-1",
    });
  });

  it("sends the signature on both fields the finalize endpoint accepts", async () => {
    post.mockResolvedValue({ id: "r-1" });
    await reportClient.finalizeReport("r-1", "Dr. Who");
    expect(post).toHaveBeenCalledWith("/api/v1/reports/r-1/finalize", {
      approvedBy: "Dr. Who",
      signature: "Dr. Who",
    });
  });

  it("defaults the by-patient limit to 20", async () => {
    get.mockResolvedValue([]);
    await reportClient.getReportsByPatient("p-1");
    expect(get).toHaveBeenCalledWith("/api/v1/reports/by-patient/p-1", { query: { limit: 20 } });
  });

  it("reads revisions and comparisons off the report's sub-resources", async () => {
    get.mockResolvedValue([]);
    await reportClient.getRevisions("r-1");
    expect(get).toHaveBeenCalledWith("/api/v1/reports/r-1/revisions");

    await reportClient.getComparisons("r-1");
    expect(get).toHaveBeenCalledWith("/api/v1/reports/r-1/comparisons");
  });

  it("creates a comparison against a prior study", async () => {
    post.mockResolvedValue({ id: "c-1" });
    await reportClient.createComparison("r-1", {
      priorStudyUid: "1.2.3",
      priorSeriesUid: "1.2.3.4",
      timeDeltaDays: 180,
    });

    expect(post).toHaveBeenCalledWith("/api/v1/reports/r-1/comparisons", {
      priorStudyUid: "1.2.3",
      priorSeriesUid: "1.2.3.4",
      timeDeltaDays: 180,
    });
  });
});

describe("exportStructuredReport", () => {
  it("takes the file name from the content-disposition header", async () => {
    fetchMock.mockResolvedValue(
      fileResponse("dicom-bytes", {
        "content-type": "application/dicom",
        "content-disposition": 'attachment; filename="befund-r-1.dcm"',
      }),
    );

    const result = await reportClient.exportStructuredReport("r-1");
    expect(result.fileName).toBe("befund-r-1.dcm");
    expect(result.contentType).toBe("application/dicom");
  });

  it("falls back to a report-derived name and the format's content type", async () => {
    fetchMock.mockResolvedValue(fileResponse("json-bytes"));

    const dicom = await reportClient.exportStructuredReport("r-1");
    expect(dicom.fileName).toBe("report-r-1-sr.dcm");
    expect(dicom.contentType).toBe("application/dicom");

    const json = await reportClient.exportStructuredReport("r-1", "json");
    expect(json.fileName).toBe("report-r-1-sr.json");
    expect(json.contentType).toBe("application/dicom+json");
  });

  it("requests the format the caller asked for and sends the auth cookie", async () => {
    fetchMock.mockResolvedValue(fileResponse("json-bytes"));
    await reportClient.exportStructuredReport("r-1", "json");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/reports/r-1/export-sr?format=json");
    expect(init.credentials).toBe("include");
  });

  it("raises the server's message on failure", async () => {
    fetchMock.mockResolvedValue(
      fileResponse("report has no findings", {}, { ok: false, status: 409 }),
    );
    await expect(reportClient.exportStructuredReport("r-1")).rejects.toThrow(
      "report has no findings",
    );
  });

  it("raises a generic message when the server says nothing", async () => {
    fetchMock.mockResolvedValue(fileResponse("", {}, { ok: false, status: 500 }));
    await expect(reportClient.exportStructuredReport("r-1")).rejects.toThrow(
      "DICOM SR export failed",
    );
  });
});

describe("exportPdf", () => {
  it("takes the file name from the content-disposition header", async () => {
    fetchMock.mockResolvedValue(
      fileResponse("pdf-bytes", { "content-disposition": "attachment; filename=befund.pdf" }),
    );
    await expect(reportClient.exportPdf("r-1")).resolves.toMatchObject({ fileName: "befund.pdf" });
  });

  it("falls back to a report-derived name", async () => {
    fetchMock.mockResolvedValue(fileResponse("pdf-bytes"));
    await expect(reportClient.exportPdf("r-1")).resolves.toMatchObject({
      fileName: "report-r-1.pdf",
    });
  });

  it("raises the server's message on failure", async () => {
    fetchMock.mockResolvedValue(fileResponse("no template", {}, { ok: false, status: 500 }));
    await expect(reportClient.exportPdf("r-1")).rejects.toThrow("no template");
  });
});

describe("streamImpression", () => {
  /** An SSE body delivered in whatever chunks the test wants to simulate. */
  function sseResponse(chunks: string[], init: { ok?: boolean; status?: number } = {}) {
    const encoder = new TextEncoder();
    let index = 0;
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      body: {
        getReader: () => ({
          read: async () =>
            index < chunks.length
              ? { done: false, value: encoder.encode(chunks[index++]) }
              : { done: true, value: undefined },
        }),
      },
      text: async () => chunks.join(""),
    } as unknown as Response;
  }

  async function collect(stream: AsyncGenerator<string>) {
    const out: string[] = [];
    for await (const chunk of stream) out.push(chunk);
    return out;
  }

  it("yields the payload of each data line", async () => {
    fetchMock.mockResolvedValue(sseResponse(["data: Kein\n", "data: Befund\n"]));
    await expect(collect(reportClient.streamImpression({ findingsText: "f" }))).resolves.toEqual([
      "Kein",
      "Befund",
    ]);
  });

  it("reassembles data lines split across chunk boundaries", async () => {
    fetchMock.mockResolvedValue(sseResponse(["data: Unauf", "fällig\n"]));
    await expect(collect(reportClient.streamImpression({}))).resolves.toEqual(["Unauffällig"]);
  });

  it("stops at [DONE] and ignores anything after it", async () => {
    fetchMock.mockResolvedValue(sseResponse(["data: one\n", "data: [DONE]\n", "data: two\n"]));
    await expect(collect(reportClient.streamImpression({}))).resolves.toEqual(["one"]);
  });

  it("restores escaped newlines inside a payload", async () => {
    fetchMock.mockResolvedValue(sseResponse(["data: line one\\nline two\n"]));
    await expect(collect(reportClient.streamImpression({}))).resolves.toEqual([
      "line one\nline two",
    ]);
  });

  it("skips comment and event lines", async () => {
    fetchMock.mockResolvedValue(sseResponse([": keep-alive\n", "event: ping\n", "data: text\n"]));
    await expect(collect(reportClient.streamImpression({}))).resolves.toEqual(["text"]);
  });

  it("sends the findings, image URLs and report id as snake_case JSON", async () => {
    fetchMock.mockResolvedValue(sseResponse(["data: [DONE]\n"]));
    await collect(
      reportClient.streamImpression({
        findingsText: "findings",
        imageUrls: ["http://example.test/1.dcm"],
        reportId: "r-1",
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      findings_text: "findings",
      image_urls: ["http://example.test/1.dcm"],
      report_id: "r-1",
    });
  });

  it("defaults the findings and image URLs when the caller omits them", async () => {
    fetchMock.mockResolvedValue(sseResponse(["data: [DONE]\n"]));
    await collect(reportClient.streamImpression({}));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      findings_text: "",
      image_urls: [],
      report_id: undefined,
    });
  });

  it("reports the status and the server's message when the stream cannot start", async () => {
    fetchMock.mockResolvedValue(sseResponse(["model unavailable"], { ok: false, status: 503 }));
    await expect(collect(reportClient.streamImpression({}))).rejects.toThrow(
      "Stream impression failed (503): model unavailable",
    );
  });
});
