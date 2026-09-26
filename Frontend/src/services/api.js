// Centralized fetch wrapper with Bearer token injection and resilient startup retry.
//
// 401 HANDLING POLICY:
// The api.js layer clears the token only when the request was NOT the login call itself.
// Clearing the token on every 401 (including the /auth/me call fired just after login)
// caused a race condition where the token was wiped before navigate() could fire.

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('ams_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = endpoint.startsWith('http')
    ? endpoint
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const maxRetries = options.retries ?? (isGet ? 2 : 0);

  // Endpoints that must NEVER trigger a 401-logout redirect.
  // /auth/login responses are always intentional (wrong credentials).
  // /auth/me is called during startup; a 401 there should be handled by
  // AuthContext.initAuth(), not by a hard page redirect here.
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
        data = { message: text || `HTTP ${response.status} ${response.statusText}` };
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

        const error = new Error(
          data?.message || `Request failed with status ${response.status}`
        );
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      if (attempt < maxRetries && (!error.status || error.status === 503)) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      console.error(`API Error [${endpoint}]:`, error.message || error);
      throw error;
    }
  }
}
