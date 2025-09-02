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

  // Utility functions for DOM manipulation
  var utils = {
    // Element selection
    $: function(selector) {
      if (typeof selector === 'string') {
        if (selector.indexOf('#') === 0) {
          return document.getElementById(selector.slice(1));
        } else if (selector.indexOf('.') === 0) {
          return document.getElementsByClassName(selector.slice(1));
        } else {
          return document.querySelectorAll(selector);
        }
      }
      return selector;
    },

    // Create element
    createElement: function(tag, attributes, content) {
      attributes = attributes || {};
      content = content || '';
      var element = document.createElement(tag);
      var keys = Object.keys(attributes);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = attributes[key];
        if (key === 'class') {
          element.className = value;
        } else {
          element.setAttribute(key, value);
        }
      }
      if (content) {
        element.innerHTML = content;
      }
      return element;
    },

    // Fade in animation
    fadeIn: function(element, duration, callback) {
      duration = duration || 600;
      element.style.opacity = '0';
      element.style.display = 'block';
      
      var start = performance.now();
      var animate = function(currentTime) {
        var elapsed = currentTime - start;
        var progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if (callback) {
          callback();
        }
      };
      requestAnimationFrame(animate);
    },

    // Fade out animation
    fadeOut: function(element, duration, callback) {
      duration = duration || 600;
      var start = performance.now();
      var startOpacity = parseFloat(getComputedStyle(element).opacity) || 1;
      
      var animate = function(currentTime) {
        var elapsed = currentTime - start;
        var progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = startOpacity * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          element.style.display = 'none';
          if (callback) {
            callback();
          }
        }
      };
      requestAnimationFrame(animate);
    },

    // Animate volume for audio elements
    animateVolume: function(audio, targetVolume, duration, callback) {
      duration = duration || 2000;
      var startVolume = audio.volume;
      var start = performance.now();
      
      var animate = function(currentTime) {
        var elapsed = currentTime - start;
        var progress = Math.min(elapsed / duration, 1);
        
        audio.volume = startVolume + (targetVolume - startVolume) * progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if (callback) {
          callback();
        }
      };
      requestAnimationFrame(animate);
    },

    // Smooth scroll
    scrollTo: function(element, duration) {
      duration = duration || 600;
      var targetPosition = element ? element.offsetTop : 0;
      var startPosition = window.pageYOffset;
      var distance = targetPosition - startPosition;
      var start = performance.now();
      
      var animate = function(currentTime) {
        var elapsed = currentTime - start;
        var progress = Math.min(elapsed / duration, 1);
        var easeInOutQuad = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        
        window.scrollTo(0, startPosition + distance * easeInOutQuad);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  };

  var BrowserUserInterface = function(game, contentElement) {
    this.game = game;
    this.contentElement = contentElement;
    this._registerEvents();

    this.dendryEngine = new engine.DendryEngine(this, game);
    // TODO: consider displaying a sidebar with various qualities...
    this.hasSidebar = false;
    this.sidebarQualities = [];
    // TODO: refactor how the settings work - move it all within a single object
    this.base_settings = {'disable_bg': false, 'animate':false, 'animate_bg': true, 'disable_audio': false, 'show_portraits': true};
    this.disable_bg = false;
    this.animate = false;
    this.animate_bg = true;
    this.disable_audio = false;
    // backgrounds and portraits are 100% optional, and most games will not use them.
    this.show_portraits = true;
    this.fade_time = 600;
    this.bg_fade_out_time = 200;
    this.bg_fade_in_time = 1000;
    this.sound_fade_time = 2000;
    this.contentToHTML = contentToHTML;

    // sprites
    this.spriteLocs = {'topLeft': 1, 'topRight': 1, 'bottomLeft': 1, 'bottomRight': 1};
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
    this.DateOptions = {hour: 'numeric',
                 minute: 'numeric',
                 second: 'numeric',
                 year: 'numeric', 
                 month: 'short', 
                 day: 'numeric' };
  };
  engine.UserInterface.makeParentOf(BrowserUserInterface);

  // ------------------------------------------------------------------------
  // Main API

  BrowserUserInterface.prototype.displayContent = function(paragraphs) {
    var htmlContent = contentToHTML.convert(paragraphs);
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    if (this.animate) {
        utils.fadeIn(tempDiv, this.fade_time);
    }
    
    this.contentElement.appendChild(tempDiv);
    tempDiv.focus();
    
    // allow user to add custom stuff on display content (for sidebar in this case)
    if (window && window.onDisplayContent) {
        window.onDisplayContent();
    }
  };
  
  BrowserUserInterface.prototype.displayGameOver = function() {
    var p = utils.createElement('p', {'class': 'game-over'}, this.getGameOverMsg());
    
    if (this.animate) {
        utils.fadeIn(p, this.fade_time);
    }
    
    this.contentElement.appendChild(p);
    p.focus();
  };
  
  BrowserUserInterface.prototype.displayChoices = function(choices) {
    var ul = utils.createElement('ul', {'class': 'choices'});
    
    for (var i = 0; i < choices.length; ++i) {
      var choice = choices[i];

      var title = contentToHTML.convertLine(choice.title);
      var subtitle = "";
      if (choice.subtitle !== undefined) {
        subtitle = contentToHTML.convertLine(choice.subtitle);
      }

      var li = utils.createElement('li');
      var titleHolder = li;
      
      if (choice.canChoose) {
        titleHolder = utils.createElement('a', {href: '#', 'data-choice': i});
        li.appendChild(titleHolder);
      } else {
        titleHolder.classList.add('unavailable');
      }
      
      titleHolder.innerHTML = title;
      
      if (subtitle) {
        var subtitleDiv = utils.createElement('div', {'class': 'subtitle'}, subtitle);
        li.appendChild(subtitleDiv);
      }
      
      ul.appendChild(li);
    }
    
    if (this.animate) {
        utils.fadeIn(ul, this.fade_time);
    }
    
    this.contentElement.appendChild(ul);
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
        var children = this.contentElement.children;
        var childrenArray = [];
        for (var i = 0; i < children.length; i++) {
          childrenArray.push(children[i]);
        }
        for (var j = 0; j < childrenArray.length; j++) {
          var child = childrenArray[j];
          utils.fadeOut(child, this.fade_time, function() {
            if (child.parentNode) {
              child.parentNode.removeChild(child);
            }
          });
        }
    } else {
        this.contentElement.innerHTML = '';
    }
    this.onNewPage = true;
  };
  
  BrowserUserInterface.prototype.setStyle = function(style) {
    this.contentElement.className = '';
    if (style !== undefined) {
      this.contentElement.classList.add(style);
    }
  };
  
  BrowserUserInterface.prototype.removeChoices = function() {
    var choices = this.contentElement.querySelectorAll('.choices');
    for (var i = 0; i < choices.length; i++) {
      choices[i].parentNode.removeChild(choices[i]);
    }
    
    var hidden = this.contentElement.querySelectorAll('.hidden');
    for (var j = 0; j < hidden.length; j++) {
      hidden[j].parentNode.removeChild(hidden[j]);
    }
  };
  
  BrowserUserInterface.prototype.beginOutput = function() {
    var existingMarker = document.getElementById('read-marker');
    if (existingMarker) {
      existingMarker.remove();
    }
    
    var marker = utils.createElement('hr', {id: 'read-marker'});
    this.contentElement.appendChild(marker);
  };
  
  BrowserUserInterface.prototype.endOutput = function() {
    var marker = document.getElementById('read-marker');
    if (this.animate) {
        if (marker) {
          utils.scrollTo(marker, this.fade_time);
        } else {
          utils.scrollTo(null, this.fade_time);
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
      var bg1 = document.getElementById('bg1');
      var bg2 = document.getElementById('bg2');
      
      if (this.disable_bg) {
            bg1.classList.add('content_hidden');
            bg1.classList.remove('content_visible');
            bg1.style.backgroundImage = 'none'; 
      }
      else if (!image_url || image_url == 'none' || image_url == 'null') {
          if (this.animate_bg) {
            bg1.classList.add('content_hidden');
            bg1.classList.remove('content_visible');
            setTimeout(function() {
                bg1.style.backgroundImage = 'none'; 
                bg1.classList.remove('content_hidden');
                bg1.classList.add('content_visible');
            }, 100);
          } else {
              bg1.style.backgroundImage = 'none'; 
          }
      } else if (image_url.startsWith('#') || image_url.startsWith('rgba(') || image_url.startsWith('rgb(')) {
          if (this.animate_bg) {
            utils.fadeOut(bg1, this.bg_fade_out_time, function() {
                bg1.style.backgroundImage = 'none'; 
                bg1.style.backgroundColor = image_url;
            });
            utils.fadeIn(bg1, this.bg_fade_in_time, function() {
                bg2.style.backgroundImage = 'none'; 
            });
            console.log('changing background color ' + image_url);
          } else {
              bg1.style.backgroundImage = 'none'; 
              bg1.style.backgroundColor = image_url;
          }
      } else if (image_url.startsWith('linear-gradient(')) {
          if (this.animate_bg) {
            utils.fadeOut(bg1, this.bg_fade_out_time, function() {
                bg1.style.backgroundImage = image_url; 
            });
            utils.fadeIn(bg1, this.bg_fade_in_time, function() {
                bg2.style.backgroundImage = image_url; 
            });
            console.log('changing background gradient ' + image_url);
          } else {
              bg1.style.backgroundImage = image_url; 
          }
      } else {
          if (this.animate_bg) {
            utils.fadeOut(bg1, this.bg_fade_out_time, function() {
                bg1.style.backgroundImage = 'url("' + image_url + '")'; 
            });
            utils.fadeIn(bg1, this.bg_fade_in_time, function() {
                bg2.style.backgroundImage = bg1.style.backgroundImage;
            });
          } else {
              bg1.style.backgroundImage = 'url("' + image_url + '")'; 
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
          var sprites = ['topLeftSprite', 'topRightSprite', 'bottomLeftSprite', 'bottomRightSprite'];
          for (var s = 0; s < sprites.length; s++) {
              var spriteId = sprites[s];
              var sprite = document.getElementById(spriteId);
              if (sprite) {
                  var children = Array.prototype.slice.call(sprite.children);
                  for (var c = 0; c < children.length; c++) {
                      var child = children[c];
                      utils.fadeOut(child, this.fade_time, function() {
                          sprite.innerHTML = '';
                      });
                  }
              }
          }
          return;
      } else {
          if (data instanceof Array) {
              for (var i = 0; i < data.length; i++) {
                  var loc = data[i][0];
                  var img = data[i][1];
                  this.setSprite(loc, img);
              }
          } else if (data) {
                var sprites = [];
                for (var key in Object.keys(data)) {
                  sprites.push([key, data[key]]);
              }
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
      var targetSprite;
      if (loc == 'topleft') {
          targetSprite = document.getElementById('topLeftSprite');
      } else if (loc == 'topright') {
          targetSprite = document.getElementById('topRightSprite');
      } else if (loc == 'bottomleft') {
          targetSprite = document.getElementById('bottomLeftSprite');
      } else if (loc == 'bottomright') {
          targetSprite = document.getElementById('bottomRightSprite');
      }
      
      if (img == 'none' || img == 'clear') {
          delete this.dendryEngine.state.sprites[loc];
          utils.fadeOut(targetSprite, this.fade_time, function() {
            targetSprite.innerHTML = '';
          });
          return;
      } else {
          this.dendryEngine.state.sprites[loc] = img;
          var self = this;
          utils.fadeOut(targetSprite, this.fade_time, function() {
              targetSprite.innerHTML = '';
              var image = new Image();
              image.src = img;
              targetSprite.appendChild(image);
              console.log('fadeIn');
              utils.fadeIn(targetSprite, self.fade_time);
          });
      }
  };

  BrowserUserInterface.prototype.setSpriteStyle = function(loc, style) {
      if (window && window.setSpriteStyle) {
          window.setSpriteStyle(loc, style);
          return;
      }
      var targetSprite;
      if (loc == 'topleft') {
          targetSprite = document.getElementById('topLeftSprite');
      } else if (loc == 'topright') {
          targetSprite = document.getElementById('topRightSprite');
      } else if (loc == 'bottomleft') {
          targetSprite = document.getElementById('bottomLeftSprite');
      } else if (loc == 'bottomright') {
          targetSprite = document.getElementById('bottomRightSprite');
      } else {
          return;
      }
      var keys = Object.keys(style);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = style[key];
        targetSprite.style[key] = value;
      }
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
      var isLoop = audioData.indexOf('loop') !== -1;
      var isQueue = audioData.indexOf('queue') !== -1;
      var noFade = audioData.indexOf('nofade') !== -1;
      var audioFile = audioData[0];
      var currentAudio = this.currentAudio;
      var fadeTime = this.sound_fade_time;
      
      if (audioFile == 'null' || audioFile == 'none') {
          if (this.currentAudio) {
              utils.animateVolume(currentAudio, 0, this.sound_fade_time, function() {
                  currentAudio.pause();
              });
              this.currentAudio.loop = false;
          }
      } else {
          // fadeout current audio, then fade-in new audio
          console.log('new audio:', audioFile, 'current audio:',  this.currentAudioURL);
          if (this.currentAudio && (this.currentAudioURL == audioFile || isQueue)) {
              if (!currentAudio.ended && !currentAudio.paused) {
                  console.log('adding music to queue');
                  this.audioQueue = [audioFile];
                  var audioQueue = this.audioQueue;
                  var self = this;
                   this.currentAudio.onended = function() {
                       var newAudio = audioQueue.pop();
                       if (newAudio) {
                           currentAudio.src = newAudio;
                           console.log('playing from queue');
                           currentAudio.play();
                           utils.animateVolume(currentAudio, 1, fadeTime);
                           self.currentAudioURL = newAudio;
                       }
                   };
              } else {
                  this.currentAudioURL = audioFile;
                  currentAudio.src = audioFile;
                  console.log('Fading in new audio');
                  currentAudio.volume = 0;
                  currentAudio.play();
                  utils.animateVolume(currentAudio, 1, fadeTime);
              }
          }
          else if (this.currentAudio) {
              this.currentAudioURL = audioFile;
              console.log('currentAudio present,  fading out current audio');
              // reset the current audio function
              currentAudio.onended = function() {};
              if (noFade) {
                  currentAudio.pause();
                  currentAudio.src = audioFile;
                  currentAudio.play();
              } else {
                  utils.animateVolume(currentAudio, 0, this.sound_fade_time, function() {
                      console.log(currentAudio);
                      currentAudio.src = audioFile;
                      console.log('Fading in new audio');
                      currentAudio.play();
                      utils.animateVolume(currentAudio, 1, fadeTime);
                  });
              }
          } else {
                  this.currentAudio = new Audio(audioFile);
                  this.currentAudioURL = audioFile;
                  this.currentAudio.volume = 0;
                  this.currentAudio.play();
                  utils.animateVolume(this.currentAudio, 1, this.sound_fade_time);
              }
          if (isLoop) {
              this.currentAudio.loop = true;
          } else {
              this.currentAudio.loop = false;
          }
      }
  };

  BrowserUserInterface.prototype.saveSettings = function() {
    if (typeof localStorage !== 'undefined') {
        localStorage[this.game.title + '_animate'] = this.animate;
        localStorage[this.game.title + '_disable_bg'] = this.disable_bg;
        localStorage[this.game.title + '_animate_bg'] = this.animate_bg;
        localStorage[this.game.title + '_show_portraits'] = this.show_portraits;
        localStorage[this.game.title + '_disable_audio'] = this.disable_audio;
    }
  };

  // TODO: separate fade-in from scroll
  BrowserUserInterface.prototype.loadSettings = function(defaultSettings) {
    if (typeof localStorage !== 'undefined') {
        if (localStorage[this.game.title + '_animate']) {
            this.animate = localStorage[this.game.title + '_animate'] != 'false' || false;
        } else {
            if (defaultSettings && defaultSettings.animate) {
                this.animate = defaultSettings.animate;
            } else {
                this.animate = false;
            }
        }
        if (localStorage[this.game.title + '_disable_bg']) {
            this.disable_bg = localStorage[this.game.title + '_disable_bg'] != 'false' || false ;
        } else {
            if (defaultSettings && defaultSettings.disable_bg) {
                this.disable_bg = defaultSettings.disable_bg;
            } else {
                this.disable_bg = false;
            }
        }
        if (localStorage[this.game.title + '_animate_bg']) {
            this.animate_bg = localStorage[this.game.title + '_animate_bg'] != 'false' || false;
        } else {
            if (defaultSettings && defaultSettings.animate_bg) {
                this.animate_bg = defaultSettings.animate_bg;
            } else {
                this.animate_bg = true;
            }
        }
        if (localStorage[this.game.title + '_show_portraits']) {
            this.show_portraits = localStorage[this.game.title + '_show_portraits'] != 'false' || false;
        } else {
            if (defaultSettings && defaultSettings.show_portraits) {
                this.show_portraits = defaultSettings.show_portraits;
            } else {
                this.show_portraits = true;
            }
        }
        if (localStorage[this.game.title + '_disable_audio']) {
            this.disable_audio = localStorage[this.game.title + '_disable_audio'] != 'false' || false;
        } else {
            if (defaultSettings && defaultSettings.disable_audio) {
                this.disable_audio = defaultSettings.disable_audio;
            } else {
                this.disable_audio = false;
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
      var oldData = localStorage[this.save_prefix+'_a0'];
      if (oldData) {
          localStorage[this.save_prefix+'_a1'] = oldData;
          localStorage[this.save_prefix+'_timestamp_a1'] = localStorage[this.save_prefix+'_timestamp_a0'];
      }
      var slot = 'a0';
      var saveString = JSON.stringify(this.dendryEngine.getExportableState());
      localStorage[this.save_prefix + '_' + slot] = saveString;
      var scene = this.dendryEngine.state.sceneId;
      var date = new Date(Date.now());
      date = scene + '\n(' + date.toLocaleString(undefined, this.DateOptions) + ')';
      localStorage[this.save_prefix +'_timestamp_' + slot] = date;
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

  BrowserUserInterface.prototype.populateSaveSlots = function(max_slots, max_auto_slots) {
    // this fills in the save information
    var that = this;
    function createLoadListener(i) {
      return function(evt) {
        that.loadSlot(i);
      };
    }
    function createSaveListener(i) {
      return function(evt) {
        that.saveSlot(i);
      };
    }
    function createDeleteListener(i) {
      return function(evt) {
        that.deleteSlot(i);
      };
    }
    
    function populateSlot(id) {
        var save_element = document.getElementById('save_info_' + id);
        var save_button = document.getElementById('save_button_' + id);
        var delete_button = document.getElementById('delete_button_' + id);
        if (localStorage[that.save_prefix + '_' + id]) {
            var timestamp = localStorage[that.save_prefix+'_timestamp_' + id];
            save_element.textContent = timestamp;
            save_button.textContent = "Load";
            save_button.onclick = createLoadListener(id);
            delete_button.onclick = createDeleteListener(id);
        } else {
            save_button.textContent = "Save";
            save_element.textContent = "Empty";
            save_button.onclick = createSaveListener(id);
        }
    }
    
    for (var i = 0; i < max_slots; i++) {
        populateSlot(i);
    }
    for (i = 0; i < max_auto_slots; i++) {
        populateSlot('a'+i);
    }
  };

  BrowserUserInterface.prototype.showSaveSlots = function() {
    var save_element = document.getElementById('save');
    save_element.style.display = 'block';
    this.populateSaveSlots(this.max_slots, 2);
    var that = this;
    if (!save_element.onclick) {
      save_element.onclick = function(evt) {
        var target = evt.target;
        var save_element = document.getElementById('save');
        if (target == save_element) {
          that.hideSaveSlots();
        }
      };
    }
  };

  BrowserUserInterface.prototype.hideSaveSlots = function() {
    var save_element = document.getElementById('save');
    save_element.style.display = 'none';
  };

  // functions for dealing with options
  BrowserUserInterface.prototype.setOption = function(option, toggle) {
      this[option] = toggle; 
      this.saveSettings();
  };

  BrowserUserInterface.prototype.populateOptions = function() {
    var disable_bg = this.disable_bg;
    var animate = this.animate;
    var animate_bg = this.animate_bg;
    
    var backgroundsNo = document.getElementById('backgrounds_no');
    var backgroundsYes = document.getElementById('backgrounds_yes');
    var animateYes = document.getElementById('animate_yes');
    var animateNo = document.getElementById('animate_no');
    var animateBgYes = document.getElementById('animate_bg_yes');
    var animateBgNo = document.getElementById('animate_bg_no');
    
    if (disable_bg) {
        if (backgroundsNo) backgroundsNo.checked = true;
    } else {
        if (backgroundsYes) backgroundsYes.checked = true;
    }
    if (animate) {
        if (animateYes) animateYes.checked = true;
    } else {
        if (animateNo) animateNo.checked = true;
    }
    if (animate_bg) {
        if (animateBgYes) animateBgYes.checked = true;
    } else {
        if (animateBgNo) animateBgNo.checked = true;
    }
  };

  BrowserUserInterface.prototype.showOptions = function() {
      var save_element = document.getElementById('options');
      this.populateOptions();
      save_element.style.display = "block";
      var that = this;
      if (!save_element.onclick) {
          save_element.onclick = function(evt) {
              var target = evt.target;
              var save_element = document.getElementById('options');
              if (target == save_element) {
                  that.hideOptions();
              }
          };
      }
  };

  BrowserUserInterface.prototype.hideOptions = function() {
      var save_element = document.getElementById('options');
      save_element.style.display = "none";
  };

  // ------------------------------------------------------------------------
  // Additional methods

  BrowserUserInterface.prototype.getGameOverMsg = function() {
    return 'Game Over (reload to read again)';
  };

  BrowserUserInterface.prototype._registerEvents = function() {
    var that = this;
    
    // Event delegation for choice clicks
    this.contentElement.addEventListener('click', function(event) {
      var target = event.target;
      
      // Handle choice link clicks
      if (target.tagName === 'A' && target.closest('ul.choices')) {
        event.preventDefault();
        event.stopPropagation();
        var choice = parseInt(target.getAttribute('data-choice'));
        that.dendryEngine.choose(choice);
        return false;
      }
      
      // Handle choice list item clicks
      if (target.tagName === 'LI' && target.closest('ul.choices')) {
        event.preventDefault();
        event.stopPropagation();
        var link = target.querySelector('a');
        if (link) {
          link.click();
        }
        return false;
      }
    });
  };

  // ------------------------------------------------------------------------
  // Run when loaded.

  var main = function() {
    engine.convertJSONToGame(window.game.compiled, function(err, game) {
      if (err) {
        throw err;
      }

      var contentElement = document.getElementById('content');
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
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
