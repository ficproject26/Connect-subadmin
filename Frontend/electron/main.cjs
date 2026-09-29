'use strict';

const { app, BrowserWindow, shell, dialog, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_NAME = 'Forge India Connect – Admin';
const DEV_SERVER_URL = 'http://localhost:3000';
const isDev = process.env.ELECTRON_DEV === 'true' || !app.isPackaged;

// ─── Single Instance Lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ─── Window reference ─────────────────────────────────────────────────────────
let mainWindow = null;

// ─── Resolve preload path ─────────────────────────────────────────────────────
function getPreloadPath() {
  const cjsPath = path.join(__dirname, 'preload.cjs');
  if (fs.existsSync(cjsPath)) return cjsPath;
  return path.join(__dirname, 'preload.js');
}

// ─── Resolve dist index.html for production ───────────────────────────────────
function getProductionIndexPath() {
  // When packaged: resources/app/dist/index.html or resources/app/Frontend/dist/index.html
  // When running via `electron .` from project root: Frontend/dist/index.html
  const candidates = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'app', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'app', 'Frontend', 'dist', 'index.html'),
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(app.getAppPath(), 'Frontend', 'dist', 'index.html'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback
  return path.join(__dirname, '..', 'dist', 'index.html');
}

// ─── Create main window ───────────────────────────────────────────────────────
function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  // Use 90% of the primary display, clamped to reasonable bounds
  const winWidth  = Math.min(Math.max(Math.floor(screenW * 0.90), 1280), 1920);
  const winHeight = Math.min(Math.max(Math.floor(screenH * 0.90), 760), 1080);

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: winWidth,
    height: winHeight,
    minWidth: 1024,
    minHeight: 640,
    center: true,
    show: false,                    // Show only after content loads (avoids white flash)
    frame: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,       // Security: no Node in renderer
      contextIsolation: true,       // Security: isolated context
      sandbox: false,               // sandbox:true breaks some Vite features; keep false
      webSecurity: true,            // Keep web security ON
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Allow localStorage, sessionStorage, indexedDB (needed for auth tokens)
      partition: 'persist:ams',
    },
    backgroundColor: '#0b1322',     // Match the app's dark background to prevent white flash
  });

  // ── Window ready-to-show ───────────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // ── Window closed ─────────────────────────────────────────────────────────
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ── External link handling ─────────────────────────────────────────────────
  // Open all external links in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent navigation away from the app (security)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowed =
      url === DEV_SERVER_URL ||
      url.startsWith(DEV_SERVER_URL + '/') ||
      url.startsWith('file://') ||
      url.startsWith('app://');
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // ── Load content ──────────────────────────────────────────────────────────
  if (isDev) {
    loadDevServer();
  } else {
    loadProduction();
  }
}

// ─── Load development server with retry ──────────────────────────────────────
function loadDevServer(attempt = 0) {
  const maxAttempts = 30;
  const retryDelayMs = 1000;

  mainWindow.loadURL(DEV_SERVER_URL).catch(() => {
    if (attempt < maxAttempts) {
      setTimeout(() => loadDevServer(attempt + 1), retryDelayMs);
    } else {
      dialog.showErrorBox(
        'Development Server Not Found',
        `Could not connect to Vite dev server at ${DEV_SERVER_URL}.\n\nPlease ensure Vite is running on port 3000.`
      );
    }
  });
}

// ─── Load production build ────────────────────────────────────────────────────
function loadProduction() {
  const indexPath = getProductionIndexPath();

  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'Build Not Found',
      `Production build not found at:\n${indexPath}\n\nRun "npm run build" in the Frontend directory first.`
    );
    app.quit();
    return;
  }

  mainWindow.loadFile(indexPath).catch((err) => {
    dialog.showErrorBox('Load Error', `Failed to load application:\n${err.message}`);
  });
}

// ─── Icon resolution ──────────────────────────────────────────────────────────
function getIconPath() {
  const candidates = [
    path.join(__dirname, 'icons', 'icon.ico'),
    path.join(__dirname, 'icons', 'icon.png'),
    path.join(__dirname, '..', 'public', 'favicon.ico'),
    path.join(__dirname, '..', 'public', 'favicon.png'),
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // Use Electron default
}

// ─── Second instance ──────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ─── App ready ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Suppress GPU errors on Windows that pollute the log
  app.commandLine.appendSwitch('ignore-gpu-blacklist');
  app.commandLine.appendSwitch('disable-gpu-sandbox');

  // Register IPC handlers
  ipcMain.handle('app:get-version', () => app.getVersion());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── All windows closed ───────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  // On Windows quit when all windows are closed
  app.quit();
});

// ─── Uncaught errors ──────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught exception:', err);
});
