/**
 * Reddit Privacy & Posting Safety Extension
 * Local Storage Helper & Default Configuration
 */

const DEFAULT_SETTINGS = {
  // Browsing Protection Settings
  nsfwProtection: true,
  spoilerProtection: true,
  blurImages: true,
  blurVideos: true,
  blurGifs: true,
  blurThumbnails: true,
  blurIntensity: 'medium', // 'low', 'medium', 'high'
  revealMethod: 'click',   // 'click', 'hover', 'click_only'
  keepRevealed: false,
  reblurOnNavigation: true,
  autoRevealNative: false, // Auto-unblur Reddit's native NSFW containers

  // Posting & Commenting Safety Settings
  postCheckEnabled: true,
  commentCheckEnabled: true,
  allowPostCreation: true,
  allowCommentCreation: true,
  scrollingOnlyMode: false,
  postFilters: [], // Array of { id, subreddit, keyword }
  blockedSubreddits: [], // Array of strings (e.g., 'news', 'gaming')

  // Manual Profile Overrides (for reliable checker testing/usage)
  useManualProfile: false,
  manualUsername: '',
  manualAccountAgeDays: null,
  manualKarma: null,

  // Auto-detected User Profile
  lastDetectedUser: null, // { username, accountAgeDays, combinedKarma, timestamp }
  
  // Account Health (Shadowban)
  isShadowbanned: false,
  lastShadowbanCheck: 0,

  // Temporary Overrides (Timestamps in ms)
  tempPostEnableUntil: 0,
  tempCommentEnableUntil: 0,

  // Protection Level
  protectionLevel: 'warning', // 'warning', 'strict'

  // Rules & Cache
  ruleCacheEnabled: true,
  ruleCache: {}, // { [subredditName]: { rules: [...], parsedRequirements: {...}, timestamp: 1234567 } }
  
  // Debug mode
  debugMode: false
};

const StorageManager = {
  async getSettings() {
    try {
      const stored = await browserAPI.storage.get(null);

      // --- MIGRATION: V1 (Flat) to V2 (Profiles) ---
      if (!stored.profiles) {
        const v1Settings = { ...stored };
        delete v1Settings.ruleCache; // Global
        delete v1Settings.activeProfile;
        
        const username = v1Settings.useManualProfile && v1Settings.manualUsername 
                         ? v1Settings.manualUsername 
                         : (v1Settings.lastDetectedUser?.username || 'default');
        
        stored.profiles = {};
        stored.profiles[username] = v1Settings;
        stored.activeProfile = username;
        stored.ruleCache = stored.ruleCache || {};
        
        // Save the migrated data back to raw storage
        await browserAPI.storage.set(stored);
      }

      // Determine active profile
      const activeProfile = stored.activeProfile || 'default';
      const profileSettings = stored.profiles[activeProfile] || {};
      
      // Return a transparent, flat object merged with defaults
      return { 
        ...DEFAULT_SETTINGS, 
        ...profileSettings, 
        ruleCache: stored.ruleCache || {}
      };
    } catch (err) {
      console.error('[Reddit Safety] Storage fetch error:', err);
      return { ...DEFAULT_SETTINGS };
    }
  },

  async updateSettings(newSettings) {
    try {
      const stored = await browserAPI.storage.get(null);
      
      // Ensure V2 structure exists
      if (!stored.profiles) {
         // getSettings will handle migration on read, but if they update first, we must bootstrap it
         stored.profiles = { 'default': { ...DEFAULT_SETTINGS } };
         stored.activeProfile = 'default';
         stored.ruleCache = {};
      }

      let activeProfile = stored.activeProfile || 'default';
      let profileSwitched = false;

      // 1. Detect if the username changed, which means we must SWITCH the active profile
      const newUseManual = newSettings.useManualProfile !== undefined ? newSettings.useManualProfile : (stored.profiles[activeProfile]?.useManualProfile || false);
      
      // Check manual username switch
      if (newUseManual && newSettings.manualUsername !== undefined) {
        if (newSettings.manualUsername && newSettings.manualUsername !== activeProfile) {
          activeProfile = newSettings.manualUsername;
          profileSwitched = true;
        }
      } 
      // Check auto-detected username switch
      else if (!newUseManual && newSettings.lastDetectedUser && newSettings.lastDetectedUser.username) {
        if (newSettings.lastDetectedUser.username !== activeProfile) {
          activeProfile = newSettings.lastDetectedUser.username;
          profileSwitched = true;
        }
      }

      // If we switched profiles, ensure the new profile exists in storage
      if (profileSwitched) {
        stored.activeProfile = activeProfile;
        if (!stored.profiles[activeProfile]) {
          stored.profiles[activeProfile] = {}; // Will inherit DEFAULT_SETTINGS on read
        }
        console.log(`[Reddit Safety] Switched active profile to: ${activeProfile}`);
        
        // Reset shadowban check for new profile if it hasn't been checked yet
        if (!stored.profiles[activeProfile].lastShadowbanCheck) {
          newSettings.isShadowbanned = false;
          newSettings.lastShadowbanCheck = 0;
        }
      }

      // 2. Separate global keys from profile keys
      const profileUpdates = { ...newSettings };
      
      if ('ruleCache' in profileUpdates) {
         stored.ruleCache = profileUpdates.ruleCache;
         delete profileUpdates.ruleCache;
      }

      // 3. Apply profile updates to the currently active profile
      stored.profiles[activeProfile] = {
         ...(stored.profiles[activeProfile] || {}),
         ...profileUpdates
      };

      // Save raw nested structure back to storage
      await browserAPI.storage.set(stored);
      return true;
    } catch (err) {
      console.error('[Reddit Safety] Storage update error:', err);
      return false;
    }
  },

  async getSubredditRuleCache(subreddit) {
    if (!subreddit) return null;
    const settings = await this.getSettings();
    const key = subreddit.toLowerCase().replace(/^r\//, '');
    return settings.ruleCache ? settings.ruleCache[key] : null;
  },

  async saveSubredditRuleCache(subreddit, parsedData) {
    if (!subreddit) return;
    const key = subreddit.toLowerCase().replace(/^r\//, '');
    const settings = await this.getSettings();
    const ruleCache = settings.ruleCache || {};
    ruleCache[key] = {
      ...parsedData,
      timestamp: Date.now()
    };
    await this.updateSettings({ ruleCache });
  },

  isPostCreationAllowed(settings) {
    if (settings.allowPostCreation) return true;
    if (settings.tempPostEnableUntil && Date.now() < settings.tempPostEnableUntil) return true;
    return false;
  },

  isCommentCreationAllowed(settings) {
    if (settings.allowCommentCreation) return true;
    if (settings.tempCommentEnableUntil && Date.now() < settings.tempCommentEnableUntil) return true;
    return false;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_SETTINGS, StorageManager };
}
