const ipc = electron.ipcRenderer;
let target = '';

// Handling file saving through IPCRenderer
function saveAs() {
	storage.get('markdown-savefile', function(err, data) {
		options = {'filters': [{ name:'Markdown', 'extensions':['md']}]};
		if(err) notify(err, 'error');
		if('filename' in data) {
			options.defaultPath = data.filename;
		}
		dialog.showSaveDialog(options, function(filename) {
			if(filename === undefined)
				return notify('You didn\'t save the file', 'warning');
			storage.set('markdown-savefile', {'filename' : filename}, (err) => {
				if(err) notify(err, 'error');
			});
			// filename is a string that contains the path and filename created in the save dialog.
			var mdValue = cm.getValue();
			fs.writeFile(filename, mdValue, (err) => {
				if(err) notify('An error ocurred while creating the file '+ err.message, 'error');
			});
			this.setClean();
			this.currentFile = filename;
			this.updateWindowTitle(filename);
		});
	});
}

ipc.on('file-new', function() {
	storage.set('markdown-savefile', {}, (err) => {
		if(err) notify(err, 'error');
	});
	currentFile = '';
	cm.getDoc().setValue('');
});

// Handling file saving through IPCRenderer
ipc.on('file-save', () => {
	storage.get('markdown-savefile', (err, data) => {
		if(err) {
			saveAs();
			return;
		}
		if('filename' in data) {
			var filename = data.filename;
			if(filename === undefined)
				return notify('You didn\'t save the file', 'warning');
			storage.set('markdown-savefile', {'filename' : filename}, (err) => {
				if(err) notify(err, 'error');
			});
			// filename is a string that contains the path and filename created in the save file dialog.
			var mdValue = cm.getValue();
			fs.writeFile(filename, mdValue, (err) => {
				if(err) { notify('An error ocurred creating the file '+ err.message, 'error'); }
			});
			this.setClean();
			this.currentFile = filename;
			remote.BrowserWindow.getFocusedWindow().updateWindowTitle(filename);
		} else {
			saveAs();
		}
	});
});

ipc.on('file-save-as', saveAs);

// FIXME: Issues with savefile w/ multiple files open
// Handling file opening through IPCRenderer
ipc.on('file-open', () => {
	storage.get('markdown-savefile', (err, data) => {
		if(err) notify(err, 'error');
		var options = {
			'properties': ['openFile'],
			'filters': [{
				name: 'Markdown',
				'extensions': ['md','markdown','mdown','mkdn','mkd','mdwn','mdtxt','mdtext']
			}]
		};
		if('filename' in data)
			options.defaultPath = data.filename;
		dialog.showOpenDialog(options, (file) => {
			if(file === undefined) {
				return notify('You didn\'t select a file to open', 'info');
			}
			storage.set('markdown-savefile', {
				'filename' : file[0] }, (err) => {
					if(err) notify(err, 'error');
				});

			this.isFileLoadedInitially = true;
			// this.currentFile = file[0]; <-- This fixes bottom file but not save
			// file is a string that contains the path and filename created in the save file dialog.
      if(!this.isClean()) {
        settings.set('targetFile', file[0]);
        main.createWindow();
      } else {
  			fs.readFile(file[0], 'utf-8', (err, data) => {
  				if(err) { notify('An error ocurred while opening the file '+ err.message, 'error'); }
  				cm.getDoc().setValue(data);
  			});
      }
			// app.addRecentDocument(file);
		});
	});
});

ipc.on('select-all', () => { cm.execCommand('selectAll'); });
ipc.on('auto-indent', () => { cm.execCommand('indentAuto'); });
ipc.on('insert-bold', () => { toggleFormat('strong'); });
ipc.on('select-word', () => { selectWord(); });
ipc.on('search-find', () => { toggleSearch('find'); });
ipc.on('search-replace', () => { toggleSearch('replace'); });
ipc.on('insert-heading', () => { toggleHeading(); });
ipc.on('insert-italic', () => { toggleFormat('em'); });
ipc.on('insert-image', () => { insert('image'); });
ipc.on('insert-link', () => { insert('link'); });
ipc.on('toggle-menu', () => { if(process.platform !== 'darwin') toggleMenu(); });
ipc.on('toggle-preview', () => { togglePreview(); });
ipc.on('win-close', () => { closeWindow(remote.BrowserWindow.getFocusedWindow()); });
ipc.on('win-reload', () => { reloadWin(); });
ipc.on('insert-code', () => { toggleFormat('code'); });
ipc.on('insert-quote', () => { toggleBlockquote(); });
ipc.on('toggle-toolbar', () => { toggleToolbar(); });
ipc.on('toggle-settings', () => { toggleSettingsMenu(); });
ipc.on('insert-strikethrough', () => { toggleFormat('strikethrough'); });
ipc.on('insert-hr', () => { insert('hr'); });
ipc.on('insert-comment', () => { toggleComment(); });
ipc.on('page-up', () => { cm.execCommand('goDocStart'); });
ipc.on('page-down', () => { cm.execCommand('goDocEnd'); });
ipc.on('indent-less', () => { cm.execCommand('indentLess'); });
ipc.on('indent-more', () => { cm.execCommand('indentMore'); });
ipc.on('toggle-palette', () => { commandPalette().show(); });
ipc.on('maximize', () => { toggleMaximize(); });
// Save as PDF file
ipc.on('file-pdf', () => {
	options = { filters: [{ name:'PDF', extensions:['pdf']}]};
	dialog.showSaveDialog(options, (filePath) => {
		ipc.send('export-to-pdf', filePath);
	});
});
// Save as HTML file
ipc.on('file-html', () => {
	options = { filters: [{ name:'html', extensions: ['html']}]};
	dialog.showSaveDialog(options, (filePath) => {
		ipc.send('export-to-html', getHTML(), filePath);
	});
});
ipc.on('insert-yaml', () => { insertFrontMatter(); });
ipc.on('markdown-preview', () => { setPreviewMode('markdown'); });
ipc.on('html-preview', () => { setPreviewMode('html'); });
ipc.on('about-modal', () => { $('#about-modal').modal(); });
ipc.on('markdown-modal', () => { $('#markdown-modal').modal(); });
ipc.on('table-modal', () => { $('#table-modal').modal(); });
ipc.on('insert-emoji', () => { $('#emoji-modal').modal(); });
ipc.on('keybinding-modal', () => { settings.set('targetFile', path.join(__dirname, '/docs/keybindings.md')); main.createWindow(); });
ipc.on('open-file-manager', () => { shell.showItemInFolder(currentFile); });
ipc.on('target-file', () => { return target; });
ipc.on('set-theme', function(data) { setEditorTheme(data); });
