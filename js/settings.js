
var menu = $('#appMenu'),
    toolbar = $('#toolbar'),
    leftFade = $('#leftFade'),
    rightFade = $('#rightFade'),
    preview = $('#previewPanel'),
    editor = $('.CodeMirror-wrap'),
    syncScroll = $('#syncScrollToggle');

var opt = [
  { name: 'showMenu', action: () => { toggleMenu(); }},
  { name: 'showToolbar', action: () => { toggleToolbar(); }},
  { name: 'showPreview', action: () => { togglePreview(); }},
  { name: 'previewProfile' },
  { name: 'syncScroll', action: () => { toggleSyncScroll; }},
  { name: 'isFullscreen', action: () => { toggleFullscreen(); }},
  { name: 'lineNumbers', action: () => { toggleLineNumbers(); }},
  { name: 'showTrailingSpace', action: () => { toggleWhitespace() }},
  { name: 'lineWrapping' }, { name: 'editorFontSize' }, { name: 'tabSize' }, { name: 'enableSpellCheck' }, { name: 'previewMode' }, { name: 'previewFontSize' }, { name: 'previewLineHeight' }, { name: 'hideYAMLFrontMatter' }, { name: 'matchBrackets' }, { name: 'keepInTray' }, { name: 'frontMatterTemplate' }
];

function getUserSettings() {
    opt.forEach(checkSetting);
    setPreviewMode(settings.get('previewMode'));
    setPreviewProfile(settings.get('previewProfile'));
    opt.forEach(applySettings);
    formatHead();
    syncScrollCheck();
    if(process.platform === 'darwin') {
      $('.btn-group').remove();
      $('#menuToggle').remove();
      $('#metacity').hide();
    }
}

// If there are no settings for option, sets default
function checkSetting(opt) {
  if(!settings.has(opt.name))
    settings.set(opt.name, config.get(opt.name));
}

function applySettings(opt) {
  var selector = $('#'+opt.name.toString()),
      input = selector.find('input'),
      type = input.attr('type');
  if(settings.get(opt.name) && opt.action)
    opt.action();
  if(type === 'checkbox') {
    if(selector.length && input.length) {
      if(input.is(':checked') !== settings.get(opt.name))
        input.prop("checked", !input.prop("checked"));
    }
  } else if(type === 'text') {
    input.val(settings.get(opt.name));
  }
  $('#editorFontSize-input').val(settings.get('editorFontSize'));
  $('#previewFontSize-input').val(settings.get('previewFontSize'));
}

function syncScrollCheck() {
  if(settings.get('syncScroll'))
    syncScroll.attr('class', 'fa fa-link');
  else
    syncScroll.attr('class', 'fa fa-unlink');
  toggleSyncScroll;
}

var formatHead = () => {
  var dragArea = $('#draggable'),
      textPanel = $('#textPanel'),
      menuToggle = $('#menuToggle');
  if(process.platfrom === 'darwin')
    if(menu.is(':visible') !== toolbar.is(':visible'))
      toggleMenu();
  if(menu.is(':visible')) {
    toolbar.css({ top: '26px' });
    dragArea.css('width', '-webkit-calc(100% - 255px)');
    menuToggle.hide();
    if(toolbar.is(':visible')) {
      menu.css('box-shadow', 'none');
      leftFade.css('top', '8px');
      textPanel.css('paddingTop', '35px');
    } else {
      textPanel.css('paddingTop', '0px');
      menu.css('box-shadow', '0 1px 20px rgba(0,0,0,0.3)');
      leftFade.css('top', '0');
      textPanel.css('paddingTop', '0px');
    }
  } else {
    toolbar.css({ top: '0px' });
    textPanel.css('paddingTop', '0px');
    if(toolbar.is(':visible')) {
      textPanel.css('paddingTop', '7px');
      dragArea.css('width', '-webkit-calc(50% - 50px)');
      editor.css('paddingTop', '7px');
    } else {
      menuToggle.show();
      textPanel.css('paddingTop', '0px');
      dragArea.css({ 'width': 'calc(100% - 117px)' });
      editor.css('paddingTop', '0px');
    }
  }
}

function manageWindowSize() {
  var codeMirror = $('.CodeMirror-sizer');
  if(preview.is(':visible') && parseInt($('#body').width(),10) > 924) {
    toolbar.css('width', '50%');
    codeMirror.css('margin-right', '0');
  } else {
    toolbar.css('width', '100%');
    codeMirror.css('margin-right', '8px');
    if(!menu.is(':visible') && toolbar.is(':visible'))
      $('#draggable').css('width','calc(36% - 50px)');
  }
  settings.set('windowWidth', parseInt($(window).width(),10));
  settings.set('windowHeight', parseInt($(window).height(),10));
}

function toggleMenu() {
  var winButtons = $('#metacity').children('button');
  if(menu.attr('class').includes('hidden')) {
    menu.attr('class', 'slideInDown');
    menu.css('visibility', 'visible');
    menu.css('height', '27px');
    winButtons.css('marginTop', '2px');
    winButtons.css('marginBottom', '4px');
    $('#editArea').css('paddingTop', '0px');
    settings.set('showMenu', true);
  } else {
    menu.attr('class', 'hidden slideInDown');
    menu.css('visibility', 'hidden');
    menu.css('height', '0px');
    winButtons.css('marginTop', '3px');
    winButtons.css('marginBottom', '3px');
    settings.set('showMenu', false);
  }
  formatHead();
}

var toggleToolbar = () => {
  if(toolbar.is(':visible')) {
    toolbar.css('display', 'none');
    settings.set('showToolbar', false);
  } else {
    toolbar.css('display', 'block');
    settings.set('showToolbar', true);
  }
  if(process.platform === 'darwin') {
    toggleMenu();
    return;
  }
  formatHead();
};

function togglePreview() {
  var leftPanel = $('#leftPanel'),
      rightPanel = $('#rightPanel'),
      previewToggle = $('#previewToggle');
  if(preview.is(':visible')) {
    preview.css('display', 'none');
    leftPanel.width('100%');
    rightPanel.css('right', '-50%');
    leftFade.width('100%');
    rightFade.hide();
    syncScroll.hide();
    previewToggle.attr('class', 'fa fa-eye-slash');
    settings.set('showPreview', true);
  } else {
    preview.css('display', 'block');
    leftPanel.width('50%');
    rightPanel.css('right', '0');
    leftFade.width('50%');
    rightFade.show();
    syncScroll.show();
    previewToggle.attr('class', 'fa fa-eye');
    settings.set('showPreview', false);
  }
  formatHead();
  manageWindowSize();
}

function setPreviewMode(opt) {
  var markdown = $('#markdown'),
      html = $('#htmlPreview'),
      htmlText = "";
  if(markdown.is(':visible') && opt !== 'markdown') {
    markdown.hide();
    html.show();
    htmlText = html[0].innerHTML.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    html.text(htmlText);
    preview.css('padding', '27px 0 0 15px');
    preview.css('overflow', 'hidden');
  } else if(html.is(':visible') && opt !== 'html') {
    html.hide();
    markdown.show();
    preview.css('padding', '32px 15px 27px');
    preview.css('overflow-y', 'auto');
    settings.set('previewMode', 'markdown');
  }
  settings.set('previewMode', opt);
}

function setPreviewProfile(profile) {
  var profileTag = $('#profileTag'),
      current = profileTag.attr('href').slice(14,-4),
      profiles = ['default','github','user'],
      index = profiles.indexOf(profile.toLowerCase());
  if(index <= -1) return;
  if(current !== profiles[index])
    profileTag.attr('href', 'css/preview/'+profiles[index]+'.css');
  settings.set('previewProfile', profile.toString());
}

function toggleLineNumbers() {
  var state = settings.get('lineNumbers');
  if(state) {
    $('.CodeMirror-code > div').css('padding-left', '15px');
    $('.CodeMirror-gutters').hide();
  } else {
    $('.CodeMirror-code > div').css('padding-left', '22px');
    $('.CodeMirror-gutters').show();
  }
  settings.set('lineNumbers', !state);
}

function toggleWhitespace() {
  var state = settings.get('showTrailingSpace');
  if(state) {
    $('.cm-trailing-space-a').css('text-decoration', 'none');
    $('.cm-trailing-space-new-line').css('text-decoration', 'none');
  } else {
    $('.cm-trailing-space-a').css('text-decoration', 'underline');
    $('.cm-trailing-space-new-line').css('text-decoration', 'underline');
  }
  return settings.set('showTrailingSpace', !state);
}

function toggleFullscreen() {
  var window = electron.remote.getCurrentWindow();
  if(!window.isFullScreen()) {
    window.setFullScreen(true);
    settings.set('isFullscreen', true);
  } else {
    window.setFullScreen(false);
    settings.set('isFullscreen', false);
  }
}

function setFrontMatterTemplate() {
  storage.get('markdown-savefile', (err, data) => {
    if(err) notify(err, "error");
    var options = {
      'properties': ['openFile'],
      'filters': [
        { name: 'All', 'extensions': ["yaml", "yml", "md", "markdown", "txt", "text"] },
        { name: 'YAML', 'extensions': ["yaml", "yml"] },
        { name: 'Markdown', 'extensions': ["md", "markdown"] },
        { name: 'Text', 'extensions': [ "txt", "text"] }
      ]
    };
    dialog.showOpenDialog(options, (file) => {
      if(file === undefined)
        return notify("You didn't select a file", "error");
      fs.readFile(file[0], 'utf-8', (err, data) => {
        if(err)
          notify("An error ocurred while opening the file "+err.message, "error");
        settings.set('frontMatterTemplate', file[0]);
      });
    });
  });
}


// Handle settings-menu changes
$('#editorFontSize-input, #editorFontSize-up, #editorFontSize-down').bind('keyup mouseup', function () {
  var value = parseFloat($('#editorFontSize-input').val());
  editor.css('fontSize', value.toString()+'px');
  settings.set('editorFontSize', value);
});

$('#editorTheme','#previewProfile').on('changed.bs.select', function (e, clickedIndex, newValue, oldValue) {
  var theme = $(e.currentTarget).val().toLowerCase().replace(/ /g,"-");
  includeTheme(theme);
});

var ci,vnv,ov;
$('#previewProfile').on('changed.bs.select', function (e, clickedIndex, newValue, oldValue) {
  ci = clickedIndex; nv = newValue; ov = oldValue;
  var profile = $(e.currentTarget).val();
  $('#previewProfile').attr('title', profile);
  setPreviewProfile(profile);
});

function getInfo() {
  return 'newValue: '+nv.toString()+'\noldValue: '+ol.toString()+'\n';
}

$('#previewMode').on('changed.bs.select', function (e, clickedIndex, newValue, oldValue) {
  var mode = $(e.currentTarget).val().toLowerCase();
  setPreviewMode(mode);
});

$('#previewFontSize-input, #previewFontSize-up, #previewFontSize-down').bind('keyup mouseup', function () {
  var value = parseFloat($('#previewFontSize-input').val());
  preview.css('fontSize', value.toString()+'px');
  settings.set('previewFontSize', value);
});


$('.settings-toggle').change(() => {
  opt.forEach((temp) => {
    if(temp.name === $('.settings-toggle').attr('setting')) {
      if (temp.action) {
        temp.action();
      } else {
        var name = $('.settings-toggle').attr('setting');
        settings.set(name, !settings.get(name));
        settings.set($('.settings-toggle').attr('setting'))
      }
    }
  });
});
