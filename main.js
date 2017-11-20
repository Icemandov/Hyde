/*
 * HYDE - markdown editor
 * Copyright (c) 2017 Brett Stevenson <bstevensondev@gmail.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';
// handle setupevents as quickly as possible
const setupEvents = require('./assets/js/installer/setupEvents');
if(setupEvents.handleSquirrelEvent()) { return; }
const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const shell = electron.shell;
const BrowserWindow = electron.BrowserWindow;
const {Menu, MenuItem} = require('electron');
const config = require('./assets/js/config');
const tray = require('./tray');
const settings = require('electron-settings');
const fs = require('fs');
const path = require('path');
const window = require('electron-window');
const localShortcut = require('electron-localshortcut');
const windowStateManager = require('electron-window-state');
const packageJSON = require(__dirname + '/package.json');
const mainPage = path.join(__dirname, 'index.html');
const version = app.getVersion();
const args = require('yargs')
    .usage('Hyde v'+version+'\n\n Usage: hyde [options] <filename>\n\n If a filename isn\'t specified, the application will open with the most recently opened file. Additionally, if the specified file doesn\'t exist, a new file with the given filename will be created at the specified path.')
    .option('d', {
      alias: 'dev',
      describe: 'Open in development mode',
      type: 'boolean'
    })
    .alias('v', 'version')
    .version('v'+version)
    .option('gh', {
      alias: 'github',
      describe: 'Open a README from GitHub',
      type: 'string'
    })
    .help('h')
    .alias('h', 'help')
    .wrap(60)
    .argv;

// Keep a global reference of the window objects
var windows = new Set();
let isQuitting = false;
var hasChanges = false;
let windowState, mainWindow, pathToOpen;

// Allows render process to access active windows
const getWindows = exports.getWindows = () => window.windows;
const lshortcuts = exports.lshortcuts = () => localShortcut;

function getWindowConfig() {
  var conf = {
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: 400,
      minHeight: 300,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      fullscreenWindowTitle: true,
      darkTheme: true,
      transparent: false
  }
  if (process.platform === 'darwin') {
    conf.titleBarStyle = 'hidden';
    conf.icon = path.join(__dirname,'assets','img','icon','icns','icon.icns');
  } else if (process.platform === 'win32') {
    conf.icon = path.join(__dirname,'assets','img','icon','ico','icon.ico');
  } else {
    conf.icon = path.join(__dirname,'assets','img','icon','png','64x64.png');
  }
  return conf;
}

// Check for file from commandline
var readFile = null;
process.argv.forEach(function(val, index, array) {
  if (index >= 2 && val.includes('.md')) {
    readFile = val;
  }
});


const createWindow = exports.createWindow = (filePath) => {
  let argFile;
  let newWindow = window.createWindow(getWindowConfig());
  if(settings.has('targetFile')) {
    argFile = { file: settings.get('targetFile') };
    window.windows[newWindow.id].filePath = { 'filename': settings.get('targetFile') };
    settings.delete('targetFile');
  }
  newWindow.showUrl(mainPage, argFile);
  windowState.manage(newWindow)
  newWindow.on('did-finish-load', () => { mainWindow.show(); });
  newWindow.on('closed', () => { newWindow = null; });

  // Listen for issues
  newWindow.on('unresponsive', (err) => { console.error(err); });
  newWindow.webContents.on('crashed', (err) => { console.error(err); });
  // Open anchor links in browser
  function openExternal (e, url) {
    e.preventDefault();
    shell.openExternal(url);
  }
  newWindow.webContents.on('new-window', openExternal)
  newWindow.webContents.on('will-navigate', openExternal)
  return newWindow
}

ipc.on('export-to-pdf', (event, pdfPath) => {
  let win = BrowserWindow.fromWebContents(event.sender);
  win.webContents.printToPDF({ 'printBackground': true, 'pageSize': 'A4' }, (error, data) => {
    if (error) throw error;
    fs.writeFile(pdfPath, data, (error) => {
      if (error) throw error;
      shell.openExternal('file://' + pdfPath);
      event.sender.send('wrote-pdf', pdfPath);
    });
  });
});
ipc.on('export-to-html', (event, data, htmlPath) => {
	fs.writeFile(htmlPath, data, function(err) {
		if(err) notify('An error ocurred while creating \''+filename+'\' '+err.message, 'error');
	});
  event.sender.send('wrote-html', htmlPath);
});

const getThemes = exports.getThemes = () => {
  return require(path.join(__dirname, 'assets','json','themes.json'));
}

function menuThemes() {
  var themes = [];
      // themeFiles = fs.readdirSync(path.join(__dirname,'assets','css','themes'));
  getThemes().forEach((theme) => {
    var temp = { label:theme.name, click:() => { ipcSend('set-theme', theme.value); settings.set('editorTheme', theme.value.toString()); }};
    themes.push(temp);
  });
  return themes;
}

var template = [
  {label:'&File', submenu: [
		{label:'New', accelerator:'CmdOrCtrl+N', click:() => { createWindow(); }},
		{label:'Open...', accelerator:'CmdOrCtrl+O', click:() => { ipcSend('file-open'); }},
    {label:'Open in New Window', accelerator:'CmdOrCtrl+Shift+O', click:() => { ipcSend('file-open-new'); }},
		{type:'separator'},
		{label:'Save', accelerator:'CmdOrCtrl+S', click:() => { ipcSend('file-save'); }},
		{label:'Save As...', accelerator:'CmdOrCtrl+Shift+S', click:() => { ipcSend('file-save-as'); }},
		{label:'Export to PDF', click:() => { ipcSend('file-pdf'); }},
    {label:'Export to HTML', click:() => { ipcSend('file-html'); }},
		{type:'separator'},
		{label:'Show in File Manager', click:() => { ipcSend('open-file-manager'); }},
		{type:'separator'},
		{label:'Settings', accelerator:'CmdOrCtrl+,', click:() => { ipcSend('toggle-settings'); }},
		{type:'separator'},
		{label:'Quit', accelerator:'CmdOrCtrl+Q', click:() => { ipcSend('win-close'); }}
	]},
	{label:'&Edit', submenu: [
		{label:'Undo', accelerator:'CmdOrCtrl+Z', role: 'undo'},
		{label:'Redo', accelerator:'CmdOrCtrl+Shift+Z', role: 'redo'},
		{type:'separator'},
		{label:'Cut', accelerator:'CmdOrCtrl+X', role: 'cut'},
		{label:'Copy', accelerator:'CmdOrCtrl+C', role: 'copy'},
		{label:'Paste', accelerator:'CmdOrCtrl+V', role: 'paste'},
		{label:'Select All', accelerator:'CmdOrCtrl+A', click:() => { ipcSend('select-all'); }},
		{type:'separator'},
		{label:'Find', accelerator:'CmdOrCtrl+F', click:() => { ipcSend('search-find'); }},
		{label:'Replace', accelerator:'CmdOrCtrl+Shift+F', click:() => { ipcSend('search-replace'); }},
		{type:'separator'},
		{label:'Auto-Indent', accelerator:'CmdOrCtrl+Shift+A', click:() => { ipcSend('auto-indent'); }},
		{label:'Indent Less', accelerator:'CmdOrCtrl+Left', click:() => { ipcSend('indent-less'); }},
		{label:'Indent More', accelerator:'CmdOrCtrl+Right', click:() => { ipcSend('indent-more'); }},
		{type:'separator'},
	]},
	{label:'&View', submenu: [
		{label:'Reload', accelerator:'CmdOrCtrl+R', click:() => { ipcSend('win-reload'); }},
		{type:'separator'},
		{label:'Toggle Menu', accelerator:'CmdOrCtrl+M', click:() => { ipcSend('toggle-menu'); }},
		{label:'Toggle Toolbar', accelerator:'CmdOrCtrl+.', click:() => { ipcSend('toggle-toolbar'); }},
		{label:'Toggle Preview', accelerator:'CmdOrCtrl+P', click:() => { ipcSend('toggle-preview'); }},
		{label:'Toggle Full Screen', accelerator:'F11', click:() => { ipcSend('mazimize'); }},
		{type:'separator'},
		{label:'Themes' },
		{type:'separator'},
		{label:'Preview Mode', submenu: [
			{label:'Markdown', click:() => { ipcSend('markdown-preview'); }},
			{label:'HTML', click:() => { ipcSend('html-preview'); }}
		]},
		{type:'separator'},
		{role: 'toggledevtools'}
	]},
  {label:'&Format', submenu: [
    {label:'Header', accelerator:'CmdOrCtrl+H', click:() => { ipcSend('insert-heading'); }},
    {label:'Bold', accelerator:'CmdOrCtrl+B', click:() => { ipcSend('insert-bold'); }},
    {label:'Italics', accelerator:'CmdOrCtrl+I', click:() => { ipcSend('insert-italic'); }},
    {label:'Strikethrough', accelerator:'CmdOrCtrl+-', click:() => { ipcSend('insert-strikethrough'); }},
    {type:'separator'},
    {label:'Insert Link', accelerator:'CmdOrCtrl+L', click:() => { ipcSend('insert-link'); }},
    {label:'Insert Image', accelerator:'CmdOrCtrl+K', click:() => { ipcSend('insert-image'); }},
    {label:'Insert Table', accelerator:'CmdOrCtrl+T', click:() => { ipcSend('insert-table') }},
    {label:'Insert Horizontal Rule', accelerator:'CmdOrCtrl+_', click:() => { ipcSend('insert-hr'); }},
    {label:'Insert Emoji...', accelerator:'CmdOrCtrl+E', click:() => { ipcSend('insert-emoji'); }},
    {type:'separator'},
    {label:'Toggle Code', accelerator:'CmdOrCtrl+;', click:() => { ipcSend('insert-code'); }},
    {label:'Toggle Comment', accelerator:'CmdOrCtrl+/', click:() => { ipcSend('insert-comment'); }},
    {label:'Toggle Blockquote', accelerator:'CmdOrCtrl+\'', click:() => { ipcSend('insert-quote'); }},
    {label:'Toggle Unordered List', click:() => { toggleUnorderedList(); }},
    {label:'Toggle Ordered List', click:() => { toggleOrderedList(); }},
    {type:'separator'},
    {label:'Insert YAML-frontmatter', accelerator:'CmdOrCtrl+Shift+Y', click:() => { ipcSend('insert-yaml'); }}
  ]},
	{role:'window', label:'&Window', submenu: [
		{label:'Minimize', click:() => {
			BrowserWindow.getFocusedWindow().minimize();
		}},
		{label:'Zoom', click:() => {
			toggleMaximize();
		}},
		{type:'separator'},
		{label:'Bring to Front', click:() => {
			windows[0].show();
		}}
	]},
	{label:'&Help', role: 'help', submenu: [
		{label:'Markdown Help', click:() => {
			ipcSend('markdown-modal');
		}},
		{type:'separator'},
		{label:'Documentation', click:() => {
			shell.openExternal(packageJSON.docs);
		}},
		{label:'Keybindings', click:() => {
			shell.openExternal(packageJSON.keybindings);
		}},
		{label:'Report Issue', click:() => {
			shell.openExternal(packageJSON.repository.bugs);
		}},
		{type:'separator'},
		{label:'About Hyde', click:() => {
			ipcSend('about-modal');
		}}
	]}
];
if (process.platform === 'darwin') {
  const name = app.getName();
  template.unshift({
    label:name,
    submenu: [
      {label:'About Hyde', click:() => {
        ipcSend('about-modal');
      }},
      {type:'separator'},
      {role: 'preferences', label:'Preferences', accelerator:'CmdOrCtrl+,', click:() => { ipcSend('toggle-settings'); }},
      {type:'separator'},
      {role: 'services', submenu: []},
      {type:'separator'},
      {role: 'hide'},
      {role: 'hideothers'},
      {role: 'unhide'},
      {type:'separator'},
      {role: 'quit'}
    ]
  })
  template[1].submenu[9] = {label:"Show in Finder", click:() => { ipcSend('open-file-manager'); }};
  template[1].submenu.splice(11,1);
  template[1].submenu[12] = {label:'Close', accelerator:'CmdOrCtrl+Q', click:() => { ipcSend('win-close'); }};
  template[3].submenu.splice(2,1);
  // Add syntax-themes to menu
  template[3].submenu[6].submenu = menuThemes();
  // Window menu
  template[5].submenu = [
    {role: 'minimize'},
    {role: 'zoom'},
    {type:'separator'},
    {role: 'front'}
  ]
} else {
  template[0].submenu[7] = {label:"Show in Explorer", click:() => { ipcSend('open-file-manager'); }};
  template[2].submenu[7].submenu = menuThemes();
}

function ipcSend(cmd) {
  var focusedWindow = BrowserWindow.getFocusedWindow();
  focusedWindow.webContents.send(cmd);
}

// Register local keyboard shortcuts
localShortcut.register('CmdOrCtrl+Shift+a', () => { ipcSend('auto-indent'); });
localShortcut.register('CmdOrCtrl+b', () => { ipcSend('insert-bold'); });
localShortcut.register('CmdOrCtrl+d', () => { ipcSend('select-word'); });
localShortcut.register('CmdOrCtrl+e', () => { ipcSend('insert-emoji'); });
localShortcut.register('CmdOrCtrl+f', () => { ipcSend('search-find'); });
localShortcut.register('CmdOrCtrl+Shift+f', () => { ipcSend('search-replace'); });
localShortcut.register('CmdOrCtrl+h', () => { ipcSend('insert-heading'); });
localShortcut.register('CmdOrCtrl+i', () => { ipcSend('insert-italic'); });
localShortcut.register('CmdOrCtrl+k', () => { ipcSend('insert-image'); });
localShortcut.register('CmdOrCtrl+l', () => { ipcSend('insert-link'); });
localShortcut.register('CmdOrCtrl+m', () => { ipcSend('toggle-menu'); });
localShortcut.register('CmdOrCtrl+n', () => { ipcSend('file-new'); });
localShortcut.register('CmdOrCtrl+o', () => { ipcSend('file-open'); });
localShortcut.register('CmdOrCtrl+Shift+o', () => { ipcSend('file-open-new'); });
localShortcut.register('CmdOrCtrl+p', () => { ipcSend('toggle-preview'); });
localShortcut.register('CmdOrCtrl+Shift+p', () => { ipcSend('toggle-palette'); });
localShortcut.register('CmdOrCtrl+r', () => { ipcSend('win-reload'); });
localShortcut.register('CmdOrCtrl+s', () => { ipcSend('file-save'); });
localShortcut.register('CmdOrCtrl+Shift+s', () => { ipcSend('file-save-as'); });
localShortcut.register('CmdOrCtrl+t', () => { ipcSend('table-modal'); });
localShortcut.register('CmdOrCtrl+up', () => { ipcSend('page-up'); });
localShortcut.register('CmdOrCtrl+down', () => { ipcSend('page-down'); });
localShortcut.register('CmdOrCtrl+left', () => { ipcSend('indent-less'); });
localShortcut.register('CmdOrCtrl+right', () => { ipcSend('indent-more'); });
localShortcut.register('CmdOrCtrl+-', () => { ipcSend('insert-strikethrough'); });
localShortcut.register('CmdOrCtrl+Shift+-', () => { ipcSend('insert-hr'); });
localShortcut.register('CmdOrCtrl+/', () => { ipcSend('insert-comment'); });
localShortcut.register('CmdOrCtrl+;', () => { ipcSend('insert-code'); });
localShortcut.register("CmdOrCtrl+'", () => { ipcSend("insert-quote"); });
localShortcut.register('CmdOrCtrl+.', () => { ipcSend('toggle-toolbar'); });
localShortcut.register('CmdOrCtrl+,', () => { ipcSend('toggle-settings'); });
localShortcut.register('CmdOrCtrl+Shift+/', () => { ipcSend('markdown-modal'); });

// Called after initialization
app.on('ready', function() {
  // Create native application menu for OSX
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  // Initialize windowStateManager
  windowState = windowStateManager({
    defaultWidth: config.get('windowWidth'),
    defaultHeight: config.get('windowHeight')
  });
  settings.set('targetFile', readFile);
  // Create main window
  mainWindow = createWindow();
  tray.create(mainWindow);
  // Show DevTools
  if(args.dev) {
    require('devtron').install();
    mainWindow.webContents.openDevTools();
  }
  
  
  // FIXME: Window is still being removed from window.windows array
  mainWindow.on('close', (e) => {
    if(process.platform === 'darwin') {
      if(hasChanges) {
        var prompt = require('electron').dialog.showMessageBox({
            type:'question',
            buttons: ['Yes', 'No', 'Cancel'],
            title: 'Confirm',
            message: 'Unsaved Changes',
            detail: 'The current file contains unsaved changes, would you like to save them?'
         });
        if(prompt == 1) {  // NO
          e.preventDefault();
          hasChanges = false;
          mainWindow.close();
        } else if(prompt == 2) { // CANCEL
          e.preventDefault();
        } else {  // YES
          e.preventDefault();
          windows
          ipcSend('file-save');
        }
      }
    }
  });
});

ipc.on('changed-state', (state) => {
  hasChanges = state;
});

// Listen for uncaughtExceptions
process.on('uncaughtException', (err) => {
  console.error(err)
});

app.on('open-file', (e, path) => {
  e.preventDefault()
  if (isReady) {
    createWindow(path)
  } else {
    pathToOpen = path
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OSX it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd+Q
  if(process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', (e) => {
  if(settings.get('keepInTray') && !isQuitting) {
    e.preventDefault();
    if(process.platform === 'darwin')
      app.hide();
    else
      Object.values(window.windows).hide();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  windowState.saveState(mainWindow)
  isQuitting = true;
});

const appVersion = exports.appVersion = () => {
  return app.getVersion();
}

app.on('browser-window-created', function(event, win) {
  win.webContents.on('context-menu', function(e, params) {
    rightClickPos = { x: params.x, y: params.y };
    contextMenu.popup(win, params.x, params.y);
  });
});

ipc.on('show-context-menu', function(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  contextMenu.popup(win);
});

let rightClickPos = null;
const contextMenu = new Menu();
contextMenu.append(new MenuItem({ role: 'undo' }))
contextMenu.append(new MenuItem({ role: 'redo' }))
contextMenu.append(new MenuItem({ type:'separator' }))
contextMenu.append(new MenuItem({ label:"Cut", role: "cut" }))
contextMenu.append(new MenuItem({ label:"Copy", role: "copy" }))
contextMenu.append(new MenuItem({ label:"Paste", role: "paste" }))
contextMenu.append(new MenuItem({ label:"Select All", click:() => { ipcSend('ctrl+a'); } }))
contextMenu.append(new MenuItem({ type:'separator' }))
contextMenu.append(new MenuItem({ label:'Show in File Manager', click:() => { ipcSend('open-file-manager'); } }))
contextMenu.append(new MenuItem({ type:'separator' }))
contextMenu.append(new MenuItem({ label:'Inspect Element', click:() => { mainWindow.inspectElement(rightClickPos.x, rightClickPos.y); }}))
