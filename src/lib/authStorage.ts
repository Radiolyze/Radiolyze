/**
 * The JWT itself is never kept here - it lives only in the HttpOnly
 * `radiolyze_token` cookie set by the backend (see issue #100), so page JS
 * can't read or exfiltrate it. This key only caches non-secret display data
 * (id/username/role) for the UI, shared between apiClient and authClient to
 * avoid two copies of the same magic string drifting apart.
 */
export const AUTH_USER_KEY = 'radiolyze-auth-user';
