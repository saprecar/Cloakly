/**
 * Reddit Privacy & Posting Safety Extension
 * Main Content Script Entry Point
 */

(async function initRedditSafetyExtension() {
  Logger.log('Initializing Reddit Safety Extension content script...');

  // Fetch initial stored settings
  let currentSettings = await StorageManager.getSettings();

  // Run initial scan & checks
  function runScan() {
    if (typeof FilterManager !== 'undefined') FilterManager.scanAndApply(currentSettings);
    BlurManager.scanAndApply(currentSettings);
    PostChecker.init(currentSettings);
    PostChecker.checkStealthRemoval();
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
