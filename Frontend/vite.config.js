import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // Use relative base so assets work when loaded via file:// in Electron.
  // The web build on Vercel/Nginx already resolves '/' correctly, so '.'
  // works for both file:// (Electron) and rooted HTTP deployments.
  base: './',

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

