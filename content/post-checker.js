/**
 * Reddit Privacy & Posting Safety Extension
 * Pre-Post & Pre-Comment Checker Interceptor
 * 
 * Modern Reddit (Shreddit) uses web components with closed Shadow DOM
 * for the comment composer. This module works around that by:
 * 1. Finding composer elements in the light DOM
 * 2. Injecting guide cards as siblings (not children)
 * 3. Using document-level event delegation for button interception
 */

const PostChecker = {
  _initialized: false,
  _delegationAttached: false,

  /**
   * Initializes submission listeners on post/comment buttons.
   */
  init(settings) {
    this.settings = settings;
    Logger.log('PostChecker.init called, settings:', JSON.stringify({
      postCheckEnabled: settings.postCheckEnabled,
      commentCheckEnabled: settings.commentCheckEnabled,
      allowPostCreation: settings.allowPostCreation,
      allowCommentCreation: settings.allowCommentCreation
    }));

    this.attachDocumentDelegation();
    this.attachInlineGuides();
    this._initialized = true;
  },

  /**
   * Updates settings state inside checker.
   */
  updateSettings(settings) {
    this.settings = settings;
    this.attachInlineGuides();
  },

  /**
   * Attaches a single document-level click listener to intercept
   * comment/post submit buttons. This works even if buttons are
   * inside Shadow DOM, because click events bubble up to document.
   */
  attachDocumentDelegation() {
    if (this._delegationAttached) return;
    this._delegationAttached = true;

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;

      const btnText = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      const btnType = btn.getAttribute('type');
      const btnSlot = btn.getAttribute('slot');
      const btnTestId = btn.getAttribute('data-testid');

      // Determine if this is a comment/reply button
      let isCommentBtn = false;
      let isPostBtn = false;

      // Check by text content
      if (btnText === 'comment' || btnText === 'reply') {
        isCommentBtn = true;
      } else if (btnText === 'post' || btnText === 'submit') {
        isPostBtn = true;
      }

      // Check by data-testid
      if (btnTestId === 'comment-submit-button') isCommentBtn = true;
      if (btnTestId === 'post-submit-button') isPostBtn = true;

      // Check by slot attribute (Reddit uses slot="submit-button" sometimes)
      if (btnSlot === 'submit-button') {
        // Determine if it's in a comment context
        const nearComposer = btn.closest('shreddit-composer, shreddit-comment-tree, [bundlename="comment_composer"]');
        if (nearComposer) isCommentBtn = true;
      }

      // Check by ancestor context
      if (!isCommentBtn && !isPostBtn && btnType === 'submit') {
        const inCommentTree = btn.closest('shreddit-comment-tree, [bundlename="comment_composer"]');
        const inPostComposer = btn.closest('shreddit-post-composer');
        if (inCommentTree) isCommentBtn = true;
        else if (inPostComposer) isPostBtn = true;
      }

      if (!isCommentBtn && !isPostBtn) return;

      const type = isCommentBtn ? 'comment' : 'post';
      
      Logger.log(`Intercepted ${type} button click:`, btnText);

      // Skip if already approved
      if (btn.dataset.rsApproved === 'true') {
        btn.dataset.rsApproved = 'false';
        return;
      }

      // 1. Check if creation is disabled
      const isAllowed = type === 'post'
        ? StorageManager.isPostCreationAllowed(this.settings)
        : StorageManager.isCommentCreationAllowed(this.settings);

      if (!isAllowed) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Show non-blocking banner instead of alert() (Firefox freezes on alert in content scripts)
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ef4444;color:white;padding:12px 24px;border-radius:8px;font-weight:bold;z-index:2147483647;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        banner.textContent = `🔒 ${type === 'post' ? 'Post' : 'Comment'} creation is disabled by Reddit Safety Extension.`;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 4000);
        return;
      }

      // 2. Check if pre-submission checking is enabled
      const isCheckEnabled = type === 'post'
        ? this.settings.postCheckEnabled
        : this.settings.commentCheckEnabled;
      if (!isCheckEnabled) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // 3. Extract subreddit & rules
      const subreddit = RedditDetector.getCurrentSubreddit();
      const accountInfo = await RedditDetector.fetchUserAccountInfo(this.settings);

      let parsedRules = null;
      if (subreddit) {
        // Try cache first
        const cachedRuleData = await StorageManager.getSubredditRuleCache(subreddit);
        if (cachedRuleData && cachedRuleData.parsedRules) {
          parsedRules = cachedRuleData.parsedRules;
        } else {
          // Fetch from API (most reliable source)
          let rawRules = await RedditDetector.fetchSubredditRulesFromAPI(subreddit);
          // Fallback to DOM scraping
          if (rawRules.length === 0) {
            rawRules = RedditDetector.extractSubredditRuleTexts();
          }
          if (rawRules.length > 0) {
            parsedRules = RulePatterns.parseRuleText(rawRules);
            StorageManager.saveSubredditRuleCache(subreddit, { parsedRules, rawRules });
          }
        }
      }

      // Attempt to extract real title and text from composer
      let title = '';
      let text = '';
      let flairSelected = false;
      let linksCount = 0;

      if (type === 'post') {
        const titleEl = document.querySelector('input[name="title"], textarea[name="title"], [name="title"]');
        if (titleEl) title = titleEl.value || titleEl.innerText || '';
        
        // Flair selection detection (heuristic)
        const flairPicker = document.querySelector('shreddit-composer-flair-picker, [data-testid="flair-picker"]');
        if (flairPicker && flairPicker.hasAttribute('selected-flair-id')) {
          flairSelected = true;
        } else if (document.querySelector('shreddit-composer-flair-badge, .flair-badge')) {
          flairSelected = true;
        }
      } else {
        const textEl = btn.closest('form, shreddit-composer, .commentarea')?.querySelector('textarea, [contenteditable="true"]');
        if (textEl) {
          text = textEl.value || textEl.innerText || '';
        }
      }

      const submissionDetails = {
        subreddit,
        type,
        title,
        text,
        flairSelected,
        linksCount: (text.match(/https?:\/\//gi) || []).length
      };

      const evaluation = RuleEngine.evaluate(accountInfo, submissionDetails, parsedRules);

      if (evaluation.status === 'PASS') {
        btn.dataset.rsApproved = 'true';
        btn.click();
      } else {
        UIManager.showWarningModal(
          evaluation,
          subreddit,
          type,
          this.settings,
          () => {
            btn.dataset.rsApproved = 'true';
            btn.click();
          },
          () => {}
        );
      }
    }, true); // Capture phase to intercept before Reddit's handlers

    Logger.log('Document-level click delegation attached for submit interception.');
  },

  findCommentAreas() {
    // Strategy 1: Find shreddit-composer elements (Modern Shreddit)
    const composers = Array.from(document.querySelectorAll('shreddit-composer'));
    const visibleComposers = composers.filter(c => {
      const rect = c.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(c).display !== 'none';
    });
    
    if (visibleComposers.length > 0) {
      const parents = visibleComposers.map(c => c.parentElement || c);
      return Array.from(new Set(parents));
    }

    // Strategy 2: Find by bundlename attribute (async loader for comment composer)
    const bundle = document.querySelector('[bundlename="comment_composer"], [bundlename*="comment"]');
    if (bundle) {
      return [bundle];
    }

    // Strategy 3: Old Reddit / fallback - look for .commentarea or comment forms
    const oldForm = document.querySelector('.commentarea, form[action*="comment" i]');
    if (oldForm) {
      return [oldForm];
    }

    // Strategy 4: Look for placeholder text containers ("Join the conversation", "Add a comment")
    const placeholders = [];
    document.querySelectorAll('div[placeholder], p[placeholder]').forEach(el => {
      const ph = (el.getAttribute('placeholder') || '').toLowerCase();
      if (ph.includes('conversation') || ph.includes('comment') || ph.includes('add a')) {
        const wrapper = el.closest('div[class]') || el.parentElement;
        if (wrapper && !placeholders.includes(wrapper)) placeholders.push(wrapper);
      }
    });
    if (placeholders.length > 0) {
      return [placeholders[0]];
    }

    return [];
  },

  /**
   * Renders live inline safety guidance on/near comment areas.
   */
  async attachInlineGuides() {
    const areas = this.findCommentAreas();
    const subreddit = RedditDetector.getCurrentSubreddit();
    const isCommentAllowed = StorageManager.isCommentCreationAllowed(this.settings);

    Logger.log(`attachInlineGuides: ${areas.length} areas, subreddit=${subreddit}, commentAllowed=${isCommentAllowed}`);

    let parsedRules = null;
    if (subreddit) {
      // Try cache first for speed
      const cached = await StorageManager.getSubredditRuleCache(subreddit);
      if (cached && cached.parsedRules) {
        parsedRules = cached.parsedRules;
      } else {
        // Fetch from Reddit API (most reliable)
        let rawRules = await RedditDetector.fetchSubredditRulesFromAPI(subreddit);
        // Fallback to DOM scraping
        if (rawRules.length === 0) {
          rawRules = RedditDetector.extractSubredditRuleTexts();
        }
        if (rawRules.length > 0) {
          parsedRules = RulePatterns.parseRuleText(rawRules);
          StorageManager.saveSubredditRuleCache(subreddit, { parsedRules, rawRules });
        }
      }
    }

    const accountInfo = await RedditDetector.fetchUserAccountInfo(this.settings);
    const submissionDetails = {
      subreddit,
      type: 'comment',
      text: '',
      linksCount: 0
    };
    const evaluation = RuleEngine.evaluate(accountInfo, submissionDetails, parsedRules);

    // Inject guide near each comment area
    areas.forEach(area => {
      UIManager.renderCommentInlineGuide(area, subreddit, evaluation, this.settings, isCommentAllowed, accountInfo);
    });

    // If no areas found at all, inject a floating guide at the comment section
    if (areas.length === 0) {
      Logger.log('No comment areas found via selectors. Attempting broader search...');
      this.injectFloatingGuide(subreddit, evaluation, isCommentAllowed, accountInfo);
    }
  },

  /**
   * If we can't find any comment container, inject a floating guide
   * near the bottom of the post content as a fallback.
   */
  injectFloatingGuide(subreddit, evaluation, isCommentAllowed, accountInfo) {
    // Don't duplicate
    if (document.getElementById('rs-floating-comment-guide')) return;

    // Only show on post detail pages (URL contains /comments/)
    if (!window.location.pathname.includes('/comments/')) return;

    const guide = document.createElement('div');
    guide.id = 'rs-floating-comment-guide';
    UIManager.renderCommentInlineGuide(guide, subreddit, evaluation, this.settings, isCommentAllowed, accountInfo);

    // Find a reasonable place to insert it
    const commentSection = document.querySelector('shreddit-comment-tree')
      || document.querySelector('#comment-tree')
      || document.querySelector('.commentarea')
      || document.querySelector('[data-testid="comment-tree"]');

    if (commentSection) {
      commentSection.parentElement.insertBefore(guide, commentSection);
      Logger.log('Floating guide inserted before comment section.');
    } else {
      // Last resort: append after main content area
      const mainContent = document.querySelector('shreddit-post')
        || document.querySelector('[data-testid="post-container"]')
        || document.querySelector('.Post');
      if (mainContent && mainContent.parentElement) {
        mainContent.parentElement.insertBefore(guide, mainContent.nextSibling);
        Logger.log('Floating guide inserted after main post content.');
      }
    }
  },

  /**
   * Detects if the user's currently viewed post was silently removed (ghosted)
   */
  async checkStealthRemoval() {
    if (!this.settings || !this.settings.lastDetectedUser?.username) return;
    
    // Only run on post detail pages
    if (!window.location.pathname.includes('/comments/')) return;
    
    // Avoid double checking the same post on SPA navigations or infinite scroll
    const postContainer = document.querySelector('shreddit-post') || document.querySelector('[data-testid="post-container"]');
    if (postContainer && postContainer.dataset.rsStealthChecked === 'true') return;
    if (postContainer) postContainer.dataset.rsStealthChecked = 'true';

    try {
      // Fetch post JSON without hitting API rate limits
      const url = window.location.pathname + '.json';
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;

      const data = await res.json();
      const post = data[0]?.data?.children?.[0]?.data;
      if (!post) return;

      // Only warn if the user is the author
      if (post.author !== this.settings.lastDetectedUser.username) return;

      const isRemoved = post.removed_by_category || post.banned_by || post.spam || (post.is_robot_indexable === false && (post.removed || post.is_removed));
      
      if (isRemoved) {
        Logger.log('Stealth removal detected for this post. Category:', post.removed_by_category);
        
        // Inject heavy warning banner at the top of the post
        const banner = document.createElement('div');
        banner.style.cssText = 'background: #ef4444; color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-weight: bold; display: flex; align-items: center; gap: 8px; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); z-index: 1000; position: relative;';
        const reason = post.removed_by_category ? `(Reason: ${post.removed_by_category})` : '';
        banner.innerHTML = `<span style="font-size: 20px;">👻</span> <span><strong>GHOSTED:</strong> This post has been silently removed by automated filters or moderators and is invisible to others. ${reason}</span>`;
        
        if (postContainer) {
          postContainer.parentElement.insertBefore(banner, postContainer);
        } else {
          document.body.prepend(banner);
        }
      }
    } catch (e) {
      Logger.log('Error checking stealth removal:', e);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PostChecker;
}
