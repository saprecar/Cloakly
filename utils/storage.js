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
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch (err) {
      console.error('[Reddit Safety] Storage fetch error:', err);
      return { ...DEFAULT_SETTINGS };
    }
  },

  async updateSettings(newSettings) {
    try {
      // Check if username changed to safely reset shadowban cache
      if (newSettings.lastDetectedUser || newSettings.manualUsername !== undefined || newSettings.useManualProfile !== undefined) {
        const current = await browserAPI.storage.get(null);
        const oldName = current.useManualProfile ? current.manualUsername : current.lastDetectedUser?.username;
        
        const newUseManual = newSettings.useManualProfile !== undefined ? newSettings.useManualProfile : current.useManualProfile;
        const newManualName = newSettings.manualUsername !== undefined ? newSettings.manualUsername : current.manualUsername;
        const newDetectedName = newSettings.lastDetectedUser ? newSettings.lastDetectedUser.username : current.lastDetectedUser?.username;
        
        const newName = newUseManual ? newManualName : newDetectedName;
        
        if (newName && oldName && newName !== oldName) {
          newSettings.isShadowbanned = false;
          newSettings.lastShadowbanCheck = 0;
          console.log('[Reddit Safety] Username changed, resetting shadowban cache.');
        }
      }

      await browserAPI.storage.set(newSettings);
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
