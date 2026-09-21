/**
 * Reddit Privacy & Posting Safety Extension
 * MAIN World Auto-Reveal Script
 * 
 * Runs natively in the page context (MAIN world) to directly manipulate Lit properties.
 * Uses a MutationObserver to instantly reveal native blurred containers as they load.
 */

(function() {
  let isEnabled = false;

  // Listen for settings updates from the isolated content script
  document.addEventListener('rs-settings-update', (e) => {
    if (e.detail && typeof e.detail.autoRevealNative === 'boolean') {
      isEnabled = e.detail.autoRevealNative;
      if (isEnabled) unblurAll();
    }
  });

  function unblurAll() {
    if (!isEnabled) return;
    
    // 1. Shreddit native blur containers
    const posts = document.querySelectorAll('shreddit-blurred-container[reason]');
    for (const post of posts) {
       post.blurred = false;
       post.isBlurred = false;
       post._blur = false;
       post.revealed = true;
    }

    // 2. Highlights & Spoilers
    const highlights = document.querySelectorAll('community-highlight-card:is([nsfw], [spoiler])');
    for (const highlight of highlights) {
       highlight.toggleAttribute('blurred', false);
    }
    const spoilers = document.querySelectorAll('shreddit-spoiler:not([data-revealed])');
    for (const s of spoilers) {
       s.dataset.revealed = '';
       s.revealed = true;
    }
  }

  // Observe for new elements
  const observer = new MutationObserver(() => {
    unblurAll();
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributeFilter: ['blurred', 'reason']
  });

})();
