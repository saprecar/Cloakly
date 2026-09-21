/**
 * Reddit Privacy & Posting Safety Extension
 * Media Blur & Reveal Manager
 */

const BlurManager = {
  /**
   * Applies blur logic to a single post container based on user settings.
   */
  processPost(postEl, settings) {
    if (!postEl) return;
    
    // If user already revealed this post, do not blur any newly loaded images in it (e.g. galleries)
    if (postEl.dataset.rsTemporarilyRevealed === 'true' && !settings.keepRevealed) return;

    // --- AUTO-REVEAL NATIVE BLURS LOGIC (WEB COMPONENT BYPASS) ---
    if (settings.autoRevealNative) {
      const nativeBlurContainers = RedditDetector.queryDeepAll('shreddit-blurred-container, devvit2-blur-gate, community-highlight-card, .nsfw-prompt, .blur-overlay', postEl);
      if (nativeBlurContainers.length > 0) {
        
        nativeBlurContainers.forEach(container => {
           // Assign a unique ID to find this exact container in the main world
           const uniqueId = 'rs-blur-' + Math.random().toString(36).substr(2, 9);
           container.setAttribute('data-rs-auto-id', uniqueId);
           
           // Inject a tiny script to toggle the Lit web component properties natively
           const script = document.createElement('script');
           script.textContent = `
             (function() {
                 var c = document.querySelector('[data-rs-auto-id="${uniqueId}"]');
                 if (c) {
                    // Exploit Lit reactive properties to natively reveal without clicking
                    c.blurred = false;
                    c.isBlurred = false;
                    c._blur = false;
                    c.revealed = true;
                    c.removeAttribute('reason'); // Reddit's new enforcement
                    
                    // Cleanup
                    c.removeAttribute('data-rs-auto-id');
                 }
             })();
           `;
           document.documentElement.appendChild(script);
           script.remove();
        });

        postEl.dataset.rsTemporarilyRevealed = 'true';
        return; // Extension blur bypassed!
      }
    }
    // ----------------------------------------------------------------
    // --------------------------------------

    const { isNSFW, isSpoiler } = RedditDetector.getPostFlags(postEl);

    const shouldBlurNSFW = isNSFW && settings.nsfwProtection;
    const shouldBlurSpoiler = isSpoiler && settings.spoilerProtection;

    if (!shouldBlurNSFW && !shouldBlurSpoiler) return;

    const mediaElements = RedditDetector.findMediaElements(postEl);
    if (mediaElements.length === 0) return;

    const intensityClass = `rs-blur-${settings.blurIntensity || 'medium'}`;

    mediaElements.forEach(media => {
      if (media.dataset.rsBlurred === 'true') return;
      const isThumbnail = media.classList.contains('thumbnail') || !!media.closest('.thumbnail');
      const isVideo = media.tagName === 'VIDEO' || media.tagName === 'SHREDDIT-PLAYER';
      const isGif = media.src && /\.gif/i.test(media.src);

      if (isThumbnail && settings.blurThumbnails === false) return;
      if (isVideo && settings.blurVideos === false) return;
      if (isGif && settings.blurGifs === false) return;
      if (!isVideo && !isGif && !isThumbnail && settings.blurImages === false) return;

      this.applyBlurToElement(media, {
        isNSFW,
        isSpoiler,
        intensityClass,
        revealMethod: settings.revealMethod || 'click',
        keepRevealed: settings.keepRevealed
      });
    });
  },

  /**
   * Applies blur filter class and mounts Reveal Overlay.
   */
  applyBlurToElement(mediaEl, options) {
    if (mediaEl.dataset.rsBlurred === 'true') return;
    mediaEl.dataset.rsBlurred = 'true';

    // Apply CSS blur class
    mediaEl.classList.add(options.intensityClass);

    // Parent container setup
    let container = mediaEl.parentElement;
    if (container && !container.classList.contains('rs-blur-container')) {
      container.classList.add('rs-blur-container');
    } else {
      container = mediaEl;
    }

    if (options.revealMethod === 'hover') {
      container.classList.add('rs-hover-reveal');
    }

    // Mount reveal button overlay
    const overlay = document.createElement('div');
    overlay.className = 'rs-reveal-overlay';

    let tagHtml = '';
    if (options.isNSFW) tagHtml += `<span class="rs-tag-badge rs-tag-nsfw">NSFW</span>`;
    if (options.isSpoiler) tagHtml += `<span class="rs-tag-badge rs-tag-spoiler">SPOILER</span>`;

    overlay.innerHTML = `
      <div style="display:flex; gap:4px; margin-bottom:4px;">${tagHtml}</div>
      <button type="button" class="rs-reveal-button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Reveal Content
      </button>
    `;

    const revealBtn = overlay.querySelector('.rs-reveal-button');
    revealBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 1. Remove our extension's blur from THIS element
      mediaEl.classList.remove('rs-blur-low', 'rs-blur-medium', 'rs-blur-high');
      
      // 2. Force remove CSS filters just in case Reddit natively applied them to the image/media
      mediaEl.style.setProperty('filter', 'none', 'important');
      
      // 3. Look for Reddit's native NSFW blur containers (like <shreddit-blurred-container>)
      const nativeBlurContainer = container.closest('shreddit-blurred-container') || container.querySelector('shreddit-blurred-container');
      if (nativeBlurContainer) {
         nativeBlurContainer.style.setProperty('filter', 'none', 'important');
         nativeBlurContainer.style.setProperty('backdrop-filter', 'none', 'important');
         
         // Trigger web component state change by removing the reason attribute
         nativeBlurContainer.removeAttribute('reason');
         
         // Reddit sometimes requires a strict sequence of pointer/mouse events in Firefox to fetch the high-res image
         const nativeBtn = nativeBlurContainer.querySelector('button');
         if (nativeBtn) {
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
               nativeBtn.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
            });
         }
      }

      // Completely remove our overlay to force a layout repaint in Firefox
      overlay.remove();

      if (!options.keepRevealed) {
        mediaEl.dataset.rsTemporarilyRevealed = 'true';
        const post = mediaEl.closest('.Post, shreddit-post');
        if (post) {
           post.dataset.rsTemporarilyRevealed = 'true';
           // Also unblur any OTHER images in this same gallery/post!
           post.querySelectorAll('.rs-reveal-overlay').forEach(o => o.remove());
           post.querySelectorAll('.rs-blur-low, .rs-blur-medium, .rs-blur-high').forEach(el => {
              el.classList.remove('rs-blur-low', 'rs-blur-medium', 'rs-blur-high');
              el.style.setProperty('filter', 'none', 'important');
           });
        }
      }
    });

    container.appendChild(overlay);
  },

  /**
   * Scans and applies blur filters to all post containers on page.
   */
  scanAndApply(settings) {
    // 1. Clean up any orphan overlays (where Reddit replaced the blurred image but left the container)
    document.querySelectorAll('.rs-reveal-overlay').forEach(overlay => {
      const container = overlay.parentElement;
      if (container && !container.querySelector('[data-rs-blurred="true"]')) {
        overlay.remove();
      }
    });

    const posts = RedditDetector.findPosts();
    posts.forEach(post => this.processPost(post, settings));
  }
};

// Listen for clicks on Reddit's NATIVE reveal buttons to sync our state
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    // Firefox might report e.target as the shadow host (shreddit-blurred-container) instead of the button inside it.
    const nativeBtn = e.target.closest('shreddit-blurred-container button, .nsfw-prompt button, shreddit-blurred-container');
    if (nativeBtn) {
      const post = nativeBtn.closest('.Post, shreddit-post');
      if (post) {
        post.dataset.rsTemporarilyRevealed = 'true';
        post.querySelectorAll('.rs-reveal-overlay').forEach(o => o.remove());
        post.querySelectorAll('.rs-blur-low, .rs-blur-medium, .rs-blur-high').forEach(el => {
          el.classList.remove('rs-blur-low', 'rs-blur-medium', 'rs-blur-high');
        });
      }
    }
  }, { capture: true, passive: true });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlurManager;
}
