// API client for the LUCEA backend.
//
// The base URL is relative by default (/api/v1). In development Vite proxies
// that path to the FastAPI container and in production nginx does the same, so
// the browser is always on a single origin and no CORS preflight is involved.
// Set VITE_API_URL only when the API lives on a different host.

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const TOKEN_KEY = 'lucea_admin_token';

/**
 * Staff tokens live in sessionStorage, not localStorage.
 *
 * They still survive a reload and a navigation, but they are scoped to the
 * tab and cleared when it closes, so a stolen token from a shared or
 * unattended machine has a much shorter useful life. Access tokens are short
 * lived (15 minutes) and the refresh token is single use server side.
 */
const tokenStore = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  return tokenStore()?.getItem(TOKEN_KEY) ?? null;
}

export function setStoredToken(token: string | null): void {
  const store = tokenStore();
  if (!store) return; // storage unavailable, session stays in memory only
  if (token) store.setItem(TOKEN_KEY, token);
  else store.removeItem(TOKEN_KEY);
}

interface FetchOptions extends RequestInit {
  /** Attach the stored staff token. Defaults to true so admin calls cannot forget it. */
  auth?: boolean;
}

export async function fetchApi(endpoint: string, options: FetchOptions = {}) {
  const { auth = true, headers: callerHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(callerHeaders as Record<string, string> | undefined),
  };

  if (auth && !headers.Authorization) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...rest, headers });
  } catch {
    throw new ApiError(
      'Connexion au serveur impossible. Verifiez votre reseau puis reessayez.',
      0
    );
  }

  if (response.status === 204) return null;

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    // FastAPI reports failures as {"detail": "..."} or a validation array
    const detail = payload?.detail;
    let message: string;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail) && detail[0]?.msg) {
      message = detail[0].msg;
    } else {
      message = `La requete a echoue (${response.status})`;
    }
    throw new ApiError(message, response.status);
  }

  return payload;
}
