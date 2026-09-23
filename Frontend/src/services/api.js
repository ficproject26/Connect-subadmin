// Centralized fetch wrapper with Bearer token injection and resilient startup retry
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('ams_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const maxRetries = options.retries ?? (isGet ? 2 : 0);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text || `HTTP ${response.status} ${response.statusText}` };
      }

      if (!response.ok) {
        // If 503 (backend starting up / proxy restarting) and retry attempts remain
        if (response.status === 503 && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }

        if (response.status === 401) {
          localStorage.removeItem('ams_token');
          localStorage.removeItem('ams_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        
        const error = new Error(data?.message || `Request failed with status ${response.status}`);
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

