/**
 * Reddit Privacy & Posting Safety Extension
 * Main Content Script Entry Point
 */

(async function initRedditSafetyExtension() {
  Logger.log('Initializing Reddit Safety Extension content script...');

  // Fetch initial stored settings
  let currentSettings = await StorageManager.getSettings();
  document.documentElement.dataset.rsAutoReveal = currentSettings.autoRevealNative ? 'true' : 'false';

  // Run initial scan & checks
  function runScan() {
    if (typeof FilterManager !== 'undefined') FilterManager.scanAndApply(currentSettings);
    BlurManager.scanAndApply(currentSettings);
    PostChecker.init(currentSettings);
    PostChecker.checkStealthRemoval();
    
    if (currentSettings.blockPostCreation) {
      document.documentElement.classList.add('rs-block-post-creation');
    } else {
      document.documentElement.classList.remove('rs-block-post-creation');
    }

    if (currentSettings.scrollingOnlyMode) {
      document.documentElement.classList.add('rs-scrolling-only');
      
      // Aggressive JS Fallback (Pierces shadow DOM and overrides inline styles)
      const actionRows = [
        ...document.querySelectorAll('[data-testid="action-row"], shreddit-post-action-row, button[data-action-bar-action], .rpl-vote-button-group')
      ];
      // Also check inside shreddit-post shadow roots
      document.querySelectorAll('shreddit-post').forEach(post => {
        if (post.shadowRoot) {
          actionRows.push(...post.shadowRoot.querySelectorAll('[data-testid="action-row"], shreddit-post-action-row, button[data-action-bar-action], .rpl-vote-button-group'));
        }
      });
      actionRows.forEach(row => {
        if (row && row.style) {
          row.style.setProperty('display', 'none', 'important');
        }
      });
      
    } else {
      document.documentElement.classList.remove('rs-scrolling-only');
      
      // Restore JS hidden elements
      const actionRows = [
        ...document.querySelectorAll('[data-testid="action-row"], shreddit-post-action-row, button[data-action-bar-action], .rpl-vote-button-group')
      ];
      document.querySelectorAll('shreddit-post').forEach(post => {
        if (post.shadowRoot) {
          actionRows.push(...post.shadowRoot.querySelectorAll('[data-testid="action-row"], shreddit-post-action-row, button[data-action-bar-action], .rpl-vote-button-group'));
        }
      });
      actionRows.forEach(row => {
        if (row && row.style && row.style.display === 'none') {
          row.style.removeProperty('display');
        }
      });
    }

    // Aggressive JS Fallback for "Create Post" buttons (Subreddit headers, shadow doms, dynamic faceplates)
    const createPostEls = [
      ...document.querySelectorAll('a[href*="/submit"], faceplate-tracker[noun="create_post"], faceplate-tracker[noun="create_post_button"], shreddit-sidebar-create-post-button')
    ];
    // Pierce shadow dom of shreddit-subreddit-header which houses the subreddit Create Post button
    document.querySelectorAll('shreddit-subreddit-header').forEach(header => {
      if (header.shadowRoot) {
        createPostEls.push(...header.shadowRoot.querySelectorAll('a[href*="/submit"], faceplate-tracker[noun="create_post"], button'));
      }
    });

    // Also look inside all collected potential elements for the exact text 'Create Post'
    [...document.querySelectorAll('button, a, span, div, faceplate-tracker'), ...createPostEls].forEach(el => {
      if (el && el.innerText && el.innerText.trim().toLowerCase() === 'create post') {
        const target = el.closest('button, a, faceplate-tracker') || el;
        if (!createPostEls.includes(target)) createPostEls.push(target);
      }
    });

    if (currentSettings.blockPostCreation || currentSettings.scrollingOnlyMode) {
      createPostEls.forEach(el => {
        if (el && el.style) {
          el.style.setProperty('display', 'none', 'important');
        }
      });
    } else {
      createPostEls.forEach(el => {
        if (el && el.style && el.style.display === 'none') {
          el.style.removeProperty('display');
        }
      });
    }
  }

  // Shadowban check routine (runs once per 24 hours per session)
  async function performShadowbanCheck(settings) {
    const username = settings.lastDetectedUser?.username || settings.manualUsername;
    if (!username) return;

    // Throttle checks to once every 24 hours
    const SHADOWBAN_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
    if (Date.now() - (settings.lastShadowbanCheck || 0) < SHADOWBAN_CHECK_INTERVAL) return;

    Logger.log('Performing background shadowban check...');
    try {
      const response = await browserAPI.runtime.sendMessage({
        action: 'CHECK_SHADOWBAN',
        username: username
      });
      
      if (response && response.success) {
        await StorageManager.updateSettings({
          isShadowbanned: !!response.isShadowbanned,
          lastShadowbanCheck: Date.now()
        });
        Logger.log('Shadowban check complete. Status:', response.isShadowbanned ? 'SHADOWBANNED' : 'Normal');
      }
    } catch (e) {
      Logger.log('Shadowban check failed:', e);
    }
  }

  runScan();
  performShadowbanCheck(currentSettings);

  // Debounced MutationObserver for dynamic infinite scroll / SPA updates
  let observerTimer = null;
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }

    if (shouldScan) {
      if (observerTimer) clearTimeout(observerTimer);
      observerTimer = setTimeout(() => {
        runScan();
      }, 250);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Listen for user menu interactions to auto-detect username dynamically and re-attach guides
  document.addEventListener('click', () => {
    setTimeout(async () => {
      const settings = await StorageManager.getSettings();
      if (!settings.lastDetectedUser || settings.lastDetectedUser.accountAgeDays === null) {
        const username = RedditDetector.detectLoggedInUsername();
        if (username) {
          Logger.log(`Captured username after interaction: u/${username}`);
          await RedditDetector.fetchUserAccountInfo(settings);
        }
      }
      
      // Always re-attach guides in case a React render destroyed them (e.g. clicking composer)
      if (typeof PostChecker !== 'undefined') {
        PostChecker.attachInlineGuides();
      }
    }, 150);
  }, { capture: true, passive: true });

  // Listen for storage changes or popup messages
  browserAPI.storage.onChanged.addListener(async () => {
    currentSettings = await StorageManager.getSettings();
    document.documentElement.dataset.rsAutoReveal = currentSettings.autoRevealNative ? 'true' : 'false';
    PostChecker.updateSettings(currentSettings);
    runScan();
  });

  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'IFRAME_SHADOWBAN_CHECK') {
      (async () => {
        try {
          const res = await fetch('https://www.reddit.com/appeal');
          
          if (res.url.includes('login')) {
            sendResponse({ success: false, error: 'Not logged in' });
            return;
          }

          const text = await res.text();
          const textLower = text.toLowerCase();
          
          // Check both the human-readable text (if SSR) and the embedded JSON state (if SPA)
          const isNormal = textLower.includes('neither suspended nor restricted') || 
                           textLower.includes('cannot submit an appeal') ||
                           textLower.includes('in good standing') ||
                           textLower.includes('"is_suspended":false') ||
                           textLower.includes('"issuspended":false');
                           
          sendResponse({ success: true, isShadowbanned: !isNormal });
        } catch (e) {
          sendResponse({ success: false, error: 'Fetch failed: ' + e.message });
        }
      })();
      
      // Return true to indicate we will sendResponse asynchronously
      return true;
    }
  });

  Logger.log('Reddit Safety Extension active.');
})();
