/**
 * Cloakly
 * Browser API Compatibility Layer (Chrome MV3 & Firefox MV3/WebExtensions)
 *
 * Provides a unified `browserAPI` global that normalizes differences between
 * Chrome's callback-based APIs and Firefox's Promise-based APIs.
 */

const browserAPI = (() => {
  // Detect Firefox: the `browser` global exists and has a real runtime
  const isFirefox = typeof browser !== 'undefined' && !!browser.runtime?.id;
  const rawAPI = isFirefox ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  if (!rawAPI) {
    console.error('[Cloakly] No browser extension API found!');
    return {};
  }

  // --- Storage helpers ---
  // Firefox storage.local methods return Promises natively.
  // Chrome storage.local methods use callbacks. We normalize to Promises.

  const storageLocal = {
    get: async (keys) => {
      if (isFirefox) {
        try {
          return (await rawAPI.storage.local.get(keys)) || {};
        } catch (e) {
          console.error('[Cloakly] Firefox storage.local.get error:', e);
          return {};
        }
      }
      // Chrome: wrap callback in Promise
      return new Promise((resolve) => {
        rawAPI.storage.local.get(keys, (result) => {
          if (rawAPI.runtime.lastError) {
            console.error('[Cloakly] Chrome storage.local.get error:', rawAPI.runtime.lastError);
            resolve({});
          } else {
            resolve(result || {});
          }
        });
      });
    },

    set: async (items) => {
      if (isFirefox) {
        try {
          await rawAPI.storage.local.set(items);
          return true;
        } catch (e) {
          console.error('[Cloakly] Firefox storage.local.set error:', e);
          return false;
        }
      }
      return new Promise((resolve) => {
        rawAPI.storage.local.set(items, () => {
          if (rawAPI.runtime.lastError) {
            console.error('[Cloakly] Chrome storage.local.set error:', rawAPI.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    },

    remove: async (keys) => {
      if (isFirefox) {
        try {
          await rawAPI.storage.local.remove(keys);
          return true;
        } catch (e) {
          return false;
        }
      }
      return new Promise((resolve) => {
        rawAPI.storage.local.remove(keys, () => resolve(true));
      });
    }
  };

  return {
    storage: {
      // Expose storage.local as a sub-object (the standard way)
      local: storageLocal,
      // Also expose get/set/remove at the top level for backward compat
      get: storageLocal.get,
      set: storageLocal.set,
      remove: storageLocal.remove,
      onChanged: {
        addListener: (callback) => {
          rawAPI.storage?.onChanged?.addListener(callback);
        }
      }
    },

    runtime: {
      sendMessage: async (message) => {
        if (isFirefox) {
          try {
            return await rawAPI.runtime.sendMessage(message);
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        return new Promise((resolve) => {
          rawAPI.runtime.sendMessage(message, (response) => {
            const err = rawAPI.runtime.lastError;
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
          rawAPI.runtime?.onMessage?.addListener(callback);
        }
      },
      getURL: (path) => rawAPI.runtime.getURL(path),
      get id() { return rawAPI.runtime.id; }
    },

    // Expose the raw API for cases where we need direct access
    raw: rawAPI
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = browserAPI;
}
