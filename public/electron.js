// public/electron.js - Updated Electron main process for Emo Insight
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
    ? path.join(__dirname, 'icon.png')  // Development: public/icon.png
    : path.join(process.resourcesPath, 'icon.png'); // Production: resources/icon.png

  console.log('Icon path:', iconPath); // Debug log
  console.log('Icon exists:', fs.existsSync(iconPath)); // Check if file exists

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
    frame: false,           // No window frame
    titleBarStyle: 'hidden', // Hide title bar completely  
    alwaysOnTop: true,      
    transparent: true,      // Transparent window
    resizable: false,       
    minimizable: false,     
    maximizable: false,     
    closable: true,         
    fullscreenable: false,
    show: false,
    center: true,
    skipTaskbar: false,     
    backgroundColor: 'rgba(0,0,0,0)', // Fully transparent
    hasShadow: false,       // No window shadow
    thickFrame: false,      // Remove thick frame on Windows
    roundedCorners: false   // No rounded corners
  });

  // Load the React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Show and focus the window after content loads
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    
    // Force it to the front
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    mainWindow.setAlwaysOnTop(true);
    setTimeout(() => mainWindow.setAlwaysOnTop(false), 1000);
  });

  // Handle permission requests
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    // Allow screen capture permissions
    if (permission === 'media' || permission === 'display-capture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
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
      // Load the image and resize it
      const nativeImage = require('electron').nativeImage;
      let icon = nativeImage.createFromPath(iconPath);
      
      // Resize to standard dock size (128x128 is good for dock display)
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

  // Handle close app message from renderer
  ipcMain.on('close-app', () => {
    console.log('Close app requested');
    app.quit();
  });

  // Handle desktop capturer requests (keeping for potential future use)
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

  // Handle saving captured chunks (keeping for potential future use)
  ipcMain.handle('save-chunk', async (event, { data, filename }) => {
    try {
      const filePath = path.join(capturesDir, filename);
      
      // Convert base64 to buffer
      const base64Data = data.replace(/^data:video\/webm;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Save file
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

// Disable hardware acceleration for better compatibility (must be before app ready)
app.disableHardwareAcceleration();

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In development, ignore certificate errors for localhost
  if (isDev && url.startsWith('http://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Log app events for debugging
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