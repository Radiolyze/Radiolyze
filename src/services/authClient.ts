import { apiClient } from './apiClient';

const AUTH_TOKEN_KEY = 'radiolyze-auth-token';
const AUTH_USER_KEY = 'radiolyze-auth-user';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
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
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', payload);
    localStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
      id: response.user_id,
      username: response.username,
      role: response.role,
    }));
    return response;
  },

  logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getUser(): { id: string; username: string; role: string } | null {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  },
};
