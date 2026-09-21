/**
 * Reddit Privacy & Posting Safety Extension
 * Browser API Compatibility Layer (Chrome V3 & Firefox WebExtensions)
 */

const browserAPI = (() => {
  const isFirefox = typeof browser !== 'undefined' && !!browser.runtime?.getManifest;
  const api = isFirefox ? browser : (typeof chrome !== 'undefined' ? chrome : {});

  return {
    storage: {
      get: async (keys) => {
        if (isFirefox && browser.storage?.local?.get) {
          try {
            return (await browser.storage.local.get(keys)) || {};
          } catch (e) {}
        }
        return new Promise((resolve) => {
          (chrome.storage?.local || api.storage?.local).get(keys, (result) => resolve(result || {}));
        });
      },
      set: async (items) => {
        if (isFirefox && browser.storage?.local?.set) {
          try {
            await browser.storage.local.set(items);
            return true;
          } catch (e) {}
        }
        return new Promise((resolve) => {
          (chrome.storage?.local || api.storage?.local).set(items, () => resolve(true));
        });
      },
      remove: async (keys) => {
        if (isFirefox && browser.storage?.local?.remove) {
          try {
            await browser.storage.local.remove(keys);
            return true;
          } catch (e) {}
        }
        return new Promise((resolve) => {
          (chrome.storage?.local || api.storage?.local).remove(keys, () => resolve(true));
        });
      },
      onChanged: {
        addListener: (callback) => {
          const target = (typeof browser !== 'undefined' && browser.storage?.onChanged) || chrome.storage?.onChanged;
          target?.addListener(callback);
        }
      }
    },
    runtime: {
      sendMessage: async (message) => {
        if (isFirefox && browser.runtime?.sendMessage) {
          try {
            return await browser.runtime.sendMessage(message);
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(message, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve(response);
            }
          });
        });
      },
      onMessage: {
        addListener: (callback) => {
          const target = (typeof browser !== 'undefined' && browser.runtime?.onMessage) || chrome.runtime?.onMessage;
          target?.addListener(callback);
        }
      },
      getURL: (path) => ((typeof browser !== 'undefined' && browser.runtime?.getURL) || chrome.runtime?.getURL)(path)
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = browserAPI;
}
