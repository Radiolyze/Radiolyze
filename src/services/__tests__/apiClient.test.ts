import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiClient, ApiError, setApiErrorHandler } from "@/services/apiClient";
import { AUTH_USER_KEY } from "@/lib/authStorage";

/** A `fetch` response stub: only the parts apiClient actually reads. */
function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? "",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? "",
    headers: new Headers({ "content-type": "text/plain" }),
    json: async () => {
      throw new Error("not json");
    },
    text: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

/** The last fetch call as [url, init], typed for convenient assertions. */
function lastCall() {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ];
  return { url, init, headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setApiErrorHandler(null);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("request building", () => {
  it("resolves relative paths against the page origin", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiClient.get("/api/v1/health");
    expect(lastCall().url).toBe(`${window.location.origin}/api/v1/health`);
  });

  it("appends query parameters and skips undefined ones", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await apiClient.get("/api/v1/reports", {
      query: { status: "draft", limit: 20, offset: undefined, includeDone: false },
    });

    const url = new URL(lastCall().url);
    expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("includeDone")).toBe("false");
    expect(url.searchParams.has("offset")).toBe(false);
  });

  it("sends the auth cookie rather than an Authorization header", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiClient.get("/api/v1/reports");

    const { init, headers } = lastCall();
    expect(init.credentials).toBe("include");
    expect(headers.Authorization).toBeUndefined();
  });

  it("tags every request with a distinct X-Request-ID", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiClient.get("/api/v1/reports");
    const first = lastCall().headers["X-Request-ID"];
    await apiClient.get("/api/v1/reports");
    const second = lastCall().headers["X-Request-ID"];

    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it("lets callers override the default headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiClient.get("/api/v1/reports", { headers: { "Content-Type": "text/csv" } });
    expect(lastCall().headers["Content-Type"]).toBe("text/csv");
  });

  it("serialises the body for writes and omits it entirely for reads", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiClient.post("/api/v1/reports/create", { study_id: "s-1" });
    expect(lastCall().init.method).toBe("POST");
    expect(lastCall().init.body).toBe('{"study_id":"s-1"}');

    await apiClient.get("/api/v1/reports");
    expect(lastCall().init.body).toBeUndefined();
  });

  it.each([
    ["get", "GET"],
    ["post", "POST"],
    ["put", "PUT"],
    ["patch", "PATCH"],
    ["delete", "DELETE"],
  ] as const)("%s issues a %s", async (method, expected) => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiClient[method]("/api/v1/reports/r-1");
    expect(lastCall().init.method).toBe(expected);
  });
});

describe("response handling", () => {
  it("parses JSON responses", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "r-1" }));
    await expect(apiClient.get("/api/v1/reports/r-1")).resolves.toEqual({ id: "r-1" });
  });

  it("returns the raw text for non-JSON responses", async () => {
    fetchMock.mockResolvedValue(textResponse("pong"));
    await expect(apiClient.get("/api/v1/ping")).resolves.toBe("pong");
  });

  it("throws an ApiError carrying the status and the parsed payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Report not found" }, { status: 404, statusText: "Not Found" }),
    );

    const error = (await apiClient.get("/api/v1/reports/missing").catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not Found");
    expect(error.payload).toEqual({ detail: "Report not found" });
  });

  it("notifies the registered error handler once per failure", async () => {
    const handler = vi.fn();
    setApiErrorHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500, statusText: "Server Error" }));

    await expect(apiClient.get("/api/v1/reports")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].status).toBe(500);
  });

  it("stops notifying once the handler is unregistered", async () => {
    const handler = vi.fn();
    setApiErrorHandler(handler);
    setApiErrorHandler(null);
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));

    await expect(apiClient.get("/api/v1/reports")).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("401 handling", () => {
  it("drops the cached user and sends the browser to the login page", async () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u-1" }));
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 401 }));

    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: original.origin,
        pathname: "/reports",
        set href(value: string) {
          assign(value);
        },
      },
    });

    try {
      await expect(apiClient.get("/api/v1/reports")).rejects.toBeInstanceOf(ApiError);
      expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
      expect(assign).toHaveBeenCalledWith("/login");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("does not redirect when the login page itself gets the 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 401 }));

    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: original.origin,
        pathname: "/login",
        set href(value: string) {
          assign(value);
        },
      },
    });

    try {
      await expect(apiClient.post("/api/v1/auth/login", {})).rejects.toBeInstanceOf(ApiError);
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});

describe("retrying", () => {
  it.each([502, 503, 504])("retries a %i and returns the eventual success", async (status) => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, { status }))
      .mockResolvedValueOnce(jsonResponse({ id: "r-1" }));

    const pending = apiClient.get("/api/v1/reports/r-1");
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ id: "r-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts and surfaces the last response", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 503, statusText: "Unavailable" }));

    const pending = apiClient.get("/api/v1/reports");
    const settled = pending.catch((e) => e);
    await vi.runAllTimersAsync();

    const error = (await settled) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially between attempts", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 503 }));

    const pending = apiClient.get("/api/v1/reports");
    const settled = pending.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await vi.runAllTimersAsync();
    await settled;
  });

  it("does not retry a 4xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 404 }));
    await expect(apiClient.get("/api/v1/reports/missing")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure and rethrows it once the attempts run out", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const settled = apiClient.get("/api/v1/reports").catch((e) => e);
    await vi.runAllTimersAsync();

    const error = (await settled) as TypeError;
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("recovers when a network failure is followed by a success", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ id: "r-1" }));

    const pending = apiClient.get("/api/v1/reports/r-1");
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ id: "r-1" });
  });
});
