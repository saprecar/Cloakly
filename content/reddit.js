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
    BlurManager.scanAndApply(currentSettings);
    PostChecker.init(currentSettings);
  }

  runScan();

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

  Logger.log('Reddit Safety Extension active.');
})();
