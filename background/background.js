/**
 * Reddit Privacy & Posting Safety Extension
 * Background Service Worker
 */

// Import dependencies in Chromium Service Worker; in Firefox they are loaded via manifest.json scripts array
if (typeof importScripts === 'function') {
  try {
    importScripts('/utils/browser-api.js', '/utils/storage.js', '/utils/logger.js', '/background/cleaner.js');
  } catch (e) {
    console.warn('[Reddit Safety] importScripts error:', e);
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
  if (request.action === 'CHECK_SHADOWBAN') {
    (async () => {
      try {
        const tab = await api.tabs.create({ url: 'https://www.reddit.com/appeal', active: false });
        
        // Wait for tab to load and inject script
        api.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            api.tabs.onUpdated.removeListener(listener);
            
            // Wait 2s for React to hydrate
            setTimeout(() => {
              api.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  if (window.location.href.includes('login')) {
                    return { error: 'Not logged in' };
                  }
                  
                  // Helper to deeply extract text from Shadow DOMs
                  function getDeepText(node) {
                    let text = '';
                    if (node.nodeType === Node.TEXT_NODE) {
                      text += node.textContent + ' ';
                    }
                    if (node.shadowRoot) {
                      text += getDeepText(node.shadowRoot);
                    }
                    node.childNodes.forEach(child => {
                      text += getDeepText(child);
                    });
                    return text;
                  }

                  const textLower = getDeepText(document.body).toLowerCase();
                  const htmlLower = document.documentElement.innerHTML.toLowerCase();
                  
                  const isNormal = textLower.includes('neither suspended nor restricted') || 
                                   textLower.includes('cannot submit an appeal') ||
                                   htmlLower.includes('neither suspended nor restricted') ||
                                   htmlLower.includes('cannot submit an appeal');
                                   
                  return { success: true, isShadowbanned: !isNormal };
                }
              }).then(results => {
                api.tabs.remove(tab.id);
                if (results && results[0] && results[0].result) {
                  sendResponse(results[0].result);
                } else {
                  sendResponse({ success: false, error: 'Could not read page' });
                }
              }).catch(e => {
                api.tabs.remove(tab.id);
                sendResponse({ success: false, error: 'Script injection failed' });
              });
            }, 2000);
          }
        });

        // Failsafe timeout
        setTimeout(() => {
          try { api.tabs.remove(tab.id); } catch (e) {}
        }, 15000);

      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
