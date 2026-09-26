// Vercel Serverless Function API Proxy
// Proxies /api/* requests server-side to avoid Edge router non-standard port errors
// and HTTPS -> HTTP mixed content issues.

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BACKEND_URL = (
  process.env.BACKEND_API_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_API_BASE ||
  'https://api.ficapp.in/subadmin-api'
).replace(/\/+$/, '');

module.exports = async function handler(req, res) {
  // CORS Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    let subPath = req.url || '';
    if (!subPath.startsWith('/api') && !subPath.startsWith('/uploads')) {
      subPath = `/api${subPath.startsWith('/') ? subPath : `/${subPath}`}`;
    }

    const targetUrl = new URL(`${BACKEND_URL}${subPath}`);
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestHeaders = { ...req.headers };
    delete requestHeaders.host;
    delete requestHeaders.connection;
    requestHeaders['x-forwarded-host'] = req.headers.host;

    let bodyBuffer = null;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body) {
        if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
          bodyBuffer = Buffer.from(req.body);
        } else {
          bodyBuffer = Buffer.from(JSON.stringify(req.body));
        }
        requestHeaders['content-length'] = Buffer.byteLength(bodyBuffer);
      } else {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          bodyBuffer = Buffer.concat(chunks);
          requestHeaders['content-length'] = bodyBuffer.length;
        }
      }
    }

    const proxyReq = client.request(
      targetUrl,
      {
        method: req.method,
        headers: requestHeaders,
        timeout: 15000
      },
      (proxyRes) => {
        res.statusCode = proxyRes.statusCode || 200;
        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
            try {
              res.setHeader(key, val);
            } catch (e) {}
          }
        }

        const chunks = [];
        proxyRes.on('data', (c) => chunks.push(c));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks);
          res.end(body);
        });
      }
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          message: 'Unable to connect to the server. Request timed out.'
        }));
      }
    });

    proxyReq.on('error', (err) => {
      console.error('Backend proxy error:', err.message);
      if (!res.headersSent) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          message: 'Unable to connect to the server. Please try again.'
        }));
      }
    });

    if (bodyBuffer) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  } catch (err) {
    console.error('Proxy exception:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        message: 'Unable to connect to the server. Please try again.'
      }));
    }
  }
};
