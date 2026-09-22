/**
 * Reddit Privacy & Posting Safety Extension
 * DOM & Content Detector Module for Reddit Layouts (Old, New, Shreddit)
 */

const RedditDetector = {
  /**
   * Detects the current Reddit layout type.
   */
  getLayoutType() {
    if (document.querySelector('shreddit-app') || document.querySelector('shreddit-post')) {
      return 'SHREDDIT';
    }
    if (document.querySelector('div[id^="siteTable"]') || document.body.classList.contains('oldreddit')) {
      return 'OLD_REDDIT';
    }
    return 'NEW_REDDIT';
  },

  /**
   * Scans document for Reddit posts.
   * @returns {Array<HTMLElement>}
   */
  findPosts() {
    const posts = [];
    const selectors = [
      'shreddit-post',
      'div[data-testid="post-container"]',
      'div[id^="t3_"]',
      'article',
      '.thing.link'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!posts.includes(el) && el.tagName !== 'SHREDDIT-APP') {
          posts.push(el);
        }
      });
    });
    return posts;
  },

  /**
   * Checks if a post is marked NSFW or Spoiler.
   * @param {HTMLElement} postEl 
   * @returns {Object} { isNSFW: boolean, isSpoiler: boolean }
   */
  getPostFlags(postEl) {
    let isNSFW = false;
    let isSpoiler = false;

    // Check dataset or attributes
    if (postEl.matches('[nsfw], [data-nsfw="true"], [data-nsfw="1"]')) isNSFW = true;
    if (postEl.matches('[spoiler], [data-spoiler="true"], [data-spoiler="1"]')) isSpoiler = true;

    // Check internal tags or badges aggressively
    if (!isNSFW) {
      const nsfwBadge = postEl.querySelector('[data-testid="nsfw-badge"], .nsfw-stamp, span[aria-label*="nsfw" i], [badge-type="nsfw"], shreddit-badge[text="NSFW" i], .badge-nsfw');
      const title = postEl.querySelector('[slot="title"], .title, shreddit-post-title');
      if (nsfwBadge || (title && /nsfw/i.test(title.innerText))) {
        isNSFW = true;
      }
    }

    if (!isSpoiler) {
      const spoilerBadge = postEl.querySelector('[data-testid="spoiler-badge"], .spoiler-stamp, span[aria-label*="spoiler" i], [badge-type="spoiler"], shreddit-badge[text="Spoiler" i], .badge-spoiler');
      const title = postEl.querySelector('[slot="title"], .title, shreddit-post-title');
      if (spoilerBadge || (title && /spoiler/i.test(title.innerText))) {
        isSpoiler = true;
      }
    }

    return { isNSFW, isSpoiler };
  },

  /**
   * Finds target media elements inside a post container.
   * @param {HTMLElement} postEl 
   * @returns {Array<HTMLElement>}
   */
  findMediaElements(postEl) {
    const media = [];

    // Images, Videos, GIFs, Thumbnails
    const selectors = [
      'img[src*="preview.redd.it"]',
      'img[src*="i.redd.it"]',
      'img[src*="external-preview.redd.it"]',
      'img.thumbnail',
      'a.thumbnail img',
      'shreddit-player',
      'video',
      'div[aria-label*="media" i] img',
      'figure img',
      'img[alt*="Post image" i]'
    ];

    selectors.forEach(sel => {
      postEl.querySelectorAll(sel).forEach(el => {
        if (!media.includes(el) && !el.closest('.rs-reveal-overlay')) {
          media.push(el);
        }
      });
    });

    return media;
  },

  /**
   * Extracts current subreddit name from page URL or DOM.
   * @returns {string|null} e.g. "gaming" or null
   */
  getCurrentSubreddit() {
    const path = window.location.pathname;
    const match = path.match(/\/r\/([a-zA-Z0-9_]+)/);
    if (match) return match[1];

    // Check DOM meta or headers
    const subHeader = document.querySelector('shreddit-subreddit-header, a[href*="/r/"]');
    if (subHeader) {
      const href = subHeader.getAttribute('href') || subHeader.getAttribute('name');
      const m = href?.match(/\/r\/([a-zA-Z0-9_]+)/);
      if (m) return m[1];
    }
    return null;
  },

  /**
   * Extract account information exposed in Reddit session window/meta.
   * Uses manual profile settings from user if enabled.
   */
  extractUserAccountInfo(settings = null) {
    if (settings && settings.useManualProfile) {
      return {
        accountAgeDays: settings.manualAccountAgeDays !== null ? settings.manualAccountAgeDays : null,
        commentKarma: null,
        postKarma: null,
        combinedKarma: settings.manualKarma !== null ? settings.manualKarma : null,
        isEmailVerified: true // Assume verified if manual
      };
    }

    let accountAgeDays = null;
    let commentKarma = null;
    let postKarma = null;
    let combinedKarma = null;
    let isEmailVerified = false;
    let username = null;

    try {
      // 1. Check window.___r or Reddit initial state data if available
      const rData = window.___r || window.__INITIAL_STATE__;
      if (rData && rData.user) {
        accountAgeDays = rData.user.created ? Math.floor((Date.now() - rData.user.created * 1000) / 86400000) : null;
        commentKarma = rData.user.commentKarma ?? null;
        postKarma = rData.user.linkKarma ?? null;
        combinedKarma = rData.user.totalKarma ?? null;
        isEmailVerified = !!rData.user.hasVerifiedEmail;
      }

      // 2. Check DOM user dropdown or sidebar info
      if (accountAgeDays === null || combinedKarma === null) {
        const karmaEl = document.querySelector('#header-user-karma, [data-testid="user-karma"]');
        if (karmaEl && combinedKarma === null) {
          const num = parseInt(karmaEl.innerText.replace(/,/g, ''), 10);
          if (!isNaN(num)) combinedKarma = num;
        }

        // 3. Shreddit specific DOM text scraping (fallback)
        try {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          let node;
          while (node = walker.nextNode()) {
            const val = node.nodeValue ? node.nodeValue.trim() : '';
            if (!val) continue;

            if (val === 'Reddit Age' && accountAgeDays === null) {
              const parentText = node.parentElement?.parentElement?.innerText || '';
              const match = parentText.match(/([\d,]+)\s*(y|m|d)/i);
              if (match) {
                const num = parseInt(match[1].replace(/,/g, ''), 10);
                const unit = match[2].toLowerCase();
                if (unit === 'y') accountAgeDays = num * 365;
                else if (unit === 'm') accountAgeDays = num * 30;
                else if (unit === 'd') accountAgeDays = num;
              }
            }
            if (val === 'Karma' && combinedKarma === null) {
              const parentText = node.parentElement?.parentElement?.innerText || '';
              // Match "5,430 \n Karma" or just the number above
              const match = parentText.match(/([\d,]+)\s*[\r\n]*Karma/i) || parentText.match(/^([\d,]+)$/m);
              if (match) {
                combinedKarma = parseInt(match[1].replace(/,/g, ''), 10);
              }
            }
          }
        } catch(e) {}
      }
    } catch (e) {
      return { accountAgeDays: null, commentKarma: null, postKarma: null, combinedKarma: null, isEmailVerified: false };
    }

    return {
      accountAgeDays,
      commentKarma,
      postKarma,
      combinedKarma,
      isEmailVerified,
      username
    };
  },

  /**
   * Recursively traverses DOM and all open shadowRoot trees to query matching elements.
   */
  queryDeepAll(selector, root = document) {
    let results = [];
    try {
      results = Array.from(root.querySelectorAll(selector));
    } catch (e) {}

    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
      let el;
      while ((el = walker.nextNode())) {
        if (el.shadowRoot) {
          try {
            const nested = this.queryDeepAll(selector, el.shadowRoot);
            results = results.concat(nested);
          } catch (e) {}
        }
      }
    } catch (e) {}

    return results;
  },

  /**
   * Parses Reddit user API JSON into standardized format.
   */
  parseRedditUserData(data) {
    if (!data) return null;
    const user = data.data || data;
    if (!user || (!user.name && !user.id && !user.screen_name)) return null;

    const createdUtc = user.created_utc || user.created;
    const accountAgeDays = createdUtc ? Math.max(0, Math.floor((Date.now() - (createdUtc * 1000)) / 86400000)) : null;

    const commentKarma = typeof user.comment_karma === 'number' ? user.comment_karma : null;
    const linkKarma = typeof user.link_karma === 'number' ? user.link_karma : null;
    const combinedKarma = typeof user.total_karma === 'number' ? user.total_karma :
                          (commentKarma !== null && linkKarma !== null ? commentKarma + linkKarma : null);

    return {
      username: user.name || user.screen_name || null,
      accountAgeDays,
      commentKarma,
      linkKarma,
      combinedKarma,
      isEmailVerified: !!user.has_verified_email
    };
  },

  /**
   * Persists detected user statistics to extension storage for popup and options display.
   */
  saveDetectedUser(parsed) {
    if (parsed && typeof StorageManager !== 'undefined' && (parsed.username || parsed.accountAgeDays !== null)) {
      StorageManager.updateSettings({
        lastDetectedUser: {
          username: parsed.username || null,
          accountAgeDays: parsed.accountAgeDays,
          combinedKarma: parsed.combinedKarma,
          timestamp: Date.now()
        }
      }).catch(() => {});
    }
  },

  /**
   * Scans DOM (including Shadow DOM), script tags, and storage to discover the logged-in username.
   */
  detectLoggedInUsername() {
    const ignored = new Set(['me', 'reddit', 'help', 'terms', 'privacy', 'rules', 'contact', 'about', 'login', 'signup', 'submit', 'all', 'settings', 'leaderboard', 'explore', 'advertising', 'careers']);

    // 1. Check window state (Most reliable, no false positives)
    try {
      const rData = window.___r || window.__INITIAL_STATE__;
      if (rData && rData.user && (rData.user.username || rData.user.name)) {
        return rData.user.username || rData.user.name;
      }
    } catch (e) {}

    // 2. Check localStorage / sessionStorage (Very reliable)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === 'user' || key === 'currentUser' || key === 'reddit_session_user') {
          const val = localStorage.getItem(key);
          const m = val?.match(/"(?:username|name|screen_name)"\s*:\s*"([a-zA-Z0-9_\-]+)"/i);
          if (m && m[1] && m[1].toLowerCase() !== 'me' && !ignored.has(m[1].toLowerCase())) {
            return m[1];
          }
        }
      }
    } catch (e) {}
    
    // 3. Scan script tags (Reliable for Shreddit config blocks)
    try {
      const scripts = document.querySelectorAll('script');
      const patterns = [
        /"currentUser"\s*:\s*\{[^}]*"name"\s*:\s*"([a-zA-Z0-9_\-]+)"/i,
        /"user"\s*:\s*\{[^}]*"name"\s*:\s*"([a-zA-Z0-9_\-]+)"/i,
        /"screen_name"\s*:\s*"([a-zA-Z0-9_\-]+)"/i,
        /"account_name"\s*:\s*"([a-zA-Z0-9_\-]+)"/i,
        /"username"\s*:\s*"([a-zA-Z0-9_\-]+)"/i
      ];

      for (const script of scripts) {
        const text = script.textContent;
        if (!text || text.length < 20) continue;
        for (const pat of patterns) {
          const m = text.match(pat);
          if (m && m[1] && m[1].toLowerCase() !== 'me' && !ignored.has(m[1].toLowerCase())) {
            Logger.log(`Discovered username from script tag: u/${m[1]}`);
            return m[1];
          }
        }
      }
    } catch (e) {}

    // 4. Direct avatar link detection in Headers/Drawers (DOM fallback)
    try {
      const links = this.queryDeepAll('a[href*="/user/"], a[href*="/u/"]');

      for (const link of links) {
        const href = link.getAttribute('href') || link.href || '';
        const match = href.match(/\/(?:user|u)\/([a-zA-Z0-9_\-]+)\/?/i);
        if (!match) continue;

        const uname = match[1];
        if (ignored.has(uname.toLowerCase())) continue;

        // Ensure it's in a header or navigation context, not a post or comment
        const inUserNav = link.closest('header, reddit-header-action-items, faceplate-dropdown-menu, #header-bottom-right, [id*="user-drawer"], [id*="expand-user"], #email-collection-tooltip-id');
        if (inUserNav) {
          Logger.log(`Found user nav link for u/${uname}`);
          return uname;
        }
      }
    } catch (e) {}

    return null;
  },

  /**
   * Asynchronously fetches user account age and karma using a multi-tiered strategy:
   * 1. Manual settings override
   * 2. Cached previously detected user stats
   * 3. Configured username (e.g. from popup or manual input)
   * 4. Deep DOM & Shadow DOM avatar detection
   * 5. Background service worker delegation
   * 6. Synchronous DOM text scraping fallback
   */
  async fetchUserAccountInfo(settings = null) {
    // 1. Manual override takes strict precedence
    if (settings && settings.useManualProfile) {
      return this.extractUserAccountInfo(settings);
    }

    let username = (settings && settings.manualUsername ? settings.manualUsername.trim().replace(/^u\//i, '') : null);
    if (!username) {
      username = this.detectLoggedInUsername();
    }

    // 2. Return cached detected user stats if already available AND username matches (or if we couldn't detect a username but have cache)
    if (settings && settings.lastDetectedUser && settings.lastDetectedUser.accountAgeDays !== null) {
      const cachedUsername = settings.lastDetectedUser.username;
      if (!username || (cachedUsername && username.toLowerCase() === cachedUsername.toLowerCase())) {
        Logger.log(`Using cached user profile stats for u/${cachedUsername || 'user'}`);
        return settings.lastDetectedUser;
      } else {
        Logger.log(`Cached username u/${cachedUsername} does not match detected u/${username}. Re-fetching...`);
      }
    }

    // 4. Fetch user profile from public Reddit API
    if (username) {
      // Step A: Fetch /user/{username}/about.json from content script
      try {
        const url = `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          const parsed = this.parseRedditUserData(json);
          if (parsed && parsed.accountAgeDays !== null) {
            Logger.log(`Successfully fetched stats for u/${username} via about.json`);
            this.saveDetectedUser(parsed);
            return parsed;
          }
        }
      } catch (e) {
        Logger.warn(`Direct fetch for u/${username} failed, requesting background worker:`, e);
      }

      // Step B: Delegate to background service worker (with host_permissions)
      try {
        if (typeof browserAPI !== 'undefined' && browserAPI.runtime) {
          const bgResponse = await browserAPI.runtime.sendMessage({ action: 'FETCH_REDDIT_USER', username });

          if (bgResponse && bgResponse.success && bgResponse.data) {
            const parsed = this.parseRedditUserData(bgResponse.data);
            if (parsed && parsed.accountAgeDays !== null) {
              Logger.log(`Successfully fetched stats via background worker for u/${username}`);
              this.saveDetectedUser(parsed);
              return parsed;
            }
          }
        }
      } catch (e) {
        Logger.warn('Background worker delegation error:', e);
      }
    } else {
      // Step C: Try asking background worker for session endpoint as fallback
      try {
        if (typeof browserAPI !== 'undefined' && browserAPI.runtime) {
          const bgResponse = await browserAPI.runtime.sendMessage({ action: 'FETCH_REDDIT_USER' });

          if (bgResponse && bgResponse.success && bgResponse.data) {
            const parsed = this.parseRedditUserData(bgResponse.data);
            if (parsed && parsed.accountAgeDays !== null) {
              Logger.log('Successfully fetched stats via background worker session');
              this.saveDetectedUser(parsed);
              return parsed;
            }
          }
        }
      } catch (e) {}
    }

    // Step E: Fallback to synchronous DOM text scraping
    Logger.log('API methods exhausted; falling back to DOM text scraping.');
    return this.extractUserAccountInfo(settings);
  },

  /**
   * Dedicated fetcher for any other user's stats by username
   * Used for the Inline User Stats feature.
   * @param {string} username 
   * @returns {Promise<Object|null>}
   */
  async fetchOtherUserStats(username) {
    if (!username) return null;
    try {
      const url = `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        const parsed = this.parseRedditUserData(json);
        if (parsed && parsed.accountAgeDays !== null) {
          return parsed;
        }
      } else if (res.status === 429) {
        Logger.warn(`Rate limited by Reddit API for u/${username}!`);
        return { rateLimited: true };
      }
    } catch (e) {
      Logger.warn(`Failed to fetch stats for u/${username}:`, e);
    }
    return null;
  },

  /**
   * Extracts rule texts from current subreddit sidebar DOM elements.
   * Tries many selector strategies since Reddit's DOM changes frequently.
   */
  extractSubredditRuleTexts() {
    const ruleTexts = [];
    const seen = new Set();

    const addText = (txt) => {
      txt = txt?.trim();
      if (txt && txt.length > 5 && !seen.has(txt)) {
        seen.add(txt);
        ruleTexts.push(txt);
      }
    };

    // Strategy 1: Standard selectors (new Reddit + old Reddit)
    const selectors = [
      'shreddit-subreddit-rule',
      'div[data-testid="subreddit-rule"]',
      '.md-container',
      // Rules widget in sidebar
      '[data-testid="subreddit-rules-widget"] li',
      '[data-testid="subreddit-rules-widget"] details',
      // Sidebar right-rail rule sections
      'aside details summary',
      'aside details p',
      'aside details div',
      // Generic rule containers
      '.rule-description',
      '.InfoTextTooltip',
      'div[class*="rule"]',
      'ol[class*="rule"] li',
      // Expandable section content (used in sidebar rules)
      'details[open] div',
    ];

    selectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          addText(el.innerText);
        });
      } catch (e) {}
    });

    return ruleTexts;
  },

  /**
   * Fetches subreddit rules from Reddit's public JSON API.
   * This is more reliable than DOM scraping since the sidebar
   * rules are loaded dynamically and often inside Shadow DOM.
   * @param {string} subreddit - subreddit name without /r/ prefix
   * @returns {Promise<Array<string>>} array of rule description strings
   */
  async fetchSubredditRulesFromAPI(subreddit) {
    if (!subreddit) return [];

    try {
      const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about/rules.json`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        Logger.warn(`Failed to fetch rules for r/${subreddit}: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      const ruleTexts = [];

      if (data.rules && Array.isArray(data.rules)) {
        data.rules.forEach(rule => {
          const parts = [];
          if (rule.short_name) parts.push(rule.short_name);
          if (rule.description) parts.push(rule.description);
          if (parts.length > 0) {
            // Decode HTML entities
            const decoded = parts.join(' — ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'");
            ruleTexts.push(decoded);
          }
        });
      }

      Logger.log(`Fetched ${ruleTexts.length} rules from API for r/${subreddit}`);
      return ruleTexts;
    } catch (err) {
      Logger.error(`Error fetching rules from API for r/${subreddit}:`, err);
      return [];
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RedditDetector;
}
