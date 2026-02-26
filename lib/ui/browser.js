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

  // Utility functions to replace jQuery functionality
  var $ = {
    // Create element
    create: function(tagName) {
      return document.createElement(tagName);
    },
    // Query selector
    query: function(selector, context) {
      context = context || document;
      return context.querySelector(selector);
    },
    // Query all
    queryAll: function(selector, context) {
      context = context || document;
      return context.querySelectorAll(selector);
    },
    // Add class
    addClass: function(element, className) {
      if (element && className) {
        element.classList.add(className);
      }
    },
    // Remove class
    removeClass: function(element, className) {
      if (element && className) {
        element.classList.remove(className);
      }
    },
    // Set CSS
    css: function(element, property, value) {
      if (element) {
        if (typeof property === 'object') {
          Object.keys(property).forEach(function(key) {
            element.style[key] = property[key];
          });
        } else {
          element.style[property] = value;
        }
      }
    },
    // Get CSS
    getCss: function(element, property) {
      if (element) {
        return window.getComputedStyle(element)[property];
      }
      return null;
    },
    // Simple fade in (using opacity)
    fadeIn: function(element, duration, callback) {
      if (!element) return;
      duration = duration || 300;
      element.style.opacity = '0';
      element.style.display = 'block';
      
      var start = performance.now();
      function animate(currentTime) {
        var elapsed = currentTime - start;
        var progress = Math.min(elapsed / duration, 1);
        element.style.opacity = progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if (callback) {
          callback();
        }
      }
      requestAnimationFrame(animate);
    },
    // Simple fade out
    fadeOut: function(element, duration, callback) {
      if (!element) return;
      duration = duration || 300;
      
      var start = performance.now();
      var startOpacity = parseFloat(element.style.opacity) || 1;
      
      function animate(currentTime) {
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
      }
      requestAnimationFrame(animate);
    },
    animate: function(element, properties, duration, callback) {
      if (!element) return;
      duration = duration || 300;
      
      var start = performance.now();
      var startValues = {};
      
      Object.keys(properties).forEach(function(prop) {
        if (prop === 'scrollTop') {
          startValues[prop] = element.scrollTop || 0;
        } else if (typeof element[prop] === 'number') {
          startValues[prop] = element[prop];
        } else {
          startValues[prop] = parseFloat(element.style[prop]) || 0;
        }
      });
      
      function animate(currentTime) {
        var elapsed = currentTime - start;
        var progress = Math.min(elapsed / duration, 1);
        
        Object.keys(properties).forEach(function(prop) {
          var startVal = startValues[prop];
          var endVal = parseFloat(properties[prop]);
          var currentVal = startVal + (endVal - startVal) * progress;
          
          if (prop === 'scrollTop') {
            element.scrollTop = currentVal;
          } else if (typeof element[prop] === 'number') {
            element[prop] = currentVal;
          } else {
            element.style[prop] = currentVal;
          }
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if (callback) {
          callback();
        }
      }
      requestAnimationFrame(animate);
    }
  };

  var BrowserUserInterface = function(game, content) {
    this.game = game;
    this.content = content;
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
    var tempDiv = $.create('div');
    tempDiv.innerHTML = htmlContent;
    
    // Move all child nodes to content
    while (tempDiv.firstChild) {
      var child = tempDiv.firstChild;
      if (this.animate) {
        $.fadeIn(child, this.fade_time);
      }
      this.content.appendChild(child);
    }
    
    // Focus on the content
    this.content.focus();
    
    // allow user to add custom stuff on display content (for sidebar in this case)
    if (window && window.onDisplayContent) {
        window.onDisplayContent();
    }
  };
  
  BrowserUserInterface.prototype.displayGameOver = function() {
    var p = $.create('p');
    p.textContent = this.getGameOverMsg();
    $.addClass(p, 'game-over');
    
    if (this.animate) {
        $.fadeIn(p, this.fade_time);
    }
    this.content.appendChild(p);
    p.focus();
  };
  
  BrowserUserInterface.prototype.displayChoices = function(choices) {
    var ul = $.create('ul');
    $.addClass(ul, 'choices');
    
    for (var i = 0; i < choices.length; ++i) {
      var choice = choices[i];

      var title = contentToHTML.convertLine(choice.title);
      var subtitle = "";
      if (choice.subtitle !== undefined) {
        subtitle = contentToHTML.convertLine(choice.subtitle);
      }

      var li = $.create('li');
      var titleHolder = li;
      
      if (choice.canChoose) {
        titleHolder = $.create('a');
        titleHolder.href = '#';
        titleHolder.setAttribute('data-choice', i);
        li.appendChild(titleHolder);
      } else {
        $.addClass(titleHolder, 'unavailable');
      }
      
      titleHolder.innerHTML = title;
      
      if (subtitle) {
        var subtitleDiv = $.create('div');
        $.addClass(subtitleDiv, 'subtitle');
        subtitleDiv.innerHTML = subtitle;
        li.appendChild(subtitleDiv);
      }
      
      ul.appendChild(li);
    }
    
    if (this.animate) {
        $.fadeIn(ul, this.fade_time);
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
        var children = Array.from(this.content.children);
        var self = this;
        var fadeCount = children.length;
        
        if (fadeCount === 0) {
          this.content.innerHTML = '';
        } else {
          children.forEach(function(child) {
            $.fadeOut(child, self.fade_time, function() {
              fadeCount--;
              if (fadeCount === 0) {
                self.content.innerHTML = '';
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
      $.addClass(this.content, style);
    }
  };
  
  BrowserUserInterface.prototype.removeChoices = function() {
    var choices = $.queryAll('.choices', this.content);
    choices.forEach(function(choice) {
      choice.remove();
    });
    var hidden = $.queryAll('.hidden', this.content);
    hidden.forEach(function(h) {
      h.remove();
    });
  };
  
  BrowserUserInterface.prototype.beginOutput = function() {
    var marker = $.query('#read-marker', this.content);
    if (marker) {
      marker.remove();
    }
    
    var hr = $.create('hr');
    hr.id = 'read-marker';
    this.content.appendChild(hr);
  };
  
  BrowserUserInterface.prototype.endOutput = function() {
    var marker = $.query('#read-marker');
    if (this.animate) {
        if (marker) {
          $.animate(document.documentElement, {scrollTop: marker.offsetTop}, this.fade_time);
          $.animate(document.body, {scrollTop: marker.offsetTop}, this.fade_time);
        } else {
          $.animate(document.documentElement, {scrollTop: 0}, this.fade_time);
          $.animate(document.body, {scrollTop: 0}, this.fade_time);
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
      var bg1 = $.query('#bg1');
      var bg2 = $.query('#bg2');
      
      if (this.disable_bg) {
            $.addClass(bg1, 'content_hidden');
            $.removeClass(bg1, 'content_visible');
            $.css(bg1, 'background-image', 'none'); 
      }
      else if (!image_url || image_url == 'none' || image_url == 'null') {
          if (this.animate_bg) {
            $.addClass(bg1, 'content_hidden');
            $.removeClass(bg1, 'content_visible');
            setTimeout(function() {
                $.css(bg1, 'background-image', 'none'); 
                $.removeClass(bg1, 'content_hidden');
                $.addClass(bg1, 'content_visible');
            }, 100);
          } else {
              $.css(bg1, 'background-image', 'none'); 
          }
      } else if (image_url.startsWith('#') || image_url.startsWith('rgba(') || image_url.startsWith('rgb(')) {
          if (this.animate_bg) {
            $.fadeOut(bg1, this.bg_fade_out_time, function() {
                $.css(bg1, 'background-image', 'none'); 
                $.css(bg1, 'background-color', image_url);
            });
            $.fadeIn(bg1, this.bg_fade_in_time, function() {
                $.css(bg2, 'background-image', 'none'); 
            });
            console.log('changing background color ' + image_url);
          } else {
              $.css(bg1, 'background-image', 'none'); 
              $.css(bg1, 'background-color', image_url);
          }
      } else if (image_url.startsWith('linear-gradient(')) {
          if (this.animate_bg) {
            $.fadeOut(bg1, this.bg_fade_out_time, function() {
                $.css(bg1, 'background-image', image_url); 
            });
            $.fadeIn(bg1, this.bg_fade_in_time, function() {
                $.css(bg2, 'background-image', image_url); 
            });
            console.log('changing background gradient ' + image_url);
          } else {
              $.css(bg1, 'background-image', image_url); 
          }
      } else {
          if (this.animate_bg) {
            $.fadeOut(bg1, this.bg_fade_out_time, function() {
                $.css(bg1, 'background-image', 'url("' + image_url + '")'); 
            });
            $.fadeIn(bg1, this.bg_fade_in_time, function() {
                $.css(bg2, 'background-image', $.getCss(bg1, 'background-image'));
            });
          } else {
              $.css(bg1, 'background-image', 'url("' + image_url + '")'); 
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
      if (!this.show_portraits || data == 'none' || data == 'clear') {
          var sprites = ['#topLeftSprite', '#topRightSprite', '#bottomLeftSprite', '#bottomRightSprite'];
          var self = this;
          sprites.forEach(function(spriteId) {
            var sprite = $.query(spriteId);
            if (sprite) {
              var children = Array.from(sprite.children);
              children.forEach(function(child) {
                $.fadeOut(child, self.fade_time, function() {
                  sprite.innerHTML = '';
                });
              });
            }
          });
          return;
      } else {
          if (data instanceof Array) {
              for (var i = 0; i < data.length; i++) {
                  var loc = data[i][0];
                  var img = data[i][1];
                  this.setSprite(loc, img);
              }
          } else if (data) {
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
          targetSprite = $.query('#topLeftSprite');
      } else if (loc == 'topright') {
          targetSprite = $.query('#topRightSprite');
      } else if (loc == 'bottomleft') {
          targetSprite = $.query('#bottomLeftSprite');
      } else if (loc == 'bottomright') {
          targetSprite = $.query('#bottomRightSprite');
      }
      
      if (!targetSprite) return;
      
      if (img == 'none' || img == 'clear') {
          delete this.dendryEngine.state.sprites[loc];
          $.fadeOut(targetSprite, this.fade_time, function() {
            targetSprite.innerHTML = '';
          });
          return;
      } else {
          this.dendryEngine.state.sprites[loc] = img;
          var self = this;
          $.fadeOut(targetSprite, this.fade_time, function() {
              targetSprite.innerHTML = '';
              var image = new Image();
              image.src = img;
              targetSprite.appendChild(image);
              console.log('fadeIn');
              $.fadeIn(targetSprite, self.fade_time);
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
          targetSprite = $.query('#topLeftSprite');
      } else if (loc == 'topright') {
          targetSprite = $.query('#topRightSprite');
      } else if (loc == 'bottomleft') {
          targetSprite = $.query('#bottomLeftSprite');
      } else if (loc == 'bottomright') {
          targetSprite = $.query('#bottomRightSprite');
      } else {
          return;
      }
      if (targetSprite) {
        $.css(targetSprite, style);
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
      var isLoop = audioData.includes('loop');
      var isQueue = audioData.includes('queue');
      var noFade = audioData.includes('nofade');
      var audioFile = audioData[0];
      var currentAudio = this.currentAudio;
      var fadeTime = this.sound_fade_time;
      var loopCurrent = false;
      
      if (audioFile == 'null' || audioFile == 'none') {
          if (this.currentAudio) {
              $.animate(currentAudio, {volume: 0}, this.sound_fade_time, function() {
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
                  this.currentAudio.onended = function() {
                      var newAudio = audioQueue.pop();
                      if (newAudio) {
                          currentAudio.src = newAudio;
                          console.log('playing from queue');
                          currentAudio.play();
                          $.animate(currentAudio, {volume: 1}, fadeTime);
                          window.dendryUI.currentAudioURL = newAudio;
                      }
                  };
              } else {
                  this.currentAudioURL = audioFile;
                  currentAudio.src = audioFile;
                  console.log('Fading in new audio');
                  currentAudio.volume = 0;
                  currentAudio.play();
                  $.animate(currentAudio, {volume: 1}, fadeTime);
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
                  $.animate(currentAudio, {volume: 0}, this.sound_fade_time, function() {
                      console.log(currentAudio);
                      currentAudio.src = audioFile;
                      console.log('Fading in new audio');
                      currentAudio.play();
                      $.animate(currentAudio, {volume: 1}, fadeTime);
                  });
              }
          } else {
              this.currentAudio = new Audio(audioFile);
              this.currentAudio.volume = 0;
              this.currentAudio.play();
              $.animate(this.currentAudio, {volume: 1}, this.sound_fade_time);
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
    
    var bgNo = $.query('#backgrounds_no');
    var bgYes = $.query('#backgrounds_yes');
    var animateYes = $.query('#animate_yes');
    var animateNo = $.query('#animate_no');
    var animateBgYes = $.query('#animate_bg_yes');
    var animateBgNo = $.query('#animate_bg_no');
    
    if (disable_bg) {
        if (bgNo) bgNo.checked = true;
    } else {
        if (bgYes) bgYes.checked = true;
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
      if (!save_element.onclick) {
          var self = this;
          save_element.onclick = function(evt) {
              var target = evt.target;
              var save_element = document.getElementById('options');
              if (target == save_element) {
                  self.hideOptions();
              }
          };
      }
  };

  BrowserUserInterface.prototype.hideOptions = function() {
      var save_element = document.getElementById('options');
      save_element.style.display = 'none';
  };

  // ------------------------------------------------------------------------
  // Additional methods

  BrowserUserInterface.prototype.getGameOverMsg = function() {
    return 'Game Over (reload to read again)';
  };

  BrowserUserInterface.prototype._registerEvents = function() {
    var that = this;
    
    // Event delegation for choice clicks
    this.content.addEventListener('click', function(event) {
      // Handle choice links
      if (event.target.matches('ul.choices li a')) {
        event.preventDefault();
        event.stopPropagation();
        var choice = parseInt(event.target.getAttribute('data-choice'));
        that.dendryEngine.choose(choice);
        return false;
      }
      
      // Handle choice list items
      if (event.target.matches('ul.choices li') || event.target.closest('ul.choices li')) {
        event.preventDefault();
        event.stopPropagation();
        var li = event.target.matches('ul.choices li') ? event.target : event.target.closest('ul.choices li');
        var link = li.querySelector('a');
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

      var ui = new BrowserUserInterface(game, $.query('#content'));
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

}());
