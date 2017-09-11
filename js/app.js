
const electron = require('electron');
const {app} = require('electron');
const remote = electron.remote;
const ipc = electron.ipcRenderer;
const dialog = electron.remote.dialog;
const shell = electron.shell;
const fs = remote.require('fs');
const main = remote.require('./main');
const path = require('path');
const config = require('./config');
const showdown  = require('showdown');
const func = require('./js/functions');
const setter = require('./js/settings');
const notify = require('./js/notify')
const parsePath = require("parse-filepath");
const settings = require('electron-settings');
const storage = require('electron-json-storage');
const spellChecker = require('codemirror-spell-checker');
var Color = require('color');
var isBinaryFile = require("isbinaryfile");
var os = require("os");
require('showdown-youtube');
require('showdown-prettify');
require('showdown-highlightjs-extension');

const currentWindow = remote.getCurrentWindow();
var isFileLoadedInitially = false,
    currentTheme = settings.get('editorTheme'),
    currentFile = '';

getUserSettings();

var conf = {
  mode: "yaml-frontmatter",
  base: "gfm",
  viewportMargin: 100000000000,
  tabSize: 2,
  lineWrapping: true,
  lineNumbers: settings.get('lineNumbers'),
  showTrailingSpace: settings.get('showTrailingSpace'),
  autoCloseBrackets: settings.get('matchBrackets'),
  autoCloseTags: settings.get('matchBrackets'),
  extraKeys: {
    Enter: 'newlineAndIndentContinueMarkdownList'
  }
}

var theme = settings.get('editorTheme');
if(main.getThemes().filter((temp) => { return temp.value === theme })) {
  conf.theme = theme;
} else {
  conf.theme = "one-dark";
}
includeTheme(theme);
var tool = "hello";

if(settings.get('enableSpellCheck')) {
  conf.mode = "spell-checker";
  conf.backdrop = "yaml-frontmatter";
  spellChecker({ codeMirrorInstance: CodeMirror });
}

var cm = CodeMirror.fromTextArea(document.getElementById('plainText'), conf);

if(os.type() === 'Darwin') {
  $('#settings-title').css('paddingTop', '0.9em');
  $('#settings-title > img').css('marginTop', '-13px');
  $('#settings-title > h2').css('font-size', '3.175em');
  $('#settings-section h3').css('letter-spacing', '0.045em');
  $('#settings-section ul li').css('letter-spacing', '0.075em');
}

var themes = [],
    head = $('head');
main.getThemes().filter((temp) => {
  themes.push(temp.value)
});
themes.forEach(function(index) {
  temp = document.createElement('link');
  temp.setAttribute('rel', 'stylesheet');
  temp.setAttribute('href', 'css/theme/'+index+'.css');
  head.append(temp);
});

function includeTheme(theme) {
  var themeTag;
  if(theme === undefined)
    theme = 'one-dark';
  themeTag = $('link[href="css/theme/'+theme.toString()+'.css"]');
  themeTag.attr('id', 'themeLink');
  var title = theme.replace(/-/g , " ").replace(/\w\S*/g, function(str) {
    return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
  });
  $('#editorTheme').attr('title', title);
  settings.set('editorTheme', theme);
  if(currentTheme !== theme) {
    currentTheme = theme;
    cm.setOption("theme", theme);
  }
  var themeColor = $('.cm-s-'+theme).css('background-color');
  adaptTheme(themeColor, Color(themeColor).luminosity());
}

window.onload = () => {
  var markdownPreview = document.getElementById('markdown'),
      htmlPreview = $('#htmlPreview');

  var converter = new showdown.Converter({
      ghCompatibleHeaderId: true,
      ghCodeBlocks: true,
      simplifiedAutoLink: true,
      excludeTrailingPunctuationFromURLs: true,
      tables: true,
      tasklists: true,
      strikethrough: true,
      simpleLineBreaks: true,
      parseImgDimensions: true,
      smoothLivePreview: true,
      extensions: ['youtube', 'prettify', 'highlightjs']
  });

  var themeColor = $('.cm-s-'+theme).css('background-color');
  adaptTheme(themeColor, Color(themeColor).luminosity());
  createEmojiModal();

  cm.on('change', (cm) => {
    countWords();
    var markdownText = cm.getValue();
    // Remove the YAML frontmatter from live-preview
    if(settings.get('hideYAMLFrontMatter'))
      markdownText = removeYAMLPreview(markdownText);
    // Convert emoji's
    markdownText = replaceWithEmojis(markdownText);
    // Markdown -> Preview
    renderedMD = converter.makeHtml(markdownText);
    markdownPreview.innerHTML = renderedMD;
    // Markdown -> HTML
    converter.setOption('noHeaderId', true);
    html = converter.makeHtml(markdownText);
    htmlPreview.val(html);
    if(this.isFileLoadedInitially) {
      this.setClean();
      this.isFileLoadedInitially = false;
    }
    if(this.currentFile !== '') {
      this.updateWindowTitle(this.currentFile);
    } else {
      this.updateWindowTitle();
    }
  });
  // Read file if given from commandline
  if(__args__.file !== null) {
    if(__args__.file.includes('.md')) {
      readFileIntoEditor(path.join(process.cwd(), __args__.file));
    }
  // Open first window with the most recently saved file
} else if(main.getWindows().size <= 1) {
    storage.get('markdown-savefile', function(err, data) {
      if(err) throw err;
      if('filename' in data) {
        fs.readFile(data.filename, 'utf-8', function(err, data) {
          if(err) notify("An error ocurred while opening the file" + err.message, "error");
          cm.getDoc().setValue(data);
          cm.getDoc().clearHistory();
        });
        this.isFileLoadedInitially = true;
        this.currentFile = data.filename;
      }
    });
  }

  $("#minimize").on('click', () => { remote.BrowserWindow.getFocusedWindow().minimize(); });
  $("#close").on('click', () => { closeWindow(remote.BrowserWindow.getFocusedWindow()); });
  $('#sidebar-new').on('click', () => { main.createWindow(); });
  $("#unsavedConfirm").on('click', () => { saveFile(); });
  $("#unsavedDeny").on('click', () => { remote.BrowserWindow.getFocusedWindow().close(); });
  // Handle link clicks in application
  $(".link").on('click', () => {
    event.preventDefault();
    shell.openExternal($(this).attr('href'))
  });
  // Open dropdown sub-menus on hover
  $('.dropdown-submenu').mouseover(function() {
    $(this).children('ul').show();
  }).mouseout(function() {
    $(this).children('ul').hide();
  });
  $('#yamlPath').on('click', () => { setFrontMatterTemplate() });
  $('#table-button').on('click', () => {
    $('#table-modal').modal();
    createTable($('#columns').val(),$('#rows').val(),$('.on').attr('id').slice(0,-5));
  });
}


/**************************
  * Synchronized scrolling *
  **************************/

var $prev = $('#previewPanel'),
    $markdown = $('#markdown'),
    $syncScroll = $('#syncScrollToggle'),
    isSynced = settings.get('syncScroll');

 // Retaining state in boolean will be more CPU friendly rather than selecting on each event.
var toggleSyncScroll = () => {
  if(settings.get('syncScroll')) {
    $syncScroll.attr('class', 'fa fa-unlink');
    isSynced = false;
    $(window).trigger('resize');
  } else {
    $syncScroll.attr('class', 'fa fa-link');
    isSynced = true;
    $(window).trigger('resize');
  }
   settings.set('syncScroll', isSynced);
}
$syncScroll.on('change', toggleSyncScroll());

// Scrollable height.
var codeScrollable = () => {
  var info = cm.getScrollInfo();
  return info.height - info.clientHeight;
}
var prevScrollable = () => {
  return $markdown.height() - $prev.height();
}

// Temporarily swaps out a scroll handler.
var muteScroll = (obj, listener) => {
  obj.off('scroll', listener);
  obj.on('scroll', tempHandler);
  var tempHandler = () => {
    obj.off('scroll', tempHandler);
    obj.on('scroll', listener);
  }
}

// Scroll Event Listeners
var codeScroll = () => {
  var scrollable = codeScrollable();
  if (scrollable > 0 && isSynced) {
    var percent = cm.getScrollInfo().top / scrollable;
    muteScroll($prev, prevScroll);
    $prev.scrollTop(percent * prevScrollable());
  }
}
cm.on('scroll', codeScroll);
$(window).on('resize', codeScroll);
$(window).on('resize', manageWindowSize());

var prevScroll = () => {
  var scrollable = prevScrollable();
  if (scrollable > 0 && isSynced) {
    var percent = $(this).scrollTop() / scrollable;
    muteScroll(cm, codeScroll);
    cm.scrollTo(percent * codeScrollable());
  }
}
$prev.on('scroll', prevScroll);


function openNewFile(target) {
  var filePath = path.join(__dirname, target);
  main.createWindow();
  readFileIntoEditor(filePath)
  app.addRecentDocument(filePath)
}

function setFile(file, isWritable) {
  fileEntry = file;
  hasWriteAccess = isWritable;
}

function readFileIntoEditor(file) {
  if(file === "") return;
  fs.readFile(file, function (err, data) {
    if(err) notify("Read failed: " + err, "error");
    cm.getDoc().setValue(String(data));
    cm.getDoc().clearHistory()
  });
  this.isFileLoadedInitially = true;
  this.currentFile = file;
}

function writeEditorToFile(file) {
  var str = this.cm.getValue();
  fs.writeFile(file, this.cm.getValue(), function (err) {
    if(err) return notify("Write failed: " + err, "error");
    notify("Write completed.", "success");
  });
}

// Resize toolbar when window is below necessary width
$(window).on('resize', () => {
  if(parseInt($('#body').width(),10) > 924 && $('#previewPanel').is(':visible')) {
    toolbar.css('width', '50%');
  } else {
    toolbar.css('width', '100%');
  }
});

$('#version-modal').text('v'+main.appVersion());

$('.spinner .btn:first-of-type').on('click', function() {
  var btn = $(this),
      input = btn.closest('.spinner').find('input'),
      value = parseFloat(input.val());
  if (input.attr('max') === undefined || value < parseFloat(input.attr('max'))) {
    input.val(value + 0.5);
  } else {
    btn.next("disabled", true);
  }
  settings.set(btn.attr('id').split('-')[0], input.val());
});

$('.spinner .btn:last-of-type').on('click', function() {
  var btn = $(this),
      input = btn.closest('.spinner').find('input'),
      value = parseFloat(input.val());
  if (input.attr('min') === undefined || value > parseFloat(input.attr('min'))) {
    input.val(value - 0.5);
  } else {
    btn.prev("disabled", true);
  }
  settings.set(btn.attr('id').split('-')[0], input.val());
});

var te;
$('#leftAlign, #centerAlign, #rightAlign').on('click', function() {
  $('.on').removeClass('on');
  $(this).addClass('on');
  te = $(this).attr('id').slice(0, -5);
});

// Word count
function countWords() {
  var wordcount = cm.getValue().split(/\b[\s,\.-:;]*/).length;
  document.getElementById("wordcount").innerHTML = "words: " + wordcount.toString();
  return cm.getValue().split(/\b[\s,\.-:;]*/).length;
}

// Allows render process to create new windows
function openNewWindow() {
  main.createWindow();
}

function openInBrowser(url) {
  shell.openExternal(url);
}
