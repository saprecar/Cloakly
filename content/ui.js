/**
 * Cloakly
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
   * Shows a pre-submission warning modal for content matches (Sensitive info, keywords, rules).
   * 
   * @param {Array} matches - Array of match objects from ContentScanner
   * @param {string} originalText - The original text that was scanned
   * @param {Object} settings - User extension settings
   * @param {Function} onProceed - Callback if user clicks "Submit Anyway"
   * @param {Function} onCancel - Callback if user clicks "Go Back"
   * @param {Function} onAutoRemove - Callback to attempt automatic removal of detected text
   */
  showContentWarningModal(matches, originalText, settings, onProceed, onCancel, onAutoRemove) {
    const existing = document.getElementById('rs-content-warning-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'rs-content-warning-host';
    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .rs-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(10, 14, 23, 0.85); backdrop-filter: blur(4px);
        z-index: 2147483647; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #e2e8f0;
      }
      .rs-modal-card {
        background: #1a202c; border: 1px solid #2d3748; border-radius: 12px;
        width: 92%; max-width: 600px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
        box-sizing: border-box;
      }
      .rs-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid #2d3748; padding-bottom: 12px; margin-bottom: 16px;
      }
      .rs-modal-title { font-size: 18px; font-weight: 700; color: #f7fafc; display: flex; align-items: center; gap: 8px; }
      .rs-badge-danger { background: #e53e3e; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; }
      .rs-matches-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; max-height: 200px; overflow-y: auto; }
      .rs-match-item { background: #2d3748; border-radius: 8px; padding: 12px; border-left: 4px solid #dd6b20; }
      .rs-match-item.sensitive { border-left-color: #e53e3e; }
      .rs-match-item.rule { border-left-color: #d69e2e; }
      .rs-match-item.custom { border-left-color: #805ad5; }
      .rs-match-title { font-weight: 600; font-size: 14px; color: #edf2f7; margin-bottom: 6px; }
      .rs-match-text { background: #1a202c; padding: 6px 10px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #fc8181; display: inline-block; word-break: break-all; }
      .rs-disclaimer { background: #2a4365; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #bee3f8; margin-bottom: 18px; line-height: 1.4; }
      .rs-actions { display: flex; justify-content: flex-end; gap: 10px; }
      .rs-btn { padding: 9px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; }
      .rs-btn-back { background: #4a5568; color: #edf2f7; }
      .rs-btn-back:hover { background: #718096; }
      .rs-btn-remove { background: #d69e2e; color: #1a202c; }
      .rs-btn-remove:hover { background: #ecc94b; }
      .rs-btn-proceed { background: transparent; border: 1px solid #4a5568; color: #a0aec0; }
      .rs-btn-proceed:hover { background: #2d3748; color: #cbd5e0; }
    `;
    shadow.appendChild(styleEl);

    const matchesHtml = matches.map(m => {
      let itemClass = 'custom';
      if (m.category === 'SENSITIVE') itemClass = 'sensitive';
      else if (m.category === 'RULE') itemClass = 'rule';

      return `
        <div class="rs-match-item ${itemClass}">
          <div class="rs-match-title">${this.escapeHtml(m.reason)}</div>
          <div class="rs-match-text">${this.escapeHtml(m.text)}</div>
        </div>
      `;
    }).join('');

    const cpSettings = settings.contentProtection || {};
    const autoRemoveEnabled = !!cpSettings.autoRemove;

    const modalContent = document.createElement('div');
    modalContent.className = 'rs-modal-overlay';
    modalContent.innerHTML = `
      <div class="rs-modal-card">
        <div class="rs-modal-header">
          <div class="rs-modal-title">
            <span>CONTENT PROTECTION ALERT</span>
            <span class="rs-badge-danger">${matches.length} ISSUE(S) DETECTED</span>
          </div>
        </div>

        <div class="rs-matches-list">
          ${matchesHtml}
        </div>

        <div class="rs-disclaimer">
          <strong>Notice:</strong> We detected potentially sensitive information or restricted keywords in your text. Please review your content before posting to protect your privacy and comply with rules.
        </div>

        <div class="rs-actions">
          <button type="button" class="rs-btn rs-btn-proceed" id="rs-btn-proceed">Submit Anyway</button>
          ${autoRemoveEnabled ? `<button type="button" class="rs-btn rs-btn-remove" id="rs-btn-remove">Remove Matches & Submit</button>` : ''}
          <button type="button" class="rs-btn rs-btn-back" id="rs-btn-cancel">Go Back & Edit</button>
        </div>
      </div>
    `;

    shadow.appendChild(modalContent);

    shadow.getElementById('rs-btn-cancel').addEventListener('click', () => {
      host.remove();
      if (onCancel) onCancel();
    });

    shadow.getElementById('rs-btn-proceed').addEventListener('click', () => {
      host.remove();
      if (onProceed) onProceed();
    });

    const btnRemove = shadow.getElementById('rs-btn-remove');
    if (btnRemove) {
      btnRemove.addEventListener('click', () => {
        host.remove();
        if (onAutoRemove) onAutoRemove(matches);
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
      <span>🔒 ${type === 'post' ? 'Post' : 'Comment'} creation is disabled by Cloakly settings.</span>
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
  renderCommentInlineGuide(container, subreddit, evaluation, settings, isCommentAllowed, accountInfo, parsedRules) {
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

    let botSnippetsHtml = '';
    if (settings && settings.botSnippetsEnabled && settings.botSnippets && settings.botSnippets.length > 0) {
      const optionsHtml = settings.botSnippets.map(bot => 
        `<option value="${this.escapeHtml(bot.command)}">🤖 ${this.escapeHtml(bot.name)}</option>`
      ).join('');
      botSnippetsHtml = `
        <select class="rs-bot-snippet-select" style="background:#2d3748; color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; margin-right:8px; padding:2px 8px; font-size:11px; cursor: pointer; outline: none;">
          <option value="" disabled selected>🤖 Insert Bot ▼</option>
          ${optionsHtml}
        </select>
      `;
    }

    const hasWarnings = evaluation && (evaluation.hasNotMet || evaluation.hasConflict);

    if (hasWarnings) {
      guide.className = 'rs-comment-inline-guide warning';
      guide.id = guide.id || guideId;
      guide.innerHTML = `
        <div class="rs-inline-header">
          <span class="rs-inline-title" style="color:#fde047;">⚠️ ${subName} Comment Guidance</span>
          <div style="display: flex; align-items: center;">
            ${botSnippetsHtml}
            <button type="button" class="rs-inline-btn rs-btn-analyze" style="background:#4a5568; margin-right:8px; padding:2px 8px; font-size:11px;">🔍 Guideline Check</button>
            <span class="rs-inline-badge warning">Review Guidelines</span>
          </div>
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
          <div style="display: flex; align-items: center;">
            ${botSnippetsHtml}
            <button type="button" class="rs-inline-btn rs-btn-analyze" style="background:#4a5568; margin-right:8px; padding:2px 8px; font-size:11px;">🔍 Guideline Check</button>
            <span class="rs-inline-badge pass">✓ Ready to Submit</span>
          </div>
        </div>
        <div class="rs-inline-details">
          Safety check active • Verify comments adhere to ${subName} community guidelines.
          ${statsString}
        </div>
      `;
    }

    // Attach bot snippet listeners
    const botSelects = guide.querySelectorAll('.rs-bot-snippet-select');
    botSelects.forEach(selectEl => {
      if (!selectEl.dataset.rsListening) {
        selectEl.dataset.rsListening = 'true';
        selectEl.addEventListener('change', () => {
          const command = selectEl.value;
          if (!command) return;
          selectEl.value = ''; // Reset dropdown
          const composer = guide.previousElementSibling;
          let textEl = null;
          
          if (composer) {
            const textEls = typeof RedditDetector !== 'undefined' ? RedditDetector.queryDeepAll('textarea, [contenteditable="true"], [role="textbox"]', composer) : [];
            textEl = textEls.length > 0 ? textEls[0] : composer.querySelector('textarea, [contenteditable="true"]');
            
            if (textEl) {
              if (textEl.tagName === 'TEXTAREA') {
                textEl.value = textEl.value ? textEl.value + '\\n' + command : command;
              } else {
                // Focus the editable div
                textEl.focus();
                
                // Attempt to insert text securely into modern rich-text editors (Lexical/Tiptap)
                try {
                  const root = textEl.getRootNode();
                  const selection = (root && root.getSelection) ? root.getSelection() : window.getSelection();
                  
                  // Force selection to the end of the text box if focus was lost or outside
                  if (!selection || selection.rangeCount === 0 || !textEl.contains(selection.focusNode)) {
                    const range = document.createRange();
                    range.selectNodeContents(textEl);
                    range.collapse(false); // collapse to end
                    if (selection) {
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  }
                  
                  // Use native insertText so the editor's internal state captures it
                  const success = document.execCommand('insertText', false, command + ' ');
                  if (!success) {
                    // Fallback to paste event
                    const dt = new DataTransfer();
                    dt.setData('text/plain', command + ' ');
                    textEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
                  }
                } catch (e) {
                  // Fallback for strict shadow DOMs
                  const dt = new DataTransfer();
                  dt.setData('text/plain', command + ' ');
                  textEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
                }
              }
              // Trigger input events
              textEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              textEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              // For React/Lexical
              textEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Space', code: 'Space' }));
            }
          }
        });
      }
    });

    const analyzeBtn = guide.querySelector('.rs-btn-analyze');
    if (analyzeBtn && !analyzeBtn.dataset.rsListening) {
      analyzeBtn.dataset.rsListening = 'true';
      analyzeBtn.addEventListener('click', () => {
        // Find nearest text box
        const composer = guide.previousElementSibling;
        let text = '';
        let textEl = null;

        if (composer) {
          const textEls = typeof RedditDetector !== 'undefined' ? RedditDetector.queryDeepAll('textarea, [contenteditable="true"], [role="textbox"]', composer) : [];
          textEl = textEls.length > 0 ? textEls[0] : composer.querySelector('textarea, [contenteditable="true"]');
          if (textEl) {
            text = textEl.value || textEl.innerText || textEl.textContent || '';
          }
        }

        const fullTextToScan = text;
        const contentMatches = (typeof ContentScanner !== 'undefined') ? ContentScanner.scan(fullTextToScan, settings, parsedRules) : [];

        if (contentMatches.length > 0) {
          UIManager.showContentWarningModal(
            contentMatches,
            fullTextToScan,
            settings,
            () => {}, // Just close
            () => {}, // cancel
            (matches) => {
              // Auto Remove
              try {
                if (textEl) {
                  let currentText = textEl.value !== undefined ? textEl.value : textEl.innerText;
                  if (currentText) {
                    matches.forEach(m => {
                      currentText = currentText.replace(m.text, '***');
                    });
                    if (textEl.value !== undefined) {
                      textEl.value = currentText;
                    } else {
                      textEl.innerText = currentText;
                    }
                    textEl.dispatchEvent(new Event('input', { bubbles: true }));
                    textEl.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              } catch (e) {
                Logger.log('Auto-remove failed', e);
              }
            }
          );
        } else {
          analyzeBtn.innerText = '✅ All Good!';
          analyzeBtn.style.background = '#38a169';
          setTimeout(() => {
            if (analyzeBtn) {
              analyzeBtn.innerText = '🔍 Guideline Check';
              analyzeBtn.style.background = '#4a5568';
            }
          }, 3000);
        }
      });
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

      // FilterManager will automatically catch the storage update, but to make it feel INSTANT
      // without waiting for the background sync, we force a scan immediately!
      if (typeof FilterManager !== 'undefined') {
        currentSettings.blockedSubreddits = currentBlocked;
        FilterManager.scanAndApply(currentSettings);
      }

      // If we are currently ON the subreddit page, redirect to home
      if (window.location.pathname.toLowerCase().startsWith(`/r/${sub}/`)) {
        window.location.replace('/?rs_blocked=sub');
      }
    };

    // Helper to inject a button after a target element
    const injectBtn = (target, subName, isHeader = false) => {
      if (target.dataset.rsBlockBtnInjected === 'true') return;
      if (target.parentElement && target.parentElement.querySelector('.rs-inline-block-btn')) return;
      if (blockedSubs.includes(subName)) return;

      const btn = document.createElement('button');
      btn.className = 'rs-inline-block-btn' + (isHeader ? ' header-btn' : '');
      btn.title = `Block r/${subName}`;
      btn.innerText = isHeader ? '⛔ Block Subreddit' : '⛔';
      
      if (isHeader) {
        btn.style.marginLeft = '12px';
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleBlock(subName, btn);
      }, true);

      // Fix for sidebar or other block-level wrappers: make parent flex so it doesn't wrap to a new line
      if (!isHeader && target.parentElement) {
        const parentStyle = window.getComputedStyle(target.parentElement);
        if (parentStyle.display === 'block' || parentStyle.display === 'list-item') {
          target.parentElement.style.display = 'flex';
          target.parentElement.style.alignItems = 'center';
        }
      }

      target.parentElement.insertBefore(btn, target.nextSibling);
      target.dataset.rsBlockBtnInjected = 'true';
    };

    // 1. Inject into Feed Posts & Hovercards & Sidebar
    // Collect all links that contain /r/ (handles absolute URLs too)
    const allLinks = Array.from(document.querySelectorAll('a[href*="/r/"]'));
    document.querySelectorAll('shreddit-post').forEach(post => {
      if (post.shadowRoot) {
        allLinks.push(...post.shadowRoot.querySelectorAll('a[href*="/r/"]'));
      }
    });

    allLinks.forEach(link => {
      if (link.dataset.rsBlockBtnInjected === 'true') return;

      const href = link.getAttribute('href');
      // Match /r/SubName or https://reddit.com/r/SubName
      const subNameMatch = href.match(/\/r\/([^\/]+)\/?$/i);
      if (!subNameMatch) return;
      const subName = subNameMatch[1].toLowerCase();

      // Ensure the link text actually contains the subreddit name OR is a dedicated span
      const linkText = (link.textContent || '').trim().toLowerCase();
      // Allow if it explicitly contains the sub name, or if it has an inner span containing the sub name
      if (!linkText.includes(`r/${subName}`) && !linkText.includes(subName)) return;

      // Avoid irrelevant areas
      if (link.closest('#rs-warning-modal-host, .rs-comment-inline-guide')) return;

      if (blockedSubs.includes(subName)) {
        const parentPost = link.closest('shreddit-post');
        if (parentPost) parentPost.style.display = 'none';
        return;
      }

      injectBtn(link, subName, false);
    });

    // 2. Inject into Subreddit Page Header (Main Title)
    // Don't rely on shreddit-subreddit-header being present, just find the H1 directly
    const pathMatch = window.location.pathname.match(/^\/r\/([^\/]+)/i);
    if (pathMatch) {
      const subName = pathMatch[1].toLowerCase();
      
      const allH1s = Array.from(document.querySelectorAll('h1'));
      // also check shadow roots of generic containers if needed
      document.querySelectorAll('shreddit-subreddit-header, shreddit-profile, [id^="subreddit-"]').forEach(el => {
        if (el.shadowRoot) {
          allH1s.push(...el.shadowRoot.querySelectorAll('h1'));
        }
      });

      const titleEl = allH1s.find(h1 => {
        const text = (h1.textContent || '').toLowerCase().trim();
        return text === `r/${subName}` || text === subName || text.includes(`r/${subName}`);
      });
      
      if (titleEl && titleEl.dataset.rsBlockBtnInjected !== 'true') {
        if (titleEl.style) {
          titleEl.style.display = 'inline-flex';
          titleEl.style.alignItems = 'center';
        }
        injectBtn(titleEl, subName, true);
      }
    }
  },

  /**
   * Scans for OP, Commenters, and Chat users to inject stats badges.
   * Uses global document scanning (like block buttons) to bypass closed shadow DOM.
   * Returns a list of usernames that need their data fetched.
   */
  injectUserStats(settings, userStatsCache) {
    if (!settings || !settings.showOtherUserStats) return [];
    
    const neededUsers = new Set();
    const myUsername = (settings.lastDetectedUser && settings.lastDetectedUser.username) ? settings.lastDetectedUser.username.toLowerCase() : '';
    
    // 1. Build a set of relevant usernames from post authors and commenters
    //    (to avoid badging every random user link on the page)
    const relevantUsernames = new Set();
    
    document.querySelectorAll('shreddit-post').forEach(post => {
      const author = post.getAttribute('author');
      if (author) relevantUsernames.add(author.toLowerCase());
    });
    
    document.querySelectorAll('shreddit-comment').forEach(comment => {
      const author = comment.getAttribute('author');
      if (author) relevantUsernames.add(author.toLowerCase());
    });

    // 2. Scan ALL user links globally in the document (bypasses closed shadow DOM)
    const authorNodes = [];
    const allUserLinks = Array.from(document.querySelectorAll('a[href*="/user/"], a[href*="/u/"]'));
    
    // Also check inside any open shadow roots
    document.querySelectorAll('shreddit-post, shreddit-comment, faceplate-hovercard').forEach(el => {
      if (el.shadowRoot) {
        allUserLinks.push(...el.shadowRoot.querySelectorAll('a[href*="/user/"], a[href*="/u/"]'));
      }
    });

    allUserLinks.forEach(link => {
      if (link.dataset.rsUserStatsInjected === 'true') return;
      
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/(?:user|u)\/([a-zA-Z0-9_\-]+)/i);
      if (!match) return;
      const username = match[1];
      const userLower = username.toLowerCase();
      
      // Only badge users who are OP or commenters (rate-limit protection)
      if (relevantUsernames.size > 0 && !relevantUsernames.has(userLower)) return;
      
      // Skip self
      if (userLower === myUsername) return;
      // Skip system/special names
      if (['me', 'login', 'signup', 'submit', 'avatar', 'deleted', 'automoderator'].includes(userLower)) return;
      
      // Skip irrelevant areas (our own UI)
      if (link.closest('#rs-warning-modal-host, .rs-comment-inline-guide, .rs-inline-block-btn')) return;
      
      // Skip if already has a badge sibling
      if (link.parentElement && link.parentElement.querySelector('.rs-user-stats-badge')) return;
      
      // Skip avatar-only links (links that contain images/svg but no visible text)
      const linkText = (link.textContent || '').trim();
      if (!linkText || linkText.length < 2) return;
      if (link.querySelector('img, svg, faceplate-img, shreddit-async-loader')) return;
      
      // Must look like a username display (contains the username text)
      if (!linkText.toLowerCase().includes(userLower) && 
          !linkText.toLowerCase().startsWith('u/')) return;
      
      authorNodes.push({ username, node: link });
    });

    // 3. Chat support (chat.reddit.com uses different structure)
    if (window.location.hostname.includes('chat.reddit.com')) {
      // Chat usernames in spans/divs with 'username' class
      document.querySelectorAll('span, h2, h3, div').forEach(el => {
        if (el.dataset.rsUserStatsInjected === 'true') return;
        if (el.className && typeof el.className === 'string' && el.className.toLowerCase().includes('username')) {
          const text = el.textContent.trim();
          if (text && !text.includes(' ') && text.length > 2) {
            authorNodes.push({ username: text, node: el });
          }
        }
      });
    }

    // 4. Process collected nodes
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    authorNodes.forEach(({ username, node }) => {
      if (node.dataset.rsUserStatsInjected === 'true') return;
      const userLower = username.toLowerCase();

      const cached = userStatsCache.get(userLower);
      
      if (cached === undefined) {
        // Not fetched yet - ONLY queue if near viewport
        const rect = node.getBoundingClientRect();
        if (rect.top >= -1000 && rect.bottom <= windowHeight + 1000) {
          neededUsers.add(userLower); // Always lowercase for cache consistency
        }
        return;
      }
      
      if (cached === null || cached.rateLimited) {
        node.dataset.rsUserStatsInjected = 'true';
        return;
      }

      // Build badge content
      const badge = document.createElement('span');
      badge.className = 'rs-user-stats-badge';
      
      const parts = [];
      if (settings.showOtherUserAge && cached.accountAgeDays !== null) {
        const years = Math.floor(cached.accountAgeDays / 365);
        const days = cached.accountAgeDays % 365;
        parts.push(years > 0 ? `${years}y` : `${days}d`);
      }
      if (settings.showOtherUserKarma && cached.combinedKarma !== null) {
        const k = cached.combinedKarma;
        parts.push(k > 999 ? (k/1000).toFixed(1) + 'k' : k);
      }
      
      if (parts.length > 0) {
        badge.innerText = `📊 ${parts.join(' | ')}`;
        
        // Insert as sibling to avoid CSS truncation (same approach as block buttons)
        const parent = node.parentElement;
        if (parent) {
          const parentStyle = window.getComputedStyle(parent);
          if (parentStyle.display === 'block' || parentStyle.display === 'list-item') {
            parent.style.display = 'flex';
            parent.style.alignItems = 'center';
          }
          parent.insertBefore(badge, node.nextSibling);
        } else {
          node.appendChild(badge);
        }
      }
      
      node.dataset.rsUserStatsInjected = 'true';
    });
    
    return Array.from(neededUsers);
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
