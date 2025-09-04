(function() {
  var game;
  var ui;
  var currentTheme = 'light';
  var loadingIndicator = null;

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

    // Initialize the interface
    initializeInterface();
    
    // Load saved theme
    loadTheme();
    
    // Initialize scroll effects
    initializeScrollEffects();
  };

  function initializeInterface() {
    // Initialize sidebar toggles
    document.getElementById('progress-toggle').addEventListener('click', toggleProgressSidebar);
    document.getElementById('info-toggle').addEventListener('click', toggleInfoSidebar);
    document.getElementById('sidebar-theme-toggle').addEventListener('click', toggleTheme);

    // Initialize sidebar overlay
    var overlay = document.getElementById('sidebar-overlay');
    overlay.addEventListener('click', closeSidebars);

    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    // Initialize keyboard navigation
    initializeKeyboardNavigation();
    
    // Initialize touch gestures for mobile
    initializeTouchGestures();
    
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
    
    // Wrap choices in container for max-width
    wrapChoicesContainer();
  }
  
  function wrapChoicesContainer() {
    var choicesContainer = document.querySelector('.choices-container');
    if (choicesContainer) {
      var wrapper = document.createElement('div');
      wrapper.className = 'choices-wrapper';
      
      // Move all children to wrapper
      while (choicesContainer.firstChild) {
        wrapper.appendChild(choicesContainer.firstChild);
      }
      
      choicesContainer.appendChild(wrapper);
    }
  }
  
  function initializeScrollEffects() {
    var header = document.querySelector('.sticky-header');
    var lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      if (scrollTop > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      
      lastScrollTop = scrollTop;
    }, { passive: true });
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

  function initializeKeyboardNavigation() {
    // Add keyboard support for header buttons
    var headerButtons = document.querySelectorAll('.header-btn');
    headerButtons.forEach(function(button) {
      button.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          button.click();
        }
      });
      
      // ARIA labels are already defined in HTML
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
    
    // Make choices focusable
    document.addEventListener('DOMContentLoaded', function() {
      updateChoiceAccessibility();
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

  function initializeTouchGestures() {
    var startX = 0;
    var startY = 0;
    var currentX = 0;
    var currentY = 0;
    var isDragging = false;
    var activeElement = null;
    
    function handleTouchStart(e) {
      if (window.innerWidth > 768) return; // Only on mobile
      
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      currentY = startY;
      
      // Check if touch started on a sidebar
      var progressSidebar = document.getElementById('progress-sidebar');
      var infoSidebar = document.getElementById('info-sidebar');
      
      if (progressSidebar.classList.contains('active') && startX < 260) {
        activeElement = progressSidebar;
        isDragging = true;
      } else if (infoSidebar.classList.contains('active') && startX > window.innerWidth - 260) {
        activeElement = infoSidebar;
        isDragging = true;
      }
    }
    
    function handleTouchMove(e) {
      if (!isDragging || !activeElement) return;
      
      e.preventDefault();
      var touch = e.touches[0];
      currentX = touch.clientX;
      currentY = touch.clientY;
      
      var deltaX = currentX - startX;
      var deltaY = Math.abs(currentY - startY);
      
      // Only process horizontal swipes
      if (deltaY > 50) {
        isDragging = false;
        return;
      }
      
      // Apply transform based on swipe direction
      if (activeElement.id === 'progress-sidebar' && deltaX < -50) {
        activeElement.style.transform = 'translateX(' + Math.min(0, deltaX) + 'px)';
      } else if (activeElement.id === 'info-sidebar' && deltaX > 50) {
        activeElement.style.transform = 'translateX(' + Math.max(0, deltaX) + 'px)';
      }
    }
    
    function handleTouchEnd(e) {
      if (!isDragging || !activeElement) return;
      
      var deltaX = currentX - startX;
      var threshold = 100;
      
      // Reset transform
      activeElement.style.transform = '';
      
      // Close sidebar if swiped far enough
      if ((activeElement.id === 'progress-sidebar' && deltaX < -threshold) ||
          (activeElement.id === 'info-sidebar' && deltaX > threshold)) {
        closeSidebars();
      }
      
      isDragging = false;
      activeElement = null;
    }
    
    // Add touch event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
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
    overlay.classList.remove('active');
  }

  function toggleTheme() {
    var body = document.body;
    var sidebarThemeIcon = document.querySelector('#sidebar-theme-toggle span');
    
    if (body.classList.contains('theme-light')) {
      body.classList.remove('theme-light');
      body.classList.add('theme-dark');
      if (sidebarThemeIcon) {
        sidebarThemeIcon.setAttribute('uk-icon', 'icon: bolt');
      }
      currentTheme = 'dark';
    } else {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      if (sidebarThemeIcon) {
        sidebarThemeIcon.setAttribute('uk-icon', 'icon: star');
      }
      currentTheme = 'light';
    }
    
    // Save theme preference
    localStorage.setItem('game-theme', currentTheme);
  }

  function loadTheme() {
    var savedTheme = localStorage.getItem('game-theme') || 'light';
    var body = document.body;
    var sidebarThemeIconElement = document.querySelector('#sidebar-theme-toggle span');
    
    if (savedTheme === 'dark') {
      body.classList.remove('theme-light');
      body.classList.add('theme-dark');
      if (sidebarThemeIconElement) {
        sidebarThemeIconElement.setAttribute('uk-icon', 'icon: bolt');
      }
      currentTheme = 'dark';
    } else {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      if (sidebarThemeIconElement) {
        sidebarThemeIconElement.setAttribute('uk-icon', 'icon: star');
      }
      currentTheme = 'light';
    }
  }

  // This function allows you to modify the text before it's displayed.
  // E.g. wrapping chat-like messages in spans.
  window.displayText = function(text) {
    const mapping = {
      'Me: ':          'me',
      'Facilitator: ': 'cfa',
      'Librarian: ':   'cli',
      'Archivist: ':   'car',
      'Scholar: ':     'csc',
      'Historian: ':   'chi',
      'Curator: ':     'ccu',
      'Narration: ':   'na'
    };

    // Character profile images from Unsplash
    const profileImages = {
      'cfa': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      'cli': 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
      'car': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      'csc': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      'chi': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      'ccu': 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop&crop=face'
    };

    // Character full names for bubble headers
    const characterNames = {
      'cfa': 'Facilitator',
      'cli': 'Librarian',
      'car': 'Archivist',
      'csc': 'Scholar',
      'chi': 'Historian',
      'ccu': 'Curator'
    };

    for (const prefix in mapping) {
      if (text.startsWith(prefix)) {
        const cls = mapping[prefix];
        const content = text.slice(prefix.length);

        if (cls === 'na') {
          // Narration – centered, with .na
          return `
            <div class="chat-line narration">
              <div class="bubble na">${content}</div>
            </div>`;
        }
        else if (cls === 'me') {
          // Me – right, profileabbrevation right
          return `
            <div class="chat-line me">
              <div class="bubble me">${content}</div>
              <span class="profile me">Me</span>
            </div>`;
        }
        else {
          // Other characters – profile image left, name in bubble
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
            </div>`;
        }
      }
    }

    // No known prefix → just text
    return text;
  };

  // This function allows you to do something in response to signals.
  window.handleSignal = function(signal, event, scene_id) {
  };
  
  // This function runs on a new page. Right now, this auto-saves.
  window.onNewPage = function() {
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
      
      // Add smooth scroll to bottom after content update
      setTimeout(function() {
        var chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
      
      // Announce new content to screen readers
      var newContent = document.getElementById('content');
      if (newContent) {
        newContent.setAttribute('aria-live', 'polite');
      }
  };

  // TODO: change this!
  var TITLE = "TestStory" + '_' + "storyde";

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
      function populateSlot(id) {
          var save_element = document.getElementById('save_info_' + id);
          var save_button = document.getElementById('save_button_' + id);
          var delete_button = document.getElementById('delete_button_' + id);
          if (localStorage[TITLE+'_save_' + id]) {
              var timestamp = localStorage[TITLE+'_save_timestamp_' + id];
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
    
    // Initialize accessibility features
    setTimeout(function() {
      updateChoiceAccessibility();
      
      // Add ARIA landmarks
      var chatMain = document.querySelector('.chat-main');
      if (chatMain) {
        chatMain.setAttribute('role', 'main');
        chatMain.setAttribute('aria-label', 'Game Content');
      }
      
      var progressSidebar = document.getElementById('progress-sidebar');
      if (progressSidebar) {
        progressSidebar.setAttribute('role', 'complementary');
        progressSidebar.setAttribute('aria-label', 'Game Status');
      }
      
      var contextSidebar = document.getElementById('context-sidebar');
      if (contextSidebar) {
        contextSidebar.setAttribute('role', 'complementary');
        contextSidebar.setAttribute('aria-label', 'Game Context');
      }
      
      var header = document.querySelector('.sticky-header');
      if (header) {
        header.setAttribute('role', 'banner');
      }
    }, 500);
  };

}());