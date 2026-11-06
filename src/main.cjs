const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const engineDirectory = () => path.join(app.getPath('userData'), 'Malstrom', 'Engine', '0.1.0');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#111311',
    title: 'Malstrom Engine',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
}

async function loadProject(directory) {
  const projectDirectory = path.resolve(String(directory));
  const entries = await fs.readdir(projectDirectory, { withFileTypes: true });
  const gameFile = entries.find((entry) => entry.isFile() && entry.name.endsWith('.msg'));
  if (!gameFile) throw new Error('No Malstrom game file was found in that folder.');

  const gamePath = path.join(projectDirectory, gameFile.name);
  const game = JSON.parse(await fs.readFile(gamePath, 'utf8'));
  if (game.format !== 'malstrom-game' || !Array.isArray(game.scenes)) {
    throw new Error('This is not a supported Malstrom project.');
  }
  const scriptPath = path.join(projectDirectory, 'Scripts', 'main.msc');
  let script = '';
  try {
    script = await fs.readFile(scriptPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { path: projectDirectory, game, script };
}

app.whenReady().then(() => {
  ipcMain.handle('engine:status', async () => {
    try {
      await fs.access(path.join(engineDirectory(), 'engine.json'));
      return { installed: true, location: engineDirectory() };
    } catch {
      return { installed: false, location: engineDirectory() };
    }
  });

  ipcMain.handle('engine:install', async () => {
    const root = engineDirectory();
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'engine.json'), JSON.stringify({
      name: 'Malstrom 2D Runtime',
      version: '0.1.0',
      installedAt: new Date().toISOString(),
      formats: ['.msg', '.msm', '.msc']
    }, null, 2));
    await fs.writeFile(path.join(root, 'VScript-Quick-Start.md'), [
      '# VScript Quick Start',
      '',
      'VScript is the readable game scripting language used by Malstrom projects.',
      'Use on_start, on_collect "star", on_key "space", and on_win event blocks.',
      'Actions: say "text", set score to 0, add 1 to score, and win.',
      '',
      'The 2D preview runtime supports keyboard movement, jumping, platforms, and collectibles.'
    ].join(String.fromCharCode(10)));
    return { installed: true, location: root };
  });

  ipcMain.handle('project:create', async (_event, projectName) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a location for your project',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };

    const safeName = String(projectName || 'My First Game').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/^\.+$/, '').trim() || 'My First Game';
    const directory = path.join(result.filePaths[0], safeName);
    await fs.mkdir(directory);
    await fs.mkdir(path.join(directory, 'Assets'), { recursive: true });
    await fs.mkdir(path.join(directory, 'Scripts'), { recursive: true });
    await fs.writeFile(path.join(directory, `${safeName}.msg`), JSON.stringify({
      format: 'malstrom-game', version: 1, name: safeName,
      startScene: 'First Scene',
      scenes: [{ name: 'First Scene', width: 960, height: 540, background: '#18211e', objects: [
        { id: 'player', name: 'Player', type: 'player', x: 90, y: 420, width: 38, height: 42, color: '#d2f268' },
        { id: 'star-1', name: 'Star', type: 'star', x: 365, y: 438, width: 28, height: 28, color: '#f0ce72' },
        { id: 'ground', name: 'Ground', type: 'platform', x: 0, y: 492, width: 960, height: 48, color: '#35483a' },
        { id: 'ledge', name: 'Ledge', type: 'platform', x: 260, y: 395, width: 190, height: 18, color: '#526449' }
      ] }],
      scripts: ['Scripts/main.msc'], assets: []
    }, null, 2));
    await fs.writeFile(path.join(directory, 'Scripts', 'main.msc'), [
      '# Welcome to VScript',
      '# Use plain-language events to describe your game.',
      '',
      'on_start:',
      '    say "Find the star. Arrow keys move; Space jumps."',
      '    set score to 0',
      '',
      'on_collect "star":',
      '    add 1 to score',
      '    say "Star collected!"',
      '',
      'on_win:',
      '    say "You made it!"'
    ].join(String.fromCharCode(10)));
    return { canceled: false, path: directory, name: safeName };
  });

  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open a Malstrom game file',
      properties: ['openFile'],
      filters: [{ name: 'Malstrom Game', extensions: ['msg'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return loadProject(path.dirname(result.filePaths[0]));
  });

  ipcMain.handle('project:load', (_event, directory) => loadProject(directory));

  ipcMain.handle('project:save', async (_event, directory, game, script) => {
    const projectDirectory = path.resolve(String(directory));
    const entries = await fs.readdir(projectDirectory, { withFileTypes: true });
    const gameFile = entries.find((entry) => entry.isFile() && entry.name.endsWith('.msg'));
    if (!gameFile || game.format !== 'malstrom-game' || !Array.isArray(game.scenes)) {
      throw new Error('The project file is invalid.');
    }
    if (JSON.stringify(game).length > 2_000_000 || String(script).length > 200_000) {
      throw new Error('The project is too large to save.');
    }
    await fs.writeFile(path.join(projectDirectory, gameFile.name), JSON.stringify(game, null, 2));
    await fs.mkdir(path.join(projectDirectory, 'Scripts'), { recursive: true });
    await fs.writeFile(path.join(projectDirectory, 'Scripts', 'main.msc'), String(script));
    return { saved: true };
  });

  ipcMain.handle('asset:install', async (_event, asset) => {
    const root = path.join(app.getPath('userData'), 'Malstrom', 'Assets');
    await fs.mkdir(root, { recursive: true });
    const fileName = `${String(asset.id).replace(/[^a-z0-9-]/gi, '-')}.msm`;
    const destination = path.join(root, fileName);
    await fs.writeFile(destination, JSON.stringify({
      format: 'malstrom-asset', version: 1,
      id: asset.id, name: asset.name, category: asset.category,
      description: asset.description, license: 'CC0-1.0',
      source: 'Malstrom starter library'
    }, null, 2));
    return { path: destination };
  });

  ipcMain.handle('app:open-path', (_event, target) => shell.openPath(target));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});