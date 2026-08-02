import { describe, it, expect, beforeEach, vi } from "vitest";
import { authClient } from "@/services/authClient";
import { apiClient } from "@/services/apiClient";
import { AUTH_USER_KEY } from "@/lib/authStorage";

vi.mock("@/services/apiClient", () => ({
  apiClient: { post: vi.fn() },
}));

const post = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("login", () => {
  it("caches only non-secret display data — the JWT stays in the HttpOnly cookie", async () => {
    post.mockResolvedValue({ user_id: "u-1", username: "dr.who", role: "radiologist" });

    await authClient.login({ username: "dr.who", password: "hunter2" });

    const stored = JSON.parse(localStorage.getItem(AUTH_USER_KEY)!);
    expect(stored).toEqual({ id: "u-1", username: "dr.who", role: "radiologist" });
    expect(JSON.stringify(stored)).not.toContain("hunter2");
  });

  it("posts the credentials to the login endpoint and returns the response", async () => {
    const response = { user_id: "u-1", username: "dr.who", role: "radiologist" };
    post.mockResolvedValue(response);

    await expect(authClient.login({ username: "dr.who", password: "hunter2" })).resolves.toEqual(
      response,
    );
    expect(post).toHaveBeenCalledWith("/api/v1/auth/login", {
      username: "dr.who",
      password: "hunter2",
    });
  });

  it("caches nothing when the login is rejected", async () => {
    post.mockRejectedValue(new Error("401"));

    await expect(authClient.login({ username: "dr.who", password: "wrong" })).rejects.toThrow();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });
});

describe("logout", () => {
  it("clears the cached user", async () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u-1" }));
    post.mockResolvedValue({});

    await authClient.logout();

    expect(post).toHaveBeenCalledWith("/api/v1/auth/logout");
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it("clears the cached user even when the request fails, so the UI cannot stay logged in", async () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u-1" }));
    post.mockRejectedValue(new Error("network down"));

    await expect(authClient.logout()).rejects.toThrow("network down");
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });
});

describe("getUser", () => {
  it("returns the cached user", () => {
    const user = { id: "u-1", username: "dr.who", role: "radiologist" };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    expect(authClient.getUser()).toEqual(user);
  });

  it("returns null when nothing is cached", () => {
    expect(authClient.getUser()).toBeNull();
  });

  it("treats a corrupt stored value as logged out instead of throwing", () => {
    localStorage.setItem(AUTH_USER_KEY, "{not json");
    expect(authClient.getUser()).toBeNull();
  });
});

describe("isAuthenticated", () => {
  it("reflects whether a login previously succeeded on this browser", () => {
    expect(authClient.isAuthenticated()).toBe(false);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u-1" }));
    expect(authClient.isAuthenticated()).toBe(true);
  });
});
