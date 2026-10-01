import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // Use '/' for web deployments so deep routes (/state-admin/dashboard, etc.) resolve assets correctly.
  // Use './' only when explicitly building for Electron via ELECTRON=true.
  base: process.env.ELECTRON === 'true' ? './' : '/',

  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8006',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Backend server is temporarily restarting, please retry.' }));
            }
          });
        }
      },
      '/uploads': {
        target: 'http://127.0.0.1:8006',
        changeOrigin: true,
        secure: false
      }
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Improve chunk loading performance in Electron
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
}));

