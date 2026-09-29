'use strict';

/**
 * Electron Preload Script
 *
 * This script runs in an isolated context before the renderer page loads.
 * contextIsolation: true means this runs in a separate JS context from the page.
 * nodeIntegration: false means the renderer has NO access to Node.js APIs.
 *
 * Only expose what is strictly necessary via contextBridge.
 * This application manages its own auth/API via fetch + localStorage,
 * so the renderer does not need any Node.js APIs.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API surface to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Returns true when running inside Electron (renderer can check this)
   */
  isElectron: true,

  /**
   * Platform info (e.g. 'win32', 'darwin', 'linux')
   */
  platform: process.platform,

  /**
   * App version from package.json
   */
  getVersion: () => ipcRenderer.invoke('app:get-version'),
});
