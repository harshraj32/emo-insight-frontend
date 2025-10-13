// public/electron.js - Corrected version with minimize support
const { app, BrowserWindow, systemPreferences, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow;

// Create captures directory
const capturesDir = path.join(app.getPath('userData'), 'captures');
if (!fs.existsSync(capturesDir)) {
  fs.mkdirSync(capturesDir, { recursive: true });
}

function createWindow() {
  const iconPath = isDev 
    ? path.join(__dirname, 'icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  console.log('Icon path:', iconPath);
  console.log('Icon exists:', fs.existsSync(iconPath));

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      enableRemoteModule: true
    },
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    minimizable: true,
    maximizable: false,
    closable: true,
    fullscreenable: false,
    show: false,
    center: true,
    skipTaskbar: false,
    backgroundColor: 'rgba(0,0,0,0)',
    hasShadow: false,
    thickFrame: false,
    roundedCorners: false
  });

  // Load the React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Show and focus the window after content loads
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    mainWindow.setAlwaysOnTop(true);
    
  });

  // Handle restore event - keep always on top
  mainWindow.on('restore', () => {
    console.log('Window restored');
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
  });

  // When minimized
  mainWindow.on('minimize', () => {
    console.log('Window minimized');
  });

  // Handle permission requests
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    if (permission === 'media' || permission === 'display-capture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Request screen recording permission on macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'icon.png');
    if (fs.existsSync(iconPath)) {
      const { nativeImage } = require('electron');
      let icon = nativeImage.createFromPath(iconPath);
      icon = icon.resize({ width: 128, height: 128 });
      app.dock.setIcon(icon);
      console.log('Dock icon set to:', iconPath);
    }
    try {
      const status = systemPreferences.getMediaAccessStatus('screen');
      console.log('Screen recording permission status:', status);
      
      if (status !== 'granted') {
        console.log('Requesting screen recording permission...');
        await systemPreferences.askForMediaAccess('screen');
      }
    } catch (error) {
      console.log('Error requesting screen permission:', error);
    }
  }

  createWindow();

  // Handle minimize from renderer
  ipcMain.on('minimize-app', () => {
    console.log('Minimize app requested');
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  // Handle close app message from renderer
  ipcMain.on('close-app', () => {
    console.log('Close app requested');
    app.quit();
  });

  // Handle desktop capturer requests
  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({ 
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 },
        fetchWindowIcons: true
      });
      return sources;
    } catch (error) {
      console.error('Error getting desktop sources:', error);
      return [];
    }
  });

  // Handle saving captured chunks
  ipcMain.handle('save-chunk', async (event, { data, filename }) => {
    try {
      const filePath = path.join(capturesDir, filename);
      const base64Data = data.replace(/^data:video\/webm;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved chunk: ${filename} (${buffer.length} bytes)`);
      return { success: true, path: filePath, size: buffer.length };
    } catch (error) {
      console.error('Error saving chunk:', error);
      return { success: false, error: error.message };
    }
  });

  // Get captures directory path
  ipcMain.handle('get-captures-dir', () => {
    return capturesDir;
  });

  // Check Flask backend health
  ipcMain.handle('check-backend-health', async () => {
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (response.ok) {
        const data = await response.json();
        return { status: 'healthy', data };
      } else {
        return { status: 'unhealthy', error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { status: 'unreachable', error: error.message };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:3000' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});

app.disableHardwareAcceleration();

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev && url.startsWith('http://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.on('before-quit', () => {
  console.log('App is about to quit');
});

app.on('will-quit', () => {
  console.log('App will quit');
});

console.log('Electron main process started');
console.log('App version:', app.getVersion());
console.log('Electron version:', process.versions.electron);
console.log('Chrome version:', process.versions.chrome);
console.log('Node version:', process.versions.node);