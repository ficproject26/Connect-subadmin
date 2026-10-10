// Centralized fetch wrapper with Bearer token injection, resilient startup retry,
// client-side in-memory caching (SWR), request deduplication, and controlled error handling.

// Detect if running inside Electron desktop runtime (file:// protocol or preload flag)
export const isElectron =
  (typeof window !== 'undefined' && window.electronAPI?.isElectron === true) ||
  (typeof navigator !== 'undefined' && (navigator.userAgent || '').toLowerCase().includes('electron')) ||
  (typeof window !== 'undefined' && window.location?.protocol === 'file:');

// Detect if running in a standard web browser served over HTTP/HTTPS
export const isWebBrowser =
  typeof window !== 'undefined' &&
  window.location &&
  (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
  !isElectron;

// Direct backend URL for standalone/desktop/Electron contexts or fallback
export const BACKEND_DIRECT_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  'https://api.ficapp.in/subadmin-api'
).trim().replace(/\/+$/, '');

// In a web browser (Vercel production or Vite dev), default to relative '' so all requests
// route through the same-origin proxy (/api/*). This completely prevents cross-origin
// net::ERR_CONNECTION_RESET and CORS errors in browser devtools.
// In Electron / file:// runtime, use the direct backend URL.
export const API_BASE_URL = isWebBrowser ? '' : BACKEND_DIRECT_URL;

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

// Client-side cache and deduplication structures
const apiCache = new Map();
const inFlightRequests = new Map();

// Helper to determine cache TTL based on endpoint characteristics
function getEndpointTTL(endpoint) {
  const ep = endpoint.toLowerCase();
  // Geography and hierarchy entities change very rarely -> 10 minutes
  if (ep.includes('/admin/districts') || ep.includes('/admin/divisions') || ep.includes('/admin/pincodes') || ep.includes('/admin/states') || ep.includes('/territory')) {
    return 10 * 60 * 1000;
  }
  // User authentication and categories -> 5 minutes
  if (ep.includes('/auth/me') || ep.includes('/categories')) {
    return 5 * 60 * 1000;
  }
  // Dynamic business data (orders, bookings, jobs, vendors, customers, reports) -> 45 seconds
  return 45 * 1000;
}

// Invalidate cache keys matching prefix or all
export function clearApiCache(prefix = '') {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  const target = prefix.toLowerCase();
  for (const key of apiCache.keys()) {
    if (key.toLowerCase().includes(target)) {
      apiCache.delete(key);
    }
  }
}

// Invalidate relevant cache namespaces when a mutating request occurs
function invalidateRelatedCaches(endpoint) {
  const ep = endpoint.toLowerCase();
  if (ep.includes('/order')) {
    clearApiCache('/orders');
    clearApiCache('/reports');
  } else if (ep.includes('/booking')) {
    clearApiCache('/bookings');
    clearApiCache('/reports');
  } else if (ep.includes('/job')) {
    clearApiCache('/jobs');
    clearApiCache('/reports');
  } else if (ep.includes('/vendor')) {
    clearApiCache('/vendors');
    clearApiCache('/reports');
  } else if (ep.includes('/customer')) {
    clearApiCache('/customers');
    clearApiCache('/reports');
  } else if (ep.includes('/admin') || ep.includes('/territory')) {
    clearApiCache('/admin');
    clearApiCache('/territory');
    clearApiCache('/reports');
  } else {
    clearApiCache('/reports');
  }
}

// Internal core HTTP fetch execution
async function executeFetch(endpoint, options, headers) {
  let candidateUrls = [];

  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    candidateUrls = [endpoint];
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const relativeUrl = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
    const directUrl = `${BACKEND_DIRECT_URL}${cleanEndpoint.startsWith('/api') ? '' : '/api'}${cleanEndpoint}`;

    if (isWebBrowser) {
      // In web browser: Prioritize same-origin relative proxy (/api/...) to eliminate ERR_CONNECTION_RESET
      // Direct backend URL acts as a secondary fallback if the local or Vercel proxy fails.
      candidateUrls = [relativeUrl];
      if (directUrl !== relativeUrl) {
        candidateUrls.push(directUrl);
      }
    } else {
      // In Electron / desktop / file://: Relative paths cannot resolve; prioritize direct backend URL.
      candidateUrls = [directUrl];
      if (relativeUrl !== directUrl) {
        candidateUrls.push(relativeUrl);
      }
    }
  }

  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const maxRetries = options.retries ?? (isGet ? 2 : 0);

  const noAutoLogoutEndpoints = ['/auth/login', '/auth/me', '/auth/register'];
  const isNoAutoLogout = noAutoLogoutEndpoints.some((e) => endpoint.includes(e));

  let lastError = null;

  for (const currentUrl of candidateUrls) {
    // If we have an alternative candidate URL, retry network errors at most once on the primary URL before trying fallback
    const retriesForThisUrl = (candidateUrls.length > 1 && currentUrl === candidateUrls[0] && !isElectron)
      ? Math.min(maxRetries, 1)
      : maxRetries;

    for (let attempt = 0; attempt <= retriesForThisUrl; attempt++) {
      try {
        const response = await fetch(currentUrl, { ...options, headers });

        let data;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (jsonErr) {
            const text = await response.text().catch(() => '');
            data = { message: sanitizeErrorMessage(text, response.status) || `Request failed with status ${response.status}` };
          }
        } else {
          const text = await response.text();
          data = { message: sanitizeErrorMessage(text, response.status) };
        }

        if (!response.ok) {
          if (response.status === 503 && attempt < retriesForThisUrl) {
            await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            continue;
          }

          if (response.status === 401 && !isNoAutoLogout) {
            localStorage.removeItem('ams_token');
            localStorage.removeItem('ams_user');
            const loginPath = isElectron ? '/#/login' : '/login';
            if (window.location.pathname !== '/login' && window.location.hash !== '#/login') {
              window.location.href = loginPath;
            }
          }

          const rawMessage = data?.message || data?.msg || `Request failed with status ${response.status}`;
          const error = new Error(sanitizeErrorMessage(rawMessage, response.status));
          error.status = response.status;
          throw error;
        }

        return data;
      } catch (error) {
        lastError = error;
        if (attempt < retriesForThisUrl && (!error.status || error.status === 503)) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    // Stop trying candidate fallback URLs if we got an authoritative client HTTP response (4xx except 408)
    if (lastError?.status && lastError.status >= 400 && lastError.status < 500 && lastError.status !== 408) {
      break;
    }
  }

  const cleanMsg = sanitizeErrorMessage(lastError?.message || '', lastError?.status);
  const cleanError = new Error(cleanMsg);
  cleanError.status = lastError?.status;
  console.error(`API Error [${endpoint}]:`, cleanMsg);
  throw cleanError;
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('ams_token') || 'anon';
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  // Invalidate relevant cache namespaces on state mutations
  if (!isGet) {
    invalidateRelatedCaches(endpoint);
  }

  const headers = {
    ...(token && token !== 'anon' ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const cacheKey = `${token}:${method}:${cleanEndpoint}`;

  // Serve from client-side SWR cache if valid GET
  if (isGet && !options.skipCache && !options.fresh) {
    const cached = apiCache.get(cacheKey);
    const ttl = getEndpointTTL(cleanEndpoint);
    const now = Date.now();

    if (cached && (now - cached.timestamp < ttl)) {
      // Background revalidation if older than 20 seconds
      if (now - cached.timestamp > 20000 && !inFlightRequests.has(cacheKey)) {
        const bgPromise = executeFetch(cleanEndpoint, options, headers)
          .then((freshData) => {
            apiCache.set(cacheKey, { data: freshData, timestamp: Date.now() });
            return freshData;
          })
          .catch(() => {})
          .finally(() => inFlightRequests.delete(cacheKey));
        inFlightRequests.set(cacheKey, bgPromise);
      }
      return cached.data;
    }

    // Deduplicate in-flight requests
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const fetchPromise = executeFetch(cleanEndpoint, options, headers)
    .then((data) => {
      if (isGet) {
        apiCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    })
    .finally(() => {
      if (isGet) {
        inFlightRequests.delete(cacheKey);
      }
    });

  if (isGet && !options.skipCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}
