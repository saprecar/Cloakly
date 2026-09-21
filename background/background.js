/**
 * Reddit Privacy & Posting Safety Extension
 * Background Service Worker
 */

// Import scripts in Chromium Service Worker; in Firefox they are loaded via manifest.json scripts array
if (typeof importScripts === 'function') {
  try {
    importScripts('/utils/browser-api.js', '/utils/storage.js', '/utils/logger.js');
  } catch (e) {
    console.warn('[Reddit Safety] importScripts notice:', e);
  }
}

const api = typeof browser !== 'undefined' ? browser : chrome;

// Initialize extension defaults on install
api.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    Logger.log('Extension installed. Setting default configurations.');
    await StorageManager.updateSettings(DEFAULT_SETTINGS);
  }
});

// Periodic timer checking expired 10-minute overrides
api.alarms?.create('checkTempOverrides', { periodInMinutes: 1 });
api.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkTempOverrides') {
    const settings = await StorageManager.getSettings();
    const now = Date.now();
    let updated = false;
    const updates = {};

    if (settings.tempPostEnableUntil && now >= settings.tempPostEnableUntil) {
      updates.tempPostEnableUntil = 0;
      updated = true;
    }
    if (settings.tempCommentEnableUntil && now >= settings.tempCommentEnableUntil) {
      updates.tempCommentEnableUntil = 0;
      updated = true;
    }

    if (updated) {
      await StorageManager.updateSettings(updates);
      Logger.log('Expired temporary posting overrides cleared.');
    }
  }
});

// Message listener
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_SETTINGS') {
    StorageManager.getSettings().then(settings => sendResponse(settings));
    return true;
  }
  if (request.action === 'UPDATE_SETTINGS') {
    StorageManager.updateSettings(request.settings).then(() => sendResponse({ success: true }));
    return true;
  }
  if (request.action === 'FETCH_REDDIT_USER') {
    (async () => {
      try {
        const username = request.username;
        const urls = [];
        if (username) {
          urls.push(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`);
        }
        urls.push('https://www.reddit.com/user/me/about.json');
        urls.push('https://www.reddit.com/api/me.json');

        for (const url of urls) {
          try {
            const res = await fetch(url, {
              headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
              const data = await res.json();
              sendResponse({ success: true, data });
              return;
            }
          } catch (e) {}
        }
        sendResponse({ success: false });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});

