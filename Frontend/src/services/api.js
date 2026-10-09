// Centralized fetch wrapper with Bearer token injection, resilient startup retry,
// client-side in-memory caching (SWR), request deduplication, and controlled error handling.

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

  const noAutoLogoutEndpoints = ['/auth/login', '/auth/me', '/auth/register'];
  const isNoAutoLogout = noAutoLogoutEndpoints.some((e) => endpoint.includes(e));

  const candidateUrls = [url];
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const relativeUrl = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
    if (url !== relativeUrl && !candidateUrls.includes(relativeUrl)) {
      candidateUrls.push(relativeUrl);
    }
  }

  let lastError = null;

  for (const currentUrl of candidateUrls) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          if (response.status === 503 && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            continue;
          }

          if (response.status === 401 && !isNoAutoLogout) {
            localStorage.removeItem('ams_token');
            localStorage.removeItem('ams_user');
            const isElectron =
              (typeof window !== 'undefined' && window.electronAPI?.isElectron === true) ||
              (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'));
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
        if (attempt < maxRetries && (!error.status || error.status === 503)) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
        break;
      }
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
