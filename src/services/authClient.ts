import { AUTH_USER_KEY } from "@/lib/authStorage";
import { apiClient } from "./apiClient";
import { logger } from "@/lib/logger";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  user_id: string;
  username: string;
  role: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export const authClient = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    // The backend sets the JWT as an HttpOnly cookie on the response (see
    // issue #100) - it never appears in this body, so there's nothing for
    // page JS to read or exfiltrate. Only non-secret display data is cached
    // here for the UI.
    const response = await apiClient.post<LoginResponse>("/api/v1/auth/login", payload);
    localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify({
        id: response.user_id,
        username: response.username,
        role: response.role,
      }),
    );
    return response;
  },

  async logout() {
    try {
      await apiClient.post("/api/v1/auth/logout");
    } finally {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  },

  getUser(): { id: string; username: string; role: string } | null {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      logger.debug("[authClient] Failed to parse stored user, treating as logged out", err);
      return null;
    }
  },

  /**
   * Best-effort, client-side-only check. The cookie itself isn't readable
   * from JS, so this just reflects whether a login previously succeeded on
   * this browser; the backend remains the source of truth and returns 401
   * on any request once the cookie is missing/expired.
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem(AUTH_USER_KEY);
  },
};
