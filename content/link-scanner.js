/**
 * Reddit Privacy & Posting Safety Extension
 * Link Scanner - Detects misleading and hidden link destinations
 */

const LinkScanner = {
  _initialized: false,
  _observer: null,
  settings: null,

  async init() {
    if (this._initialized) return;
    this.settings = await (typeof StorageManager !== 'undefined' ? StorageManager.getSettings() : { linkProtection: { enabled: false } });
    
    if (!this.settings?.linkProtection?.enabled) return;

    this.attachDelegation();
    this.startObserver();
    this.scanLinks(document.body);
    
    this._initialized = true;
    if (typeof Logger !== 'undefined') Logger.log('LinkScanner initialized.');
  },

  updateSettings(settings) {
    this.settings = settings;
    if (!this.settings?.linkProtection?.enabled) {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      this.clearHighlights();
    } else {
      if (!this._observer) this.startObserver();
      this.scanLinks(document.body);
    }
  },

  /**
   * Cleans up URL for comparison (removes protocol, www, trailing slashes, and paths)
   */
  extractDomain(url) {
    try {
      if (!url.startsWith('http')) {
        // Assume it might be just "example.com"
        url = 'https://' + url;
      }
      const parsed = new URL(url);
      let domain = parsed.hostname.toLowerCase();
      if (domain.startsWith('www.')) domain = domain.substring(4);
      return domain;
    } catch (e) {
      return null;
    }
  },

  /**
   * Determines if text looks like a URL/Domain.
   * We don't want to flag "Check out this deal" as a mismatch.
   */
  looksLikeDomain(text) {
    text = text.trim().toLowerCase();
    // Remove protocol and www if present in text
    text = text.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    // Very basic regex for something that looks like domain.tld
    // Must contain a dot, no spaces, and end with a valid-ish TLD
    return /^[a-z0-9][a-z0-9-_.]*\.[a-z]{2,24}(\/.*)?$/i.test(text);
  },

  /**
   * Detects if the link is a known tracking redirect that shouldn't be blocked
   * e.g. outbound.reddit.com
   */
  isKnownSafeRedirect(hrefDomain) {
    const safeDomains = ['outbound.reddit.com', 'reddit.com', 'redd.it'];
    return safeDomains.some(d => hrefDomain.endsWith(d));
  },

  /**
   * Check if link is misleading.
   * Returns { isMisleading: boolean, visibleText: string, actualHref: string, reason: string }
   */
  analyzeLink(a) {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
      return { isMisleading: false };
    }

    const visibleText = (a.innerText || a.textContent || '').trim();
    if (!visibleText) return { isMisleading: false };

    // Does the visible text look like a domain?
    if (!this.looksLikeDomain(visibleText)) {
      return { isMisleading: false };
    }

    const textDomain = this.extractDomain(visibleText);
    const hrefDomain = this.extractDomain(href);

    if (!textDomain || !hrefDomain) return { isMisleading: false };

    // Ignore if they match
    if (textDomain === hrefDomain || hrefDomain.endsWith('.' + textDomain) || textDomain.endsWith('.' + hrefDomain)) {
      return { isMisleading: false };
    }

    // Ignore known safe Reddit redirects
    if (this.isKnownSafeRedirect(hrefDomain)) {
      // Technically Reddit outbound wraps the real URL in a query param
      try {
        const parsed = new URL(href, window.location.href);
        const realUrl = parsed.searchParams.get('url');
        if (realUrl) {
          const realDomain = this.extractDomain(realUrl);
          if (realDomain && (textDomain === realDomain || realDomain.endsWith('.' + textDomain))) {
            return { isMisleading: false };
          } else {
            return {
              isMisleading: true,
              visibleText: textDomain,
              actualHref: realDomain || realUrl,
              reason: 'Domain mismatch inside redirect'
            };
          }
        }
      } catch (e) {}
    }

    return {
      isMisleading: true,
      visibleText: textDomain,
      actualHref: hrefDomain,
      fullHref: href,
      reason: 'Visible domain does not match destination'
    };
  },

  /**
   * Scans elements for misleading links and highlights them if setting is enabled.
   */
  scanLinks(root) {
    if (!this.settings?.linkProtection?.highlightSuspicious) return;

    // Use queryDeepAll if available to pierce Shadow DOM (useful for Shreddit)
    const links = (typeof RedditDetector !== 'undefined' && RedditDetector.queryDeepAll) 
      ? RedditDetector.queryDeepAll('a[href]', root)
      : Array.from(root.querySelectorAll('a[href]'));

    for (const a of links) {
      if (a.dataset.rsLinkScanned) continue;
      a.dataset.rsLinkScanned = 'true';

      const analysis = this.analyzeLink(a);
      if (analysis.isMisleading) {
        a.classList.add('rs-suspicious-link');
        
        // Add visual indicator
        const warning = document.createElement('span');
        warning.innerHTML = '⚠️';
        warning.className = 'rs-link-warning-icon';
        warning.style.cssText = 'margin-left:4px; font-size:0.9em; cursor:help;';
        
        if (this.settings.linkProtection.showDestinationHover) {
          warning.title = `Warning: This link actually goes to ${analysis.actualHref}`;
          // Optionally update the link's own title
          if (!a.getAttribute('title')) {
            a.setAttribute('title', `Destination: ${analysis.actualHref}`);
          }
        }
        
        // Append icon
        if (!a.querySelector('.rs-link-warning-icon')) {
          a.appendChild(warning);
        }
      }
    }
  },

  clearHighlights() {
    document.querySelectorAll('.rs-suspicious-link').forEach(a => {
      a.classList.remove('rs-suspicious-link');
      const icon = a.querySelector('.rs-link-warning-icon');
      if (icon) icon.remove();
      a.removeAttribute('data-rs-link-scanned');
    });
  },

  startObserver() {
    if (this._observer) return;
    this._observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        // Debounce scan
        clearTimeout(this._scanTimer);
        this._scanTimer = setTimeout(() => {
          this.scanLinks(document.body);
        }, 300);
      }
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  },

  /**
   * Document-level click listener to intercept clicks on suspicious links.
   */
  attachDelegation() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;

      const lp = this.settings?.linkProtection;
      if (!lp || !lp.enabled) return;
      if (!lp.warnBeforeOpen && !lp.blockSuspicious) return;

      const analysis = this.analyzeLink(a);
      if (!analysis.isMisleading) return;

      // Handle block
      if (lp.blockSuspicious) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Show blocked toast
        this.showToast('⛔ Link Blocked: The visible destination does not match the actual destination.', '#ef4444');
        return;
      }

      // Handle warn
      if (lp.warnBeforeOpen && a.dataset.rsApproved !== 'true') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Show warning modal
        if (typeof UIManager !== 'undefined' && UIManager.showContentWarningModal) {
          const fakeMatches = [{
            category: 'MISLEADING_LINK',
            reason: `The visible link is <b>${analysis.visibleText}</b>, but it actually goes to <b>${analysis.actualHref}</b>.`,
            text: a.innerText
          }];
          
          UIManager.showContentWarningModal(
            fakeMatches,
            '', // fullText
            this.settings,
            () => {
              // Proceed callback
              a.dataset.rsApproved = 'true';
              a.click();
            },
            () => {}, // cancel
            null, // autoRemove
            true // isLinkWarning flag for modal styling if needed
          );
        } else {
          // Fallback if UIManager not loaded
          if (confirm(`Warning: This link's visible text does not match its destination.\n\nVisible: ${analysis.visibleText}\nActual: ${analysis.actualHref}\n\nDo you want to continue to this site?`)) {
            a.dataset.rsApproved = 'true';
            a.click();
          }
        }
      }
    }, true); // Capture phase
  },

  showToast(msg, bgColor) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:${bgColor}; color:white; padding:12px 24px; border-radius:8px; font-weight:bold; z-index:2147483647; font-family:sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
};

// Initialize if not in a module environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkScanner;
} else if (typeof window !== 'undefined') {
  // Wait for StorageManager to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => LinkScanner.init(), 500));
  } else {
    setTimeout(() => LinkScanner.init(), 500);
  }
}
