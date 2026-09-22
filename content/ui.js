/**
 * Reddit Privacy & Posting Safety Extension
 * UI Component & Modal Injection Layer
 */

const UIManager = {
  /**
   * Shows a pre-submission warning modal overlay.
   * 
   * @param {Object} evaluation - Evaluation result from RuleEngine
   * @param {string} subreddit - Subreddit name
   * @param {string} submissionType - 'post' | 'comment'
   * @param {Object} settings - User extension settings
   * @param {Function} onProceed - Callback if user clicks "Post Anyway"
   * @param {Function} onCancel - Callback if user clicks "Go Back"
   */
  showWarningModal(evaluation, subreddit, submissionType, settings, onProceed, onCancel) {
    if (typeof settings === 'function') {
      // Backward compatibility if settings parameter omitted
      onCancel = onProceed;
      onProceed = settings;
      settings = {};
    }

    // Remove existing modal if any
    const existing = document.getElementById('rs-warning-modal-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'rs-warning-modal-host';
    const shadow = host.attachShadow({ mode: 'open' });

    // Link styles into shadow root
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .rs-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(10, 14, 23, 0.8); backdrop-filter: blur(4px);
        z-index: 2147483647; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #e2e8f0;
      }
      .rs-modal-card {
        background: #1a202c; border: 1px solid #2d3748; border-radius: 12px;
        width: 92%; max-width: 540px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
        box-sizing: border-box;
      }
      .rs-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid #2d3748; padding-bottom: 12px; margin-bottom: 16px;
      }
      .rs-modal-title { font-size: 18px; font-weight: 700; color: #f7fafc; display: flex; align-items: center; gap: 8px; }
      .rs-badge-not-met { background: #e53e3e; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; }
      .rs-badge-warning { background: #dd6b20; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; }
      .rs-check-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; max-height: 260px; overflow-y: auto; }
      .rs-check-item { background: #2d3748; border-radius: 8px; padding: 12px; border-left: 4px solid #4a5568; }
      .rs-check-item.pass { border-left-color: #38a169; }
      .rs-check-item.not_met { border-left-color: #e53e3e; }
      .rs-check-item.conflict { border-left-color: #dd6b20; }
      .rs-check-item.caution { border-left-color: #ecc94b; }
      .rs-check-title { font-weight: 600; font-size: 14px; color: #edf2f7; display: flex; justify-content: space-between; }
      .rs-check-detail { font-size: 13px; color: #cbd5e0; margin-top: 4px; line-height: 1.4; }
      .rs-confidence { font-size: 11px; color: #a0aec0; margin-top: 4px; font-style: italic; }
      .rs-disclaimer { background: #2a4365; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #bee3f8; margin-bottom: 18px; line-height: 1.4; }
      .rs-actions { display: flex; justify-content: flex-end; gap: 10px; }
      .rs-btn { padding: 9px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; }
      .rs-btn-back { background: #4a5568; color: #edf2f7; }
      .rs-btn-back:hover { background: #718096; }
      .rs-btn-proceed { background: #ff4500; color: #ffffff; }
      .rs-btn-proceed:hover { background: #e03d00; }
    `;

    shadow.appendChild(styleEl);

    const badgeClass = evaluation.hasNotMet ? 'rs-badge-not-met' : 'rs-badge-warning';
    const badgeText = evaluation.hasNotMet ? 'REQUIREMENT NOT MET' : 'POSSIBLE RULE CONFLICT';

    const checksHtml = evaluation.checks.map(c => {
      let itemClass = 'pass';
      if (c.level === WARNING_LEVELS.NOT_MET) itemClass = 'not_met';
      else if (c.level === WARNING_LEVELS.CONFLICT) itemClass = 'conflict';
      else if (c.level === WARNING_LEVELS.CAUTION) itemClass = 'caution';

      return `
        <div class="rs-check-item ${itemClass}">
          <div class="rs-check-title">
            <span>${this.escapeHtml(c.title)}</span>
            <span>${this.escapeHtml(c.statusText || c.level)}</span>
          </div>
          ${c.detail ? `<div class="rs-check-detail">${this.escapeHtml(c.detail)}</div>` : ''}
          ${c.confidence ? `<div class="rs-confidence">Status: ${this.escapeHtml(c.confidence)}</div>` : ''}
        </div>
      `;
    }).join('');

    const modalContent = document.createElement('div');
    modalContent.className = 'rs-modal-overlay';
    modalContent.innerHTML = `
      <div class="rs-modal-card">
        <div class="rs-modal-header">
          <div class="rs-modal-title">
            <span>REDDIT ${submissionType.toUpperCase()} CHECK</span>
            <span class="${badgeClass}">${badgeText}</span>
          </div>
        </div>

        <div style="font-size:13px; color:#a0aec0; margin-bottom:12px;">
          Target Community: <strong>r/${this.escapeHtml(subreddit || 'community')}</strong>
        </div>

        <div class="rs-check-list">
          ${checksHtml}
        </div>

        <div class="rs-disclaimer">
          <strong>Notice:</strong> ${evaluation.hasNotMet ? 'This requirement appears not to be satisfied and may cause automatic removal.' : 'Review potential community rule conflicts before submitting.'}
        </div>

        <div class="rs-actions">
          <button type="button" class="rs-btn rs-btn-back" id="rs-btn-cancel">Go Back & Edit</button>
          ${settings && settings.protectionLevel === 'strict' && evaluation.hasNotMet ? `
            <button type="button" class="rs-btn" style="background:#718096; color:#a0aec0; cursor:not-allowed;" disabled title="Strict Mode Enabled: Unmet requirements block submission">Blocked (Strict Mode)</button>
          ` : `
            <button type="button" class="rs-btn rs-btn-proceed" id="rs-btn-proceed">Submit Anyway</button>
          `}
        </div>
      </div>
    `;

    shadow.appendChild(modalContent);

    shadow.getElementById('rs-btn-cancel').addEventListener('click', () => {
      host.remove();
      if (onCancel) onCancel();
    });

    const btnProceed = shadow.getElementById('rs-btn-proceed');
    if (btnProceed) {
      btnProceed.addEventListener('click', () => {
        host.remove();
        if (onProceed) onProceed();
      });
    }

    document.body.appendChild(host);
  },

  /**
   * Renders an inline banner showing that creation is currently disabled by user configuration.
   */
  injectDisabledBanner(targetContainer, type) {
    if (!targetContainer || targetContainer.dataset.rsDisabledBanner === 'true') return;
    targetContainer.dataset.rsDisabledBanner = 'true';

    const banner = document.createElement('div');
    banner.className = 'rs-disabled-banner';
    banner.innerHTML = `
      <span>🔒 ${type === 'post' ? 'Post' : 'Comment'} creation is disabled by Reddit Safety Extension settings.</span>
    `;
    
    // Insert as a sibling BEFORE the container (not inside it, for Shadow DOM compat)
    if (targetContainer.parentNode) {
      targetContainer.parentNode.insertBefore(banner, targetContainer);
    }
  },


  /**
   * Renders or updates a live inline safety & community guidance bar
   * adjacent to a comment box. We inject as a SIBLING (after the container)
   * because Reddit's shreddit-composer uses closed Shadow DOM.
   */
  renderCommentInlineGuide(container, subreddit, evaluation, settings, isCommentAllowed, accountInfo) {
    if (!container) return;

    // 1. Clean up any orphaned inline guides globally
    document.querySelectorAll('.rs-comment-inline-guide').forEach(g => {
      // If a guide's previous sibling is NOT a known comment area, it's an orphan
      const prev = g.previousElementSibling;
      const isKnownContainer = prev && (
        prev.matches('shreddit-composer, shreddit-comment-tree, [bundlename*="comment"], .commentarea, form') || 
        prev.querySelector('[placeholder]') || 
        prev.hasAttribute('placeholder')
      );
      // Don't delete the floating fallback guide itself
      if (!isKnownContainer && g.parentElement && g.id !== 'rs-floating-comment-guide') {
        g.remove();
      }
    });

    const guideId = 'rs-guide-' + (container.id || Math.random().toString(36).substr(2, 6));

    // 2. Strictly check if the IMMEDIATE next sibling is our guide
    let guide = null;
    if (container.id === 'rs-floating-comment-guide') {
      guide = container;
      if (!guide.querySelector('.rs-comment-inline-guide-inner')) {
        const inner = document.createElement('div');
        inner.className = 'rs-comment-inline-guide-inner';
        guide.appendChild(inner);
      }
      guide = guide.querySelector('.rs-comment-inline-guide-inner');
    } else {
      const nextSibling = container.nextElementSibling;
      if (nextSibling && nextSibling.classList.contains('rs-comment-inline-guide')) {
        guide = nextSibling;
      }
    }

    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'rs-comment-inline-guide';
      guide.id = guideId;

      // Insert strictly AFTER the container as a sibling
      if (container.nextSibling) {
        container.parentNode.insertBefore(guide, container.nextSibling);
      } else if (container.parentNode) {
        container.parentNode.appendChild(guide);
      } else {
        document.body.appendChild(guide);
      }
    }

    const subName = subreddit ? `r/${this.escapeHtml(subreddit)}` : 'Community';
    
    // Build user stats string
    let statsString = '';
    if (accountInfo) {
      const ageStr = accountInfo.accountAgeDays !== null ? `${accountInfo.accountAgeDays}d` : 'Unknown';
      const karmaStr = accountInfo.combinedKarma !== null ? accountInfo.combinedKarma : 'Unknown';
      let usernameStr = '';
      if (accountInfo.username) {
        usernameStr = ` • u/${this.escapeHtml(accountInfo.username)}`;
      } else if (settings && settings.useManualProfile && settings.manualUsername) {
        usernameStr = ` • u/${this.escapeHtml(settings.manualUsername)}`;
      }
      statsString = `<div style="margin-top: 6px; font-size: 12px; opacity: 0.8;">Detected Stats${usernameStr}: Age ${ageStr} • Karma ${karmaStr}</div>`;
    }

    if (!isCommentAllowed) {
      guide.className = 'rs-comment-inline-guide disabled';
      guide.id = guide.id || guideId;
      guide.innerHTML = `
        <div class="rs-inline-header">
          <span class="rs-inline-title" style="color: #fca5a5;">🔒 Comment Creation Disabled</span>
          <span class="rs-inline-badge disabled">Locked</span>
        </div>
        <div class="rs-inline-details">
          Comment submissions are currently locked by your extension safety settings.
        </div>
        <button type="button" class="rs-inline-btn rs-btn-enable-comment-temp">Temporarily Enable (1 Hour)</button>
      `;

      const tempBtn = guide.querySelector('.rs-btn-enable-comment-temp');
      if (tempBtn && !tempBtn.dataset.rsListening) {
        tempBtn.dataset.rsListening = 'true';
        tempBtn.addEventListener('click', async () => {
          const until = Date.now() + (3600 * 1000);
          await StorageManager.updateSettings({ tempCommentEnableUntil: until });
          if (typeof PostChecker !== 'undefined') {
            PostChecker.updateSettings(await StorageManager.getSettings());
          }
        });
      }
      return;
    }

    const hasWarnings = evaluation && (evaluation.hasNotMet || evaluation.hasConflict);

    if (hasWarnings) {
      guide.className = 'rs-comment-inline-guide warning';
      guide.id = guide.id || guideId;
      guide.innerHTML = `
        <div class="rs-inline-header">
          <span class="rs-inline-title" style="color:#fde047;">⚠️ ${subName} Comment Guidance</span>
          <span class="rs-inline-badge warning">Review Guidelines</span>
        </div>
        <div class="rs-inline-details">
          ${evaluation.summary || 'Potential rule conflicts or community requirements detected.'}
          ${statsString}
        </div>
      `;
    } else {
      guide.className = 'rs-comment-inline-guide';
      guide.id = guide.id || guideId;
      guide.innerHTML = `
        <div class="rs-inline-header">
          <span class="rs-inline-title">🛡️ ${subName} Comment Safety</span>
          <span class="rs-inline-badge pass">✓ Ready to Submit</span>
        </div>
        <div class="rs-inline-details">
          Safety check active • Verify comments adhere to ${subName} community guidelines.
          ${statsString}
        </div>
      `;
    }
  },

  /**
   * Scans the DOM and injects inline "Block Subreddit" buttons into posts and subreddit headers.
   */
  injectInlineBlockButtons(settings) {
    if (!settings) return;
    const blockedSubs = settings.blockedSubreddits || [];

    // Helper to handle blocking
    const handleBlock = async (subreddit, btn) => {
      if (!subreddit) return;
      const sub = subreddit.toLowerCase().replace(/^r\//, '');
      
      const currentSettings = await StorageManager.getSettings();
      let currentBlocked = currentSettings.blockedSubreddits || [];
      
      if (!currentBlocked.includes(sub)) {
        currentBlocked.push(sub);
        await StorageManager.updateSettings({ blockedSubreddits: currentBlocked });
      }

      // Visually indicate success
      btn.innerText = '⛔ Blocked';
      btn.style.background = '#7f1d1d';
      btn.style.color = '#fca5a5';
      btn.style.borderColor = '#991b1b';

      // Immediately hide any posts from this subreddit in the current feed
      document.querySelectorAll('shreddit-post').forEach(post => {
        const postSub = post.getAttribute('subreddit-prefixed-name');
        if (postSub && postSub.toLowerCase() === `r/${sub}`) {
          post.style.display = 'none';
        }
      });

      // If we are currently ON the subreddit page, redirect to home
      if (window.location.pathname.toLowerCase().startsWith(`/r/${sub}/`)) {
        window.location.replace('https://www.reddit.com/?rs_blocked=sub');
      }
    };

    // 1. Inject into Feed Posts & Hovercards
    // We look for any link that looks like a subreddit link and has text like r/something
    const subLinks = Array.from(document.querySelectorAll('a[href^="/r/"]'));
    subLinks.forEach(link => {
      // Don't inject twice on the same link
      if (link.dataset.rsBlockBtnInjected === 'true') return;

      const subNameMatch = link.getAttribute('href').match(/^\/r\/([^\/]+)\/?$/i);
      if (!subNameMatch) return;
      const subName = subNameMatch[1].toLowerCase();

      // Ensure the link text actually contains the subreddit name (avoids injecting next to avatars or post titles)
      const linkText = (link.innerText || '').trim().toLowerCase();
      if (!linkText.includes(`r/${subName}`)) return;

      // Ensure we aren't in the popup/sidebar or irrelevant areas
      if (link.closest('#rs-warning-modal-host, .rs-comment-inline-guide')) return;

      if (blockedSubs.includes(subName)) {
        // If it's already blocked, just hide the post if it's in a post
        const parentPost = link.closest('shreddit-post');
        if (parentPost) parentPost.style.display = 'none';
        return;
      }

      const btn = document.createElement('button');
      btn.className = 'rs-inline-block-btn';
      btn.title = `Block r/${subName}`;
      btn.innerText = '⛔';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleBlock(subName, btn);
      });

      // Insert directly after the link
      link.parentElement.insertBefore(btn, link.nextSibling);
      link.dataset.rsBlockBtnInjected = 'true';
    });

    // 2. Inject into Subreddit Page Header (Main H1 Title)
    const subHeader = document.querySelector('shreddit-subreddit-header');
    if (subHeader && subHeader.dataset.rsBlockBtnInjected !== 'true') {
      const pathMatch = window.location.pathname.match(/^\/r\/([^\/]+)/i);
      if (pathMatch) {
        const subName = pathMatch[1].toLowerCase();
        
        // Find the h1 title element (it is usually in the light DOM with slot="title", or inside shadow root)
        const h1 = subHeader.querySelector('h1') || (subHeader.shadowRoot && subHeader.shadowRoot.querySelector('h1'));
        if (h1) {
          const btn = document.createElement('button');
          btn.className = 'rs-inline-block-btn header-btn';
          btn.innerText = '⛔ Block Subreddit';
          btn.style.marginLeft = '12px'; // Ensure some spacing from the H1 text
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBlock(subName, btn);
          });
          
          // Append the button inside or right after the H1
          h1.style.display = 'flex';
          h1.style.alignItems = 'center';
          h1.appendChild(btn);
          subHeader.dataset.rsBlockBtnInjected = 'true';
        }
      }
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}
