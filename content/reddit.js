/**
 * Cloakly
 * Main Content Script Entry Point
 */

(async function initRedditSafetyExtension() {
  Logger.log('Initializing Cloakly content script...');

  // Fetch initial stored settings
  let currentSettings = await StorageManager.getSettings();
  document.documentElement.dataset.rsAutoReveal = currentSettings.autoRevealNative ? 'true' : 'false';

  // Run initial scan & checks
  const userStatsCache = new Map();
  const userStatsQueue = new Set();
  let isFetchingUserStats = false;

  async function processUserStatsQueue() {
    if (isFetchingUserStats || userStatsQueue.size === 0) return;
    isFetchingUserStats = true;
    
    while (userStatsQueue.size > 0) {
      const username = Array.from(userStatsQueue)[0];
      const userLower = username.toLowerCase();
      
      if (userStatsCache.has(userLower)) {
        userStatsQueue.delete(username);
        continue;
      }
      
      const stats = await RedditDetector.fetchOtherUserStats(username);
      userStatsCache.set(userLower, stats); // Always store with lowercase key
      userStatsQueue.delete(username);
      
      if (stats && stats.rateLimited) {
        // Pause processing for 5 seconds if rate limited
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      // Trigger a re-injection if data was successfully fetched
      if (stats !== null) {
        runScan();
      }
      
      // Sleep slightly to avoid aggressive rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    isFetchingUserStats = false;
  }

  function runScan() {
    // 1. Check for SPA navigation to blocked subreddits or restricted pages
    if (currentSettings) {
      const path = window.location.pathname.toLowerCase();
      
      // A. Check Post Creation
      const blockPostCreation = typeof StorageManager !== 'undefined' ? !StorageManager.isPostCreationAllowed(currentSettings) : !currentSettings.allowPostCreation;
      if (blockPostCreation && (path.includes('/submit') || (path.includes('/r/') && path.endsWith('/submit')))) {
        window.location.replace('https://www.reddit.com/?rs_blocked=post');
        return;
      }

      // B. Check Subreddit Blocking
      const match = path.match(/^\/r\/([^\/]+)/);
      if (match) {
        const currentSub = match[1];
        const blockedSubs = currentSettings.blockedSubreddits || [];
        if (blockedSubs.includes(currentSub)) {
          // We navigated to a blocked sub via SPA!
          // Force replace the DOM to match the hard-blocker's UI.
          document.documentElement.innerHTML = `
            <html>
              <head>
                <title>Blocked Subreddit</title>
                <style>
                  body {
                    background-color: #0f172a;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                  }
                  .container {
                    background-color: #1e293b;
                    padding: 40px;
                    border-radius: 12px;
                    border: 1px solid #334155;
                    max-width: 500px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                  }
                  h1 { color: #ef4444; margin-top: 0; }
                  p { color: #94a3b8; font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
                  .btn {
                    background-color: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                  }
                  .btn:hover { background-color: #2563eb; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>⛔ Access Denied</h1>
                  <p>You have blocked access to <strong>r/${currentSub}</strong> on this profile.</p>
                  <button class="btn" onclick="window.location.href='https://www.reddit.com/';">Go Home</button>
                </div>
              </body>
            </html>
          `;
          return; // Stop scanning
        }
      }
    }

    if (typeof FilterManager !== 'undefined') FilterManager.scanAndApply(currentSettings);
    BlurManager.scanAndApply(currentSettings);
    PostChecker.init(currentSettings);
    PostChecker.checkStealthRemoval();
    
    const blockPostCreation = typeof StorageManager !== 'undefined' ? !StorageManager.isPostCreationAllowed(currentSettings) : !currentSettings.allowPostCreation;
    const blockCommentCreation = typeof StorageManager !== 'undefined' ? !StorageManager.isCommentCreationAllowed(currentSettings) : !currentSettings.allowCommentCreation;

    if (blockPostCreation) {
      document.documentElement.classList.add('rs-block-post-creation');
    } else {
      document.documentElement.classList.remove('rs-block-post-creation');
    }

    if (blockCommentCreation) {
      document.documentElement.classList.add('rs-block-comment-creation');
    } else {
      document.documentElement.classList.remove('rs-block-comment-creation');
    }

    // Distraction Blockers
    if (currentSettings.hideAds) {
      document.documentElement.classList.add('rs-hide-ads');
    } else {
      document.documentElement.classList.remove('rs-hide-ads');
    }
    
    if (currentSettings.hideChat) {
      document.documentElement.classList.add('rs-hide-chat');
    } else {
      document.documentElement.classList.remove('rs-hide-chat');
    }
    
    if (currentSettings.hideNotifications) {
      document.documentElement.classList.add('rs-hide-notifs');
    } else {
      document.documentElement.classList.remove('rs-hide-notifs');
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

    if (blockPostCreation || currentSettings.scrollingOnlyMode) {
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

    // Inject inline block buttons
    if (typeof UIManager !== 'undefined' && UIManager.injectInlineBlockButtons) {
      UIManager.injectInlineBlockButtons(currentSettings);
    }

    // Inject other user stats
    if (typeof UIManager !== 'undefined' && UIManager.injectUserStats) {
      const needed = UIManager.injectUserStats(currentSettings, userStatsCache);
      if (needed && needed.length > 0) {
        needed.forEach(u => userStatsQueue.add(u));
        processUserStatsQueue();
      }
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
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (!node.id || !node.id.startsWith('rs-')) {
              shouldScan = true;
              break;
            }
          } else if (node.nodeType === 3) { // TEXT_NODE
            if (node.textContent.trim() !== '') {
              shouldScan = true;
              break;
            }
          }
        }
      }
      if (shouldScan) break;
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
    if (typeof LinkScanner !== 'undefined') LinkScanner.updateSettings(currentSettings);
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

  Logger.log('Cloakly active.');
})();
