/* dendry
 * http://github.com/idmillington/dendry
 *
 * MIT License
 */
/*jshint indent:2 */
(function() {
  'use strict';

  var contentToHTML = require('./content/html');
  var engine = require('../engine');

  var createElement = function(tagName) {
    return document.createElement(tagName);
  };

  var query = function(selector, context) {
    return (context || document).querySelector(selector);
  };

  var queryAll = function(selector, context) {
    return Array.prototype.slice.call(
      (context || document).querySelectorAll(selector)
    );
  };

  var htmlToNodes = function(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return Array.prototype.slice.call(template.content.childNodes);
  };

  var setStyleValue = function(element, property, value) {
    if (!element) {
      return;
    }
    if (property.indexOf('-') !== -1) {
      element.style.setProperty(property, value);
    } else {
      element.style[property] = value;
    }
  };

  var applyStyles = function(element, styles) {
    if (!element || !styles) {
      return;
    }
    if (typeof styles === 'string') {
      element.style.cssText = styles;
      return;
    }
    Object.keys(styles).forEach(function(key) {
      setStyleValue(element, key, styles[key]);
    });
  };

  var fadeIn = function(element, duration, callback) {
    if (!element) {
      if (callback) {
        callback();
      }
      return;
    }

    if (!duration) {
      element.style.opacity = '';
      element.style.display = '';
      if (callback) {
        callback();
      }
      return;
    }

    element.style.opacity = '0';
    element.style.display = '';

    var startTime = null;
    var step = function(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      element.style.opacity = String(progress);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.style.opacity = '';
        if (callback) {
          callback();
        }
      }
    };

    window.requestAnimationFrame(step);
  };

  var fadeOut = function(element, duration, callback) {
    if (!element) {
      if (callback) {
        callback();
      }
      return;
    }

    if (!duration) {
      element.style.display = 'none';
      if (callback) {
        callback();
      }
      return;
    }

    var computedOpacity = window.getComputedStyle(element).opacity;
    var startOpacity = parseFloat(computedOpacity);
    if (isNaN(startOpacity)) {
      startOpacity = 1;
    }

    var startTime = null;
    var step = function(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      element.style.opacity = String(startOpacity * (1 - progress));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.style.opacity = '';
        element.style.display = 'none';
        if (callback) {
          callback();
        }
      }
    };

    window.requestAnimationFrame(step);
  };

  var animateNumeric = function(target, property, endValue, duration, callback) {
    if (!target) {
      if (callback) {
        callback();
      }
      return;
    }

    if (!duration) {
      target[property] = endValue;
      if (callback) {
        callback();
      }
      return;
    }

    var startValue = Number(target[property]);
    if (isNaN(startValue)) {
      startValue = 0;
    }

    var startTime = null;
    var step = function(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      target[property] = startValue + ((endValue - startValue) * progress);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else if (callback) {
        callback();
      }
    };

    window.requestAnimationFrame(step);
  };

  var animateScrollTop = function(targetTop, duration) {
    animateNumeric(document.documentElement, 'scrollTop', targetTop, duration);
    animateNumeric(document.body, 'scrollTop', targetTop, duration);
  };

  var safePlayAudio = function(audio) {
    if (!audio) {
      return;
    }
    var playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function() {});
    }
  };

  var getBgElements = function() {
    return {
      bg1: query('#bg1'),
      bg2: query('#bg2')
    };
  };

  var getSpriteElement = function(loc) {
    if (loc === 'topleft') {
      return query('#topLeftSprite');
    } else if (loc === 'topright') {
      return query('#topRightSprite');
    } else if (loc === 'bottomleft') {
      return query('#bottomLeftSprite');
    } else if (loc === 'bottomright') {
      return query('#bottomRightSprite');
    }
    return null;
  };

  var clearSpriteElement = function(element, duration) {
    if (!element) {
      return;
    }
    if (!element.children.length) {
      element.innerHTML = '';
      return;
    }
    fadeOut(element, duration, function() {
      element.innerHTML = '';
      element.style.display = '';
    });
  };

  var clearAllSpriteElements = function(duration) {
    ['topleft', 'topright', 'bottomleft', 'bottomright'].forEach(function(loc) {
      clearSpriteElement(getSpriteElement(loc), duration);
    });
  };

  var BrowserUserInterface = function(game, content) {
    this.game = game;
    this.content = content;
    this.$content = content;
    this._registerEvents();

    this.dendryEngine = new engine.DendryEngine(this, game);
    // TODO: consider displaying a sidebar with various qualities...
    this.hasSidebar = false;
    this.sidebarQualities = [];
    // TODO: refactor how the settings work - move it all within a single object
    this.base_settings = {
      'disable_bg': false,
      'animate': false,
      'animate_bg': true,
      'disable_audio': false,
      'show_portraits': true,
      'dark_mode': false
    };
    this.disable_bg = false;
    this.animate = false;
    this.animate_bg = true;
    this.disable_audio = false;
    this.dark_mode = false;
    // backgrounds and portraits are 100% optional, and most games will not use them.
    this.show_portraits = true;
    this.fade_time = 600;
    this.bg_fade_out_time = 200;
    this.bg_fade_in_time = 1000;
    this.sound_fade_time = 2000;
    this.contentToHTML = contentToHTML;

    // sprites
    this.spriteLocs = {
      'topLeft': 1,
      'topRight': 1,
      'bottomLeft': 1,
      'bottomRight': 1
    };
    // current HTMLAudioElement
    this.currentAudio = null;
    // current audio url
    this.currentAudioURL = '';
    this.audioQueue = [];
    // flag for determining if we're on a new page, up until the first choice.
    this.onNewPage = false;

    // for saving
    this.save_prefix = game.title + '_' + game.author + '_save';
    this.max_slots = 8; // max save slots
    this.DateOptions = {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
  };
  engine.UserInterface.makeParentOf(BrowserUserInterface);

  // ------------------------------------------------------------------------
  // Main API

  BrowserUserInterface.prototype.displayContent = function(paragraphs) {
    var nodes = htmlToNodes(contentToHTML.convert(paragraphs));
    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];
      if (this.animate && node.nodeType === Node.ELEMENT_NODE) {
        fadeIn(node, this.fade_time);
      }
      this.content.appendChild(node);
    }
    this.content.focus();
    // allow user to add custom stuff on display content (for sidebar in this case)
    if (window && window.onDisplayContent) {
      window.onDisplayContent();
    }
  };

  BrowserUserInterface.prototype.displayGameOver = function() {
    var p = createElement('p');
    p.textContent = this.getGameOverMsg();
    p.classList.add('game-over');
    if (this.animate) {
      fadeIn(p, this.fade_time);
    }
    this.content.appendChild(p);
    p.focus();
  };

  BrowserUserInterface.prototype.displayChoices = function(choices) {
    var ul = createElement('ul');
    ul.classList.add('choices');

    for (var i = 0; i < choices.length; ++i) {
      var choice = choices[i];
      var title = contentToHTML.convertLine(choice.title);
      var subtitle = '';
      if (choice.subtitle !== undefined) {
        subtitle = contentToHTML.convertLine(choice.subtitle);
      }

      var li = createElement('li');
      var titleHolder = li;
      if (choice.canChoose) {
        titleHolder = createElement('a');
        titleHolder.href = '#';
        titleHolder.setAttribute('data-choice', i);
        li.appendChild(titleHolder);
      } else {
        li.classList.add('unavailable');
      }

      titleHolder.innerHTML = title;
      if (subtitle) {
        var subtitleDiv = createElement('div');
        subtitleDiv.classList.add('subtitle');
        subtitleDiv.innerHTML = subtitle;
        li.appendChild(subtitleDiv);
      }
      ul.appendChild(li);
    }

    if (this.animate) {
      fadeIn(ul, this.fade_time);
    }
    this.content.appendChild(ul);
    ul.focus();
    if (this.onNewPage) {
      this.onNewPage = false;
      if (window && window.onNewPage) {
        window.onNewPage();
      }
    }
  };

  BrowserUserInterface.prototype.newPage = function() {
    if (this.animate) {
      var children = Array.prototype.slice.call(this.content.children);
      var remaining = children.length;
      var that = this;
      if (remaining === 0) {
        this.content.innerHTML = '';
      } else {
        children.forEach(function(child) {
          fadeOut(child, that.fade_time, function() {
            remaining--;
            if (remaining === 0) {
              that.content.innerHTML = '';
            }
          });
        });
      }
    } else {
      this.content.innerHTML = '';
    }
    this.onNewPage = true;
  };

  BrowserUserInterface.prototype.setStyle = function(style) {
    this.content.className = '';
    if (style !== undefined) {
      this.content.classList.add(style);
    }
  };

  BrowserUserInterface.prototype.removeChoices = function() {
    queryAll('.choices, .hidden', this.content).forEach(function(element) {
      element.remove();
    });
  };

  BrowserUserInterface.prototype.beginOutput = function() {
    var marker = query('#read-marker', this.content);
    if (marker) {
      marker.remove();
    }
    var hr = createElement('hr');
    hr.id = 'read-marker';
    this.content.appendChild(hr);
  };

  BrowserUserInterface.prototype.endOutput = function() {
    var marker = query('#read-marker', this.content);
    if (this.animate) {
      if (marker) {
        animateScrollTop(marker.offsetTop, this.fade_time);
      } else {
        animateScrollTop(0, this.fade_time);
      }
    }
  };

  BrowserUserInterface.prototype.signal = function(data) {
    // TODO: implement signals - signals contain signal, event, and id
    console.log(data);
    var signal = data.signal;
    var event = data.event; // scene-arrival, scene-display, scene-departure, quality-change
    var scene_id = data.id;
    // TODO: handle this in the game.js for each specific game
    if (window && window.handleSignal) {
      window.handleSignal(signal, event, scene_id);
    }
  };

  // visual extensions

  BrowserUserInterface.prototype.setBg = function(image_url) {
    var bgElements = getBgElements();
    var bg1 = bgElements.bg1;
    var bg2 = bgElements.bg2;

    if (!bg1) {
      return;
    }

    if (this.disable_bg) {
      bg1.classList.add('content_hidden');
      bg1.classList.remove('content_visible');
      setStyleValue(bg1, 'background-image', 'none');
    } else if (!image_url || image_url === 'none' || image_url === 'null') {
      if (this.animate_bg) {
        bg1.classList.add('content_hidden');
        bg1.classList.remove('content_visible');
        setTimeout(function() {
          setStyleValue(bg1, 'background-image', 'none');
          bg1.classList.remove('content_hidden');
          bg1.classList.add('content_visible');
        }, 100);
      } else {
        setStyleValue(bg1, 'background-image', 'none');
      }
    } else if (image_url.startsWith('#') ||
               image_url.startsWith('rgba(') ||
               image_url.startsWith('rgb(')) {
      if (this.animate_bg) {
        fadeOut(bg1, this.bg_fade_out_time, function() {
          setStyleValue(bg1, 'background-image', 'none');
          setStyleValue(bg1, 'background-color', image_url);
          bg1.style.display = '';
        });
        fadeIn(bg1, this.bg_fade_in_time, function() {
          if (bg2) {
            setStyleValue(bg2, 'background-image', 'none');
          }
        });
        console.log('changing background color ' + image_url);
      } else {
        setStyleValue(bg1, 'background-image', 'none');
        setStyleValue(bg1, 'background-color', image_url);
      }
    } else if (image_url.startsWith('linear-gradient(')) {
      if (this.animate_bg) {
        fadeOut(bg1, this.bg_fade_out_time, function() {
          setStyleValue(bg1, 'background-image', image_url);
          bg1.style.display = '';
        });
        fadeIn(bg1, this.bg_fade_in_time, function() {
          if (bg2) {
            setStyleValue(bg2, 'background-image', image_url);
          }
        });
        console.log('changing background gradient ' + image_url);
      } else {
        setStyleValue(bg1, 'background-image', image_url);
      }
    } else {
      if (this.animate_bg) {
        fadeOut(bg1, this.bg_fade_out_time, function() {
          setStyleValue(bg1, 'background-image', 'url("' + image_url + '")');
          bg1.style.display = '';
        });
        fadeIn(bg1, this.bg_fade_in_time, function() {
          if (bg2) {
            setStyleValue(
              bg2,
              'background-image',
              window.getComputedStyle(bg1).backgroundImage
            );
          }
        });
      } else {
        setStyleValue(bg1, 'background-image', 'url("' + image_url + '")');
      }
    }
  };

  // set sprites given data
  // data is a list of two-element lists, where the first element is location
  // (one of topLeft, topRight, bottomLeft, bottomRight)
  // and the second element is the sprite.
  BrowserUserInterface.prototype.setSprites = function(data) {
    if (window && window.setSprites) {
      window.setSprites(data);
      return;
    }
    if (!this.show_portraits || data === 'none' || data === 'clear') {
      clearAllSpriteElements(this.fade_time);
      return;
    }

    if (Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        this.setSprite(data[i][0], data[i][1]);
      }
    } else if (data) {
      var objKeys = Object.keys(data);
      for (var keyIdx = 0; keyIdx < objKeys.length; keyIdx++) {
        var objKey = objKeys[keyIdx];
        this.setSprite(objKey, data[objKey]);
      }
    }
  };

  BrowserUserInterface.prototype.setSprite = function(loc, img) {
    if (!this.show_portraits) {
      return;
    }
    if (window && window.setSprite) {
      window.setSprite(loc, img);
      return;
    }

    loc = loc.toLowerCase();
    var targetSprite = getSpriteElement(loc);
    if (!targetSprite) {
      return;
    }

    if (img === 'none' || img === 'clear') {
      delete this.dendryEngine.state.sprites[loc];
      fadeOut(targetSprite, this.fade_time, function() {
        targetSprite.innerHTML = '';
        targetSprite.style.display = '';
      });
      return;
    }

    this.dendryEngine.state.sprites[loc] = img;
    var fadeTime = this.fade_time;
    fadeOut(targetSprite, fadeTime, function() {
      targetSprite.innerHTML = '';
      var image = new Image();
      image.src = img;
      targetSprite.appendChild(image);
      targetSprite.style.display = '';
      fadeIn(targetSprite, fadeTime);
    });
  };

  BrowserUserInterface.prototype.setSpriteStyle = function(loc, style) {
    if (window && window.setSpriteStyle) {
      window.setSpriteStyle(loc, style);
      return;
    }
    var targetSprite = getSpriteElement(loc.toLowerCase());
    if (!targetSprite) {
      return;
    }
    applyStyles(targetSprite, style);
  };

  // play audio with js
  // audio is a space-separated string with at least one entry.
  // the first entry will be a file url.
  // the second-nth entries are words describing how the file will be played:
  // 'queue' for playing the music next after the current audio ends
  // 'loop' if this music will loop indefinitely.
  // 'nofade' if the sound will be played instantly without a fadein or fadeout.
  BrowserUserInterface.prototype.audio = function(audio) {
    if (this.disable_audio) {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.loop = false;
      }
      return;
    }
    var audioData = audio.split(' ');
    var isLoop = audioData.includes('loop');
    var isQueue = audioData.includes('queue');
    var noFade = audioData.includes('nofade');
    var audioFile = audioData[0];
    var currentAudio = this.currentAudio;
    var fadeTime = this.sound_fade_time;

    if (audioFile === 'null' || audioFile === 'none') {
      if (this.currentAudio) {
        animateNumeric(currentAudio, 'volume', 0, this.sound_fade_time, function() {
          currentAudio.pause();
        });
        this.currentAudio.loop = false;
      }
    } else {
      // fadeout current audio, then fade-in new audio
      console.log('new audio:', audioFile, 'current audio:', this.currentAudioURL);
      if (this.currentAudio && (this.currentAudioURL === audioFile || isQueue)) {
        if (!currentAudio.ended && !currentAudio.paused) {
          console.log('adding music to queue');
          this.audioQueue = [audioFile];
          var audioQueue = this.audioQueue;
          this.currentAudio.onended = function() {
            var newAudio = audioQueue.pop();
            if (newAudio) {
              currentAudio.src = newAudio;
              console.log('playing from queue');
              currentAudio.volume = 0;
              safePlayAudio(currentAudio);
              animateNumeric(currentAudio, 'volume', 1, fadeTime);
              window.dendryUI.currentAudioURL = newAudio;
            }
          };
        } else {
          this.currentAudioURL = audioFile;
          currentAudio.src = audioFile;
          console.log('Fading in new audio');
          currentAudio.volume = 0;
          safePlayAudio(currentAudio);
          animateNumeric(currentAudio, 'volume', 1, fadeTime);
        }
      } else if (this.currentAudio) {
        this.currentAudioURL = audioFile;
        console.log('currentAudio present,  fading out current audio');
        // reset the current audio function
        currentAudio.onended = function() {};
        if (noFade) {
          currentAudio.pause();
          currentAudio.src = audioFile;
          safePlayAudio(currentAudio);
        } else {
          animateNumeric(currentAudio, 'volume', 0, this.sound_fade_time, function() {
            console.log(currentAudio);
            currentAudio.src = audioFile;
            currentAudio.volume = 0;
            console.log('Fading in new audio');
            safePlayAudio(currentAudio);
            animateNumeric(currentAudio, 'volume', 1, fadeTime);
          });
        }
      } else {
        this.currentAudio = new Audio(audioFile);
        this.currentAudioURL = audioFile;
        this.currentAudio.volume = 0;
        safePlayAudio(this.currentAudio);
        animateNumeric(this.currentAudio, 'volume', 1, this.sound_fade_time);
      }
      if (isLoop) {
        this.currentAudio.loop = true;
      } else {
        this.currentAudio.loop = false;
      }
      // https://stackoverflow.com/questions/7451508/html5-audio-playback-with-fade-in-and-fade-out
    }
  };

  BrowserUserInterface.prototype.saveSettings = function() {
    if (typeof localStorage !== 'undefined') {
      localStorage[this.game.title + '_animate'] = this.animate;
      localStorage[this.game.title + '_disable_bg'] = this.disable_bg;
      localStorage[this.game.title + '_animate_bg'] = this.animate_bg;
      localStorage[this.game.title + '_show_portraits'] = this.show_portraits;
      localStorage[this.game.title + '_disable_audio'] = this.disable_audio;
      localStorage[this.game.title + '_dark_mode'] = this.dark_mode;
    }
  };

  // TODO: separate fade-in from scroll
  BrowserUserInterface.prototype.loadSettings = function(defaultSettings) {
    var defaults = {
      animate: false,
      disable_bg: false,
      animate_bg: true,
      show_portraits: true,
      disable_audio: false,
      dark_mode: false
    };
    if (typeof localStorage !== 'undefined') {
      for (var prop in defaults) {
        if (defaults.hasOwnProperty(prop)) {
          var lsKey = this.game.title + '_' + prop;
          if (lsKey in localStorage) {
            this[prop] = localStorage[lsKey] !== 'false';
          } else if (defaultSettings && defaultSettings.hasOwnProperty(prop)) {
            this[prop] = defaultSettings[prop];
          } else {
            this[prop] = defaults[prop];
          }
        }
      }
    }
  };

  BrowserUserInterface.prototype.toggle_audio = function(enable_audio) {
    if (enable_audio) {
      this.disable_audio = false;
    } else {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.loop = false;
      }
      this.disable_audio = true;
    }
  };

  // save functions
  BrowserUserInterface.prototype.autosave = function() {
    var oldData = localStorage[this.save_prefix + '_a0'];
    if (oldData) {
      localStorage[this.save_prefix + '_a1'] = oldData;
      localStorage[this.save_prefix + '_timestamp_a1'] =
        localStorage[this.save_prefix + '_timestamp_a0'];
    }
    var slot = 'a0';
    var saveString = JSON.stringify(this.dendryEngine.getExportableState());
    localStorage[this.save_prefix + '_' + slot] = saveString;
    var scene = this.dendryEngine.state.sceneId;
    var date = new Date(Date.now());
    date = scene + '\n(' + date.toLocaleString(undefined, this.DateOptions) + ')';
    localStorage[this.save_prefix + '_timestamp_' + slot] = date;
    this.populateSaveSlots(slot + 1, 2);
  };

  BrowserUserInterface.prototype.quickSave = function() {
    var saveString = JSON.stringify(this.dendryEngine.getExportableState());
    localStorage[this.save_prefix + '_q'] = saveString;
    window.alert('Saved.');
  };

  BrowserUserInterface.prototype.saveSlot = function(slot) {
    var saveString = JSON.stringify(this.dendryEngine.getExportableState());
    localStorage[this.save_prefix + '_' + slot] = saveString;
    var scene = this.dendryEngine.state.sceneId;
    var date = new Date(Date.now());
    date = scene + '\n(' + date.toLocaleString(undefined, this.DateOptions) + ')';
    localStorage[this.save_prefix + '_timestamp_' + slot] = date;
    this.populateSaveSlots(slot + 1, 2);
  };

  BrowserUserInterface.prototype.quickLoad = function() {
    if (localStorage[this.save_prefix + '_q']) {
      var saveString = localStorage[this.save_prefix + '_q'];
      this.dendryEngine.setState(JSON.parse(saveString));
      window.alert('Loaded.');
    } else {
      window.alert('No save available.');
    }
  };

  BrowserUserInterface.prototype.loadSlot = function(slot) {
    if (localStorage[this.save_prefix + '_' + slot]) {
      var saveString = localStorage[this.save_prefix + '_' + slot];
      this.dendryEngine.setState(JSON.parse(saveString));
      this.hideSaveSlots();
      window.alert('Loaded.');
    } else {
      window.alert('No save available.');
    }
  };

  BrowserUserInterface.prototype.deleteSlot = function(slot) {
    if (localStorage[this.save_prefix + '_' + slot]) {
      localStorage[this.save_prefix + '_' + slot] = '';
      localStorage[this.save_prefix + '_timestamp_' + slot] = '';
      this.populateSaveSlots(slot + 1, 2);
    } else {
      window.alert('No save available.');
    }
  };

  BrowserUserInterface.prototype.exportSlot = function(slot) {
    if (localStorage[this.save_prefix + '_' + slot]) {
      var data = localStorage[this.save_prefix + '_' + slot];
      var a = document.createElement('a');
      var file = new Blob([data], {type: 'text/plain'});
      a.href = URL.createObjectURL(file);
      a.download = 'save.txt';
      a.click();
    } else {
      window.alert('No save available.');
    }
  };

  BrowserUserInterface.prototype.importSave = function(doc_id) {
    var that = this;
    var uploader = document.getElementById(doc_id);
    if (!uploader || !uploader.files || !uploader.files[0]) {
      window.alert('No file selected.');
      return;
    }
    function onFileLoad(e) {
      var data = e.target.result;
      try {
        that.dendryEngine.setState(JSON.parse(data));
        that.hideSaveSlots();
        window.alert('Loaded.');
      } catch (err) {
        window.alert('Invalid save file.');
      }
    }
    function onFileError() {
      window.alert('Unable to read file.');
    }
    var reader = new FileReader();
    var file = uploader.files[0];
    console.log(uploader.files);
    reader.onload = onFileLoad;
    reader.onerror = onFileError;
    reader.readAsText(file);
  };

  BrowserUserInterface.prototype.populateSaveSlots = function(max_slots, max_auto_slots) {
    // this fills in the save information
    var that = this;
    function createLoadListener(i) {
      return function() {
        that.loadSlot(i);
      };
    }
    function createSaveListener(i) {
      return function() {
        that.saveSlot(i);
      };
    }
    function createDeleteListener(i) {
      return function() {
        that.deleteSlot(i);
      };
    }
    function createExportListener(i) {
      return function() {
        that.exportSlot(i);
      };
    }
    function populateSlot(id) {
      var save_element = document.getElementById('save_info_' + id);
      var save_button = document.getElementById('save_button_' + id);
      var delete_button = document.getElementById('delete_button_' + id);
      var export_button = document.getElementById('export_button_' + id);
      if (!save_element || !save_button || !delete_button) {
        return;
      }
      if (localStorage[that.save_prefix + '_' + id]) {
        var timestamp = localStorage[that.save_prefix + '_timestamp_' + id];
        save_element.textContent = timestamp;
        save_button.textContent = 'Load';
        save_button.onclick = createLoadListener(id);
        delete_button.onclick = createDeleteListener(id);
        if (export_button) {
          export_button.onclick = createExportListener(id);
        }
      } else {
        save_button.textContent = 'Save';
        save_element.textContent = 'Empty';
        save_button.onclick = createSaveListener(id);
      }
    }
    for (var i = 0; i < max_slots; i++) {
      populateSlot(i);
    }
    for (i = 0; i < max_auto_slots; i++) {
      populateSlot('a' + i);
    }
  };

  BrowserUserInterface.prototype.showSaveSlots = function() {
    var save_element = document.getElementById('save');
    if (!save_element) {
      return;
    }
    save_element.style.display = 'block';
    this.populateSaveSlots(this.max_slots, 2);
    var that = this;
    if (!save_element.onclick) {
      save_element.onclick = function(evt) {
        var target = evt.target;
        var saveModal = document.getElementById('save');
        if (target === saveModal) {
          that.hideSaveSlots();
        }
      };
    }
  };

  BrowserUserInterface.prototype.hideSaveSlots = function() {
    var save_element = document.getElementById('save');
    if (save_element) {
      save_element.style.display = 'none';
    }
  };

  // functions for dealing with options
  BrowserUserInterface.prototype.setOption = function(option, toggle) {
    this[option] = toggle;
    this.saveSettings();
  };

  BrowserUserInterface.prototype.populateOptions = function() {
    var backgroundsNo = document.getElementById('backgrounds_no');
    var backgroundsYes = document.getElementById('backgrounds_yes');
    var animateYes = document.getElementById('animate_yes');
    var animateNo = document.getElementById('animate_no');
    var animateBgYes = document.getElementById('animate_bg_yes');
    var animateBgNo = document.getElementById('animate_bg_no');

    if (backgroundsNo && backgroundsYes) {
      if (this.disable_bg) {
        backgroundsNo.checked = true;
      } else {
        backgroundsYes.checked = true;
      }
    }
    if (animateYes && animateNo) {
      if (this.animate) {
        animateYes.checked = true;
      } else {
        animateNo.checked = true;
      }
    }
    if (animateBgYes && animateBgNo) {
      if (this.animate_bg) {
        animateBgYes.checked = true;
      } else {
        animateBgNo.checked = true;
      }
    }
  };

  BrowserUserInterface.prototype.hideOptions = function() {
    var options_element = document.getElementById('options');
    if (options_element) {
      options_element.style.display = 'none';
    }
  };

  BrowserUserInterface.prototype.showOptions = function() {
    var that = this;
    var options_element = document.getElementById('options');
    if (!options_element) {
      return;
    }
    this.populateOptions();
    options_element.style.display = 'block';
    if (!options_element.onclick) {
      options_element.onclick = function(evt) {
        var target = evt.target;
        var optionsModal = document.getElementById('options');
        if (target === optionsModal) {
          that.hideOptions();
        }
      };
    }
  };

  // ------------------------------------------------------------------------
  // Additional methods

  BrowserUserInterface.prototype.getGameOverMsg = function() {
    return 'Game Over (reload to read again)';
  };

  BrowserUserInterface.prototype._registerEvents = function() {
    var that = this;
    this.content.addEventListener('click', function(event) {
      var choiceLink = event.target.closest('ul.choices li a');
      if (choiceLink && that.content.contains(choiceLink)) {
        event.preventDefault();
        event.stopPropagation();
        var choice = parseInt(choiceLink.getAttribute('data-choice'), 10);
        that.dendryEngine.choose(choice);
        return false;
      }

      var choiceItem = event.target.closest('ul.choices li');
      if (choiceItem && that.content.contains(choiceItem)) {
        var nestedLink = choiceItem.querySelector('a[data-choice]');
        if (nestedLink) {
          event.preventDefault();
          event.stopPropagation();
          nestedLink.click();
          return false;
        }
      }
      return undefined;
    });
  };

  // ------------------------------------------------------------------------
  // Run when loaded.

  var main = function() {
    if (window.dendryUI) {
      return;
    }

    var contentElement = query('#content');
    if (!contentElement) {
      return;
    }

    engine.convertJSONToGame(window.game.compiled, function(err, game) {
      if (err) {
        throw err;
      }

      var ui = new BrowserUserInterface(game, contentElement);
      window.dendryUI = ui;
      // Allow the ui system to be customized before use.
      if (window.dendryModifyUI !== undefined) {
        // If it returns true, then we don't need to begin the game.
        var dontStart = window.dendryModifyUI(ui);
        if (dontStart) {
          return;
        }
      }
      ui.dendryEngine.beginGame();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
}());
