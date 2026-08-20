(function() {
  (function() {
    var savedTheme = localStorage.getItem('game-theme');
    var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0A1419' : '#F0F5F9');
    }
  }());

  var game;
  var ui;
  var currentTheme = 'light';
  var loadingIndicator = null;
  var pendingNewPageScrollToTop = false;

  var DateOptions = {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  var main = function(dendryUI) {
    ui = dendryUI;
    game = ui.game;

    dendryUI.getContinueTitle = function() {
      var lang = (document.documentElement && document.documentElement.lang) ? document.documentElement.lang : 'en';
      if (lang === 'de') {
        return 'Weiter…';
      }
      return 'Continue...';
    };

    // Initialize the interface
    initializeInterface();
    
    // Load saved theme
    loadTheme();
    
    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('game-theme')) {
          // Only auto-switch if user hasn't manually set a preference
          loadTheme();
        }
      });
    }
    
    // Initialize accessibility features
    initializeAccessibility();
    
    // Initialize touch gestures
    initializeTouchGestures();
  };

  function initializeInterface() {
    // Initialize sidebar toggles
    document.getElementById('progress-toggle').addEventListener('click', toggleProgressSidebar);
    document.getElementById('info-toggle').addEventListener('click', toggleInfoSidebar);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Initialize sidebar overlay
    var overlay = document.getElementById('sidebar-overlay');
    overlay.addEventListener('click', closeSidebars);

    // Handle window resize
    window.addEventListener('resize', handleResize);

    // Initialize keyboard navigation
    initializeKeyboardNavigation();

    // Handle initial responsive state
    handleResize();

    // Create loading indicator
    createLoadingIndicator();

    // Add scroll behavior for smooth chat scrolling
    var chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.style.scrollBehavior = 'smooth';
    }

    // Add choice selection feedback
    addChoiceSelectionFeedback();
  }

  function initializeAccessibility() {
    // Add ARIA landmarks
    setTimeout(function() {
      var chatMain = document.querySelector('.chat-main');
      if (chatMain) {
        chatMain.setAttribute('role', 'main');
        chatMain.setAttribute('aria-label', 'Game Content');
      }
      
      var progressSidebar = document.getElementById('progress-sidebar');
      if (progressSidebar) {
        progressSidebar.setAttribute('role', 'complementary');
        progressSidebar.setAttribute('aria-label', 'Game Progress');
      }
      
      var infoSidebar = document.getElementById('info-sidebar');
      if (infoSidebar) {
        infoSidebar.setAttribute('role', 'complementary');
        infoSidebar.setAttribute('aria-label', 'Game Information');
      }
      
      var header = document.querySelector('.top-header');
      if (header) {
        header.setAttribute('role', 'banner');
      }
      
      updateChoiceAccessibility();
    }, 500);
  }

  function createLoadingIndicator() {
    loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="loading-spinner"></div><span>Loading...</span>';
    document.body.appendChild(loadingIndicator);
  }

  function showLoadingIndicator() {
    if (loadingIndicator) {
      loadingIndicator.classList.add('active');
    }
  }

  function hideLoadingIndicator() {
    if (loadingIndicator) {
      loadingIndicator.classList.remove('active');
    }
  }

  function addChoiceSelectionFeedback() {
    // Add event delegation for choice clicks
    document.addEventListener('click', function(e) {
      var choiceItem = e.target.closest('ul.choices li');
      if (choiceItem && !choiceItem.classList.contains('unavailable')) {
        // Add selection feedback
        choiceItem.classList.add('selected');
        showLoadingIndicator();
        
        // Remove feedback after a short delay
        setTimeout(function() {
          choiceItem.classList.remove('selected');
        }, 200);
      }
    });
  }

  function initializeTouchGestures() {
    // Touch gesture variables
    var startX = 0;
    var startY = 0;
    var currentX = 0;
    var currentY = 0;
    var isSwiping = false;
    
    // Configuration
    var swipeThreshold = 50; // Minimum distance for a swipe
    var edgeThreshold = 30; // Distance from edge to trigger open gesture
    var velocityThreshold = 0.3; // Minimum velocity for gesture recognition
    var startTime = 0;
    
    // Only enable touch gestures on mobile devices
    function isMobileDevice() {
      return window.innerWidth <= 768 && 'ontouchstart' in window;
    }
    
    function handleTouchStart(e) {
      if (!isMobileDevice()) return;
      
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      currentY = startY;
      isSwiping = true;
      startTime = Date.now();
      
      // Prevent default only if starting near edges to avoid interfering with scrolling
      if (startX <= edgeThreshold || startX >= window.innerWidth - edgeThreshold) {
        e.preventDefault();
      }
    }
    
    function handleTouchMove(e) {
      if (!isSwiping || !isMobileDevice()) return;
      
      var touch = e.touches[0];
      currentX = touch.clientX;
      currentY = touch.clientY;
      
      var diffX = Math.abs(currentX - startX);
      var diffY = Math.abs(currentY - startY);
      
      // If horizontal movement is greater than vertical, prevent default scrolling
      if (diffX > diffY && diffX > 10) {
        e.preventDefault();
      }
    }
    
    function handleTouchEnd(e) {
      if (!isSwiping || !isMobileDevice()) return;
      
      var endTime = Date.now();
      var timeDiff = endTime - startTime;
      var diffX = currentX - startX;
      var diffY = currentY - startY;
      var absDiffX = Math.abs(diffX);
      var absDiffY = Math.abs(diffY);
      var velocity = absDiffX / timeDiff;
      
      // Reset swiping state
      isSwiping = false;
      
      // Check if this is a horizontal swipe (more horizontal than vertical movement)
      if (absDiffX > absDiffY && (absDiffX > swipeThreshold || velocity > velocityThreshold)) {
        var progressSidebar = document.getElementById('progress-sidebar');
        var infoSidebar = document.getElementById('info-sidebar');
        var isProgressOpen = progressSidebar.classList.contains('active');
        var isInfoOpen = infoSidebar.classList.contains('active');
        
        // Swipe right (positive diffX)
        if (diffX > 0) {
          // Open left sidebar if starting from left edge and no sidebar is open
          if (startX <= edgeThreshold && !isProgressOpen && !isInfoOpen) {
            toggleProgressSidebar();
            showNotification('Progress panel opened', 'info');
          }
          // Close right sidebar if it's open
          else if (isInfoOpen) {
            closeSidebars();
            showNotification('Info panel closed', 'info');
          }
        }
        // Swipe left (negative diffX)
        else if (diffX < 0) {
          // Open right sidebar if starting from right edge and no sidebar is open
          if (startX >= window.innerWidth - edgeThreshold && !isProgressOpen && !isInfoOpen) {
            toggleInfoSidebar();
            showNotification('Info panel opened', 'info');
          }
          // Close left sidebar if it's open
          else if (isProgressOpen) {
            closeSidebars();
            showNotification('Progress panel closed', 'info');
          }
        }
      }
    }
    
    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Clean up function (for potential future use)
    window.removeTouchGestures = function() {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }

  function initializeKeyboardNavigation() {
    // Add keyboard support for header buttons
    var headerButtons = document.querySelectorAll('.header-btn, .sidebar-header-btn, .sidebar-close');
    headerButtons.forEach(function(button) {
      button.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          button.click();
        }
      });
    });

    // Add escape key to close sidebars
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSidebars();
      }
    });
    
    // Add keyboard navigation for choices
    document.addEventListener('keydown', function(e) {
      var choices = document.querySelectorAll('ul.choices li:not(.unavailable)');
      if (choices.length === 0) return;
      
      var currentFocus = document.activeElement;
      var currentIndex = Array.from(choices).indexOf(currentFocus);
      
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var nextIndex;
        
        if (currentIndex === -1) {
          nextIndex = 0;
        } else if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % choices.length;
        } else {
          nextIndex = (currentIndex - 1 + choices.length) % choices.length;
        }
        
        choices[nextIndex].focus();
      }
    });
  }

  function updateChoiceAccessibility() {
    var choices = document.querySelectorAll('ul.choices li');
    choices.forEach(function(choice, index) {
      if (!choice.classList.contains('unavailable')) {
        choice.setAttribute('tabindex', '0');
        choice.setAttribute('role', 'button');
        choice.setAttribute('aria-label', 'Choice ' + (index + 1) + ': ' + choice.textContent.trim());
        
        // Add keyboard activation
        choice.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choice.click();
          }
        });
      } else {
        choice.setAttribute('tabindex', '-1');
        choice.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function handleResize() {
    var isMobile = window.innerWidth <= 768;
    var progressSidebar = document.getElementById('progress-sidebar');
    var infoSidebar = document.getElementById('info-sidebar');
    
    if (isMobile) {
      // On mobile, sidebars are hidden by default
      progressSidebar.classList.remove('active');
      infoSidebar.classList.remove('active');
      closeSidebars();
    } else {
      // On desktop, show sidebars by default
      progressSidebar.classList.remove('hidden');
      infoSidebar.classList.remove('hidden');
      closeSidebars();
    }
  }

  function toggleProgressSidebar() {
    var sidebar = document.getElementById('progress-sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var chatMain = document.querySelector('.chat-main');
    var isMobile = window.innerWidth <= 768;

    if (isMobile) {
      var isActive = sidebar.classList.contains('active');
      closeSidebars(); // Close any open sidebars first

      if (!isActive) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        overlay.classList.add('left-open');
      }
    } else {
      sidebar.classList.toggle('hidden');
      if (sidebar.classList.contains('hidden')) {
        chatMain.classList.add('sidebar-left-hidden');
      } else {
        chatMain.classList.remove('sidebar-left-hidden');
      }
    }
  }

  function toggleInfoSidebar() {
    var sidebar = document.getElementById('info-sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var chatMain = document.querySelector('.chat-main');
    var isMobile = window.innerWidth <= 768;

    if (isMobile) {
      var isActive = sidebar.classList.contains('active');
      closeSidebars(); // Close any open sidebars first

      if (!isActive) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        overlay.classList.add('right-open');
      }
    } else {
      sidebar.classList.toggle('hidden');
      if (sidebar.classList.contains('hidden')) {
        chatMain.classList.add('sidebar-right-hidden');
      } else {
        chatMain.classList.remove('sidebar-right-hidden');
      }
    }
  }

  function closeSidebars() {
    var progressSidebar = document.getElementById('progress-sidebar');
    var infoSidebar = document.getElementById('info-sidebar');
    var overlay = document.getElementById('sidebar-overlay');

    progressSidebar.classList.remove('active');
    infoSidebar.classList.remove('active');
    overlay.classList.remove('active', 'left-open', 'right-open');
  }

  function toggleTheme() {
    var body = document.body;
    
    // Add smooth transition class
    body.style.transition = 'background 0.3s ease, color 0.3s ease';
    
    if (currentTheme === 'light') {
      setTheme('dark', true);
    } else {
      setTheme('light', true);
    }
    
    // Remove transition after animation
    setTimeout(() => {
      body.style.transition = '';
    }, 300);
  }

  function loadTheme() {
    // Check for saved theme preference or default to system preference
    var savedTheme = localStorage.getItem('game-theme');
    var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    setTheme(theme, false);
  }

  function updateThemeColorMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'dark' ? '#0A1419' : '#F0F5F9');
  }

  function setTheme(theme, persist) {
    var body = document.body;
    var root = document.documentElement;
    var themeButton = document.getElementById('theme-toggle');
    var isDark = theme === 'dark';

    body.classList.toggle('theme-dark', isDark);
    body.classList.toggle('theme-light', !isDark);
    root.classList.toggle('theme-dark', isDark);
    root.classList.toggle('theme-light', !isDark);

    updateThemeIcon(themeButton, isDark ? 'sun' : 'moon');
    currentTheme = isDark ? 'dark' : 'light';

    if (persist) {
      localStorage.setItem('game-theme', currentTheme);
    }

    updateThemeColorMeta(currentTheme);
  }

  // Production-ready icon update function
  function updateThemeIcon(button, iconName) {
    if (!button) return;
    
    // Clear all existing content and create new icon element
    button.innerHTML = '';
    var newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', iconName);
    button.appendChild(newIcon);
    
    // Initialize the new icon
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function escapeHTMLAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizeChatImagePath(value) {
    return String(value || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^assets\/imgs\/+/i, '')
      .replace(/^\/+/, '')
      .split('/')
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');
  }

  window.displayParagraphHTML = function(html) {
    const mapping = {
      'Me: ':          'me',
      'Facilyn: ':     'cfa',
      'Rane: ':        'cra',
      'Aquira: ':      'caq',
      'Vendor: ':      'cve',
      'Stranger: ':    'cst',
      'Drawer: ':      'cdr',
      'RoboDisplay: ': 'crd',
      'RoboVoice: ':   'crv',
      'Headline1: ':   'ch1',
      'Headline2: ':   'ch2',
      'Paper: ':       'cpa',
      'Image: ':       'img'
    };

    const profileImages = {
      'cfa': 'assets/pics/profile-facilyn.webp',
      'cra': 'assets/pics/profile-vendor.webp',
      'caq': 'assets/pics/profile-facilyn.webp',
      'cve': 'assets/pics/profile-vendor.webp'
    };

    const characterNames = {
      'cfa': 'Facilyn',
      'cra': 'Rane',
      'caq': 'Aquira',
      'cve': 'Vendor',
      'cst': 'Stranger',
      'cdr': 'Drawer',
      'ch1': 'Headline1',
      'ch2': 'Headline2',
      'crd': 'Robo Display',
      'crv': 'Robo Voice',
      'chi': 'Hint',
      'cpa': 'Paper',
      'cis': 'Info Sign',
      'cds': 'Danger Sign',
      'cws': 'Warning Sign',
      'can': 'Announcement'
    };

    for (const prefix in mapping) {
      if (html.startsWith(prefix)) {
        const cls = mapping[prefix];
        const content = html.slice(prefix.length);

        if (cls === 'me') {
          return `
            <div class="chat-line me">
              <div class="bubble me">${content}</div>
              <span class="profile me">Me</span>
            </div>
          `;
        } else if (cls === 'cpa') {
          return `
            <div class="chat-line paper">
              <div class="bubble cpa">${content}</div>
            </div>
          `;
        } else if (cls === 'img') {
          const imagePath = normalizeChatImagePath(content);

          if (!imagePath) {
            return '';
          }

          const imageSrc = encodeURI(`assets/imgs/${imagePath}`);
          const imageSrcAttribute = escapeHTMLAttribute(imageSrc);

          return `
            <div class="chat-line image">
              <div class="chat-image">
                <img src="${imageSrcAttribute}" alt="" loading="lazy" decoding="async" />
              </div>
            </div>
          `;
        } else if (
          cls === 'cis' || cls === 'cds' || cls === 'cws' ||
          cls === 'can' || cls === 'crv' || cls === 'crd' ||
          cls === 'chi'
        ) {
          return `
            <div class="chat-line elements">
              <div class="bubble ${cls}">${content}</div>
            </div>
          `;
        } else if (cls === 'ch1' || cls === 'ch2') {
          return `
            <div class="chat-line headline">
              <div class="bubble ${cls}">${content}</div>
            </div>
          `;
        } else {
          const profileImg = profileImages[cls];
          const characterName = characterNames[cls];
          return `
            <div class="chat-line">
              <span class="profile ${cls}">
                <img src="${profileImg}" alt="${characterName}" />
              </span>
              <div class="bubble ${cls}">
                <div class="bubble-sender-name ${cls}">${characterName}</div>
                ${content}
              </div>
            </div>
          `;
        }
      }
    }

    return `<p>${html}</p>`;
  };

  // This function allows you to do something in response to signals.
  window.handleSignal = function(signal, event, scene_id) {
  };

  function forceChatScrollTop(chatContainer) {
    if (!chatContainer) return;

    var previousScrollBehavior = chatContainer.style.scrollBehavior;
    chatContainer.style.scrollBehavior = 'auto';
    chatContainer.scrollTop = 0;

    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    setTimeout(function() {
      chatContainer.scrollTop = 0;
      chatContainer.style.scrollBehavior = previousScrollBehavior;
    }, 0);
  }
  
  // This function runs on a new page. Right now, this auto-saves.
  window.onNewPage = function() {
    pendingNewPageScrollToTop = true;

    // Scroll immediately so new pages do not visibly jump after the delayed content update.
    forceChatScrollTop(document.getElementById('chat-container'));

    var scene = window.dendryUI.dendryEngine.state.sceneId;
    if (scene != 'root') {
        window.autosave();
    }
  };
    
  // This function updates the game left sidebar (progress).
  window.updateProgressSidebar = function() {
      var progressElement = document.getElementById('progress');
      if (progressElement) {
          progressElement.innerHTML = '';
          var scene = dendryUI.game.scenes.progress;
          var displayContent = dendryUI.dendryEngine._makeDisplayContent(scene.content, true);
          progressElement.innerHTML = dendryUI.contentToHTML.convert(displayContent);
      }
  };

  // This function updates the game right sidebar (info).
  window.updateInfoSidebar = function() {
      var infoElement = document.getElementById('info');
      if (infoElement) {
          infoElement.innerHTML = '';
          var scene = dendryUI.game.scenes.info;
          var displayContent = dendryUI.dendryEngine._makeDisplayContent(scene.content, true);
          infoElement.innerHTML = dendryUI.contentToHTML.convert(displayContent);
      }
  };

  function enhanceReadMarker() {
    var markers = document.querySelectorAll('#read-marker');
    if (!markers || markers.length === 0) return;
    markers.forEach(function(rm) {
      if (rm.dataset && rm.dataset.enhanced === '1') return;
      rm.setAttribute('role', 'separator');
      rm.innerHTML = '';
      rm.dataset.enhanced = '1';
    });
  }
  
  // This function runs on every new content display. Currently, all it does is update the sidebars.
  window.onDisplayContent = function() {
      window.updateProgressSidebar();
      window.updateInfoSidebar();
      
      // Hide loading indicator
      hideLoadingIndicator();
      
      // Update choice accessibility
      setTimeout(function() {
        updateChoiceAccessibility();
      }, 100);
      
      setTimeout(function() {
        var chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;

        if (pendingNewPageScrollToTop) {
          // The new-page scroll already ran in onNewPage(); just suppress the default scroll-to-bottom here.
          pendingNewPageScrollToTop = false;
          return;
        }

        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
      
      // Announce new content to screen readers
      var newContent = document.getElementById('content');
      if (newContent) {
        newContent.setAttribute('aria-live', 'polite');
      }

      enhanceReadMarker();
  };

  // TODO: change this!
  var TITLE = "Manage Complexity" + '_' + "manage-complexity";

  window.quickSave = function() {
      var saveString = JSON.stringify(window.dendryUI.dendryEngine.getExportableState());
      localStorage[TITLE+'_save_q'] = saveString;
      window.alert("Saved.");
  };

  window.saveSlot = function(slot) {
      var saveString = JSON.stringify(window.dendryUI.dendryEngine.getExportableState());
      localStorage[TITLE+'_save_' + slot] = saveString;
      var scene = window.dendryUI.dendryEngine.state.sceneId;
      var date = new Date(Date.now());
      date = scene + '\n(' + date.toLocaleString(undefined, DateOptions) + ')';
      localStorage[TITLE+'_save_timestamp_' + slot] = date;
      window.populateSaveSlots(8, 2);
      showNotification("Game saved successfully", "success");
  };
  
  // writes an autosave slot
  window.autosave = function() {
      showLoadingIndicator();
      var oldData = localStorage[TITLE+'_save_' + 'a0'];
      if (oldData) {
          localStorage[TITLE+'_save_'+'a1'] = oldData;
          localStorage[TITLE+'_save_timestamp_'+'a1'] = localStorage[TITLE+'_save_timestamp_'+'a0'];
      }
      var slot = 'a0';
      var saveString = JSON.stringify(window.dendryUI.dendryEngine.getExportableState());
      localStorage[TITLE+'_save_' + slot] = saveString;
      var scene = window.dendryUI.dendryEngine.state.sceneId;
      var date = new Date(Date.now());
      date = scene + '\n(' + date.toLocaleString(undefined, DateOptions) + ')';
      localStorage[TITLE+'_save_timestamp_' + slot] = date;
      window.populateSaveSlots(8, 2);
      hideLoadingIndicator();
  };

  window.quickLoad = function() {
      if (localStorage[TITLE+'_save_q']) {
          var saveString = localStorage[TITLE+'_save_q'];
          window.dendryUI.dendryEngine.setState(JSON.parse(saveString));
          window.alert("Loaded.");
      } else {
          window.alert("No save available.");
      }
  };

  window.loadSlot = function(slot) {
      if (localStorage[TITLE+'_save_' + slot]) {
          showLoadingIndicator();
          var saveString = localStorage[TITLE+'_save_' + slot];
          window.dendryUI.dendryEngine.setState(JSON.parse(saveString));
          window.hideSaveSlots();
          hideLoadingIndicator();
          // Show a subtle notification instead of alert
          showNotification("Game loaded successfully", "success");
      } else {
          showNotification("No save available", "error");
      }
  };

  window.deleteSlot = function(slot) {
      if (localStorage[TITLE+'_save_' + slot]) {
          localStorage[TITLE+'_save_' + slot] = '';
          localStorage[TITLE+'_save_timestamp_' + slot] = '';
          window.populateSaveSlots(8, 2);
          showNotification("Save deleted", "info");
      } else {
          showNotification("No save available", "error");
      }
  };

  window.exportSlot = function(slot) {
      var saveData = localStorage[TITLE + '_save_' + slot];
      if (!saveData) {
          showNotification("No save available", "error");
          return;
      }

      var link = document.createElement('a');
      var file = new Blob([saveData], { type: 'application/json' });
      var objectUrl = URL.createObjectURL(file);

      link.href = objectUrl;
      link.download = 'manage-complexity-save-' + slot + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
      showNotification("Save exported", "success");
  };

  window.importSave = function(inputId) {
      var uploader = document.getElementById(inputId);
      if (!uploader || !uploader.files || uploader.files.length === 0) {
          showNotification("No file selected", "error");
          return;
      }

      var file = uploader.files[0];
      var reader = new FileReader();

      reader.onload = function(event) {
          try {
              var data = JSON.parse(event.target.result);
              showLoadingIndicator();
              window.dendryUI.dendryEngine.setState(data);
              window.hideSaveSlots();
              hideLoadingIndicator();
              showNotification("Save imported successfully", "success");
          } catch (error) {
              hideLoadingIndicator();
              showNotification("Invalid save file", "error");
          } finally {
              uploader.value = '';
          }
      };

      reader.onerror = function() {
          hideLoadingIndicator();
          uploader.value = '';
          showNotification("Could not read save file", "error");
      };

      showLoadingIndicator();
      reader.readAsText(file);
  };

  // Enhanced notification system
  function showNotification(message, type) {
    type = type || 'info';
    var notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    
    // Add ARIA attributes for screen readers
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    if (type === 'error') {
      notification.setAttribute('aria-live', 'assertive');
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(function() {
      notification.classList.add('show');
    }, 10);
    
    // Animate out and remove
    setTimeout(function() {
      notification.classList.remove('show');
      setTimeout(function() {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, type === 'error' ? 5000 : 3000); // Show errors longer
  }
  
  // Expose showNotification globally for use in other parts of the game
  window.showNotification = showNotification;
  
  // Expose closeSidebars globally for sidebar close buttons
  window.closeSidebars = closeSidebars;
  
  window.populateSaveSlots = function(max_slots, max_auto_slots) {
      // this fills in the save information
      function createLoadListener(i) {
          return function(evt) {
                evt.target.style.transform = 'scale(0.95)';
                setTimeout(function() {
                  evt.target.style.transform = 'scale(1)';
                }, 150);
                window.loadSlot(i);
          };
      }
      function createSaveListener(i) {
          return function(evt) {
                evt.target.style.transform = 'scale(0.95)';
                setTimeout(function() {
                  evt.target.style.transform = 'scale(1)';
                }, 150);
                window.saveSlot(i);
          };
      }
      function createDeleteListener(i) {
          return function(evt) {
                evt.target.style.transform = 'scale(0.95)';
                setTimeout(function() {
                  evt.target.style.transform = 'scale(1)';
                }, 150);
                window.deleteSlot(i);
          };
      }
      function createExportListener(i) {
          return function(evt) {
                evt.target.style.transform = 'scale(0.95)';
                setTimeout(function() {
                  evt.target.style.transform = 'scale(1)';
                }, 150);
                window.exportSlot(i);
          };
      }
      function populateSlot(id) {
          var save_element = document.getElementById('save_info_' + id);
          var save_button = document.getElementById('save_button_' + id);
          var delete_button = document.getElementById('delete_button_' + id);
          var export_button = document.getElementById('export_button_' + id);
          if (localStorage[TITLE+'_save_' + id]) {
              var timestamp = localStorage[TITLE+'_save_timestamp_' + id];
              save_element.textContent = timestamp;
              save_button.textContent = "Load";
              save_button.onclick = createLoadListener(id);
              delete_button.onclick = createDeleteListener(id);
              if (export_button) {
                  export_button.disabled = false;
                  export_button.onclick = createExportListener(id);
              }
          } else {
              save_button.textContent = "Save";
              save_element.textContent = "Empty";
              save_button.onclick = createSaveListener(id);
              if (export_button) {
                  export_button.disabled = true;
                  export_button.onclick = null;
              }
          }

      }
      for (var i = 0; i < max_slots; i++) {
          populateSlot(i);
      }
      for (i = 0; i < max_auto_slots; i++) {
          populateSlot('a'+i);
      }
  };

  window.showSaveSlots = function() {
      var save_element = document.getElementById('save');
      save_element.style.display = "flex";
      // magic number lol
      window.populateSaveSlots(8, 2);
      if (!save_element.onclick) {
          save_element.onclick = function(evt) {
              var target = evt.target;
              var save_element = document.getElementById('save');
              if (target == save_element) {
                  window.hideSaveSlots();
              }
          };
      }
  };

  window.hideSaveSlots = function() {
      var save_element = document.getElementById('save');
      save_element.style.display = "none";
  };

  window.dendryModifyUI = main;
  console.log("Modifying stats: see dendryUI.dendryEngine.state.qualities");

  window.onload = function() {
    window.dendryUI.loadSettings();
    initializeAccessibility();
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  };

}());
