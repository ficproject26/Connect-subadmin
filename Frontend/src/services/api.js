// Centralized fetch wrapper with Bearer token injection, resilient startup retry,
// and controlled error handling.

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://api.ficapp.in/subadmin-api' : '')
).trim().replace(/\/+$/, '');

// Sanitizes raw server/proxy/network error messages to keep UI clean and secure
export function sanitizeErrorMessage(message, status) {
  if (!message || typeof message !== 'string') {
    return 'Unable to connect to the server. Please try again.';
  }

  const lower = message.toLowerCase();

  // If Vercel router error, gateway error, or connection error
  if (
    lower.includes('router_external_target_connection_error') ||
    lower.includes('an error occurred with this application') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('502 bad gateway') ||
    lower.includes('504 gateway timeout') ||
    lower.includes('<!doctype') ||
    lower.includes('<html')
  ) {
    return 'Unable to connect to the server. Please try again.';
  }

  return message;
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('ams_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let url;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    url = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (API_BASE_URL) {
      const hasApiPrefix = API_BASE_URL.endsWith('/api') || cleanEndpoint.startsWith('/api');
      url = `${API_BASE_URL}${hasApiPrefix ? '' : '/api'}${cleanEndpoint}`;
    } else {
      url = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
    }
  }

  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const maxRetries = options.retries ?? (isGet ? 2 : 0);

  // Endpoints that must NEVER trigger a 401-logout redirect.
  // /auth/login responses are intentional (wrong credentials).
  // /auth/me is called during startup; handled by AuthContext.initAuth().
  const noAutoLogoutEndpoints = ['/auth/login', '/auth/me', '/auth/register'];
  const isNoAutoLogout = noAutoLogoutEndpoints.some((e) => endpoint.includes(e));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: sanitizeErrorMessage(text, response.status) };
      }

      if (!response.ok) {
        // Retry on 503 (backend restarting)
        if (response.status === 503 && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }

        // 401 on a protected endpoint that is NOT login/me:
        // clear the stale token and redirect to login.
        if (response.status === 401 && !isNoAutoLogout) {
          localStorage.removeItem('ams_token');
          localStorage.removeItem('ams_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }

        const rawMessage = data?.message || `Request failed with status ${response.status}`;
        const error = new Error(sanitizeErrorMessage(rawMessage, response.status));
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      if (attempt < maxRetries && (!error.status || error.status === 503)) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }

      const cleanMsg = sanitizeErrorMessage(error.message || '', error.status);
      const cleanError = new Error(cleanMsg);
      cleanError.status = error.status;
      console.error(`API Error [${endpoint}]:`, cleanMsg);
      throw cleanError;
    }
  }
}
