/**
 * Cloakly
 * Post Filter & Muting Manager
 */

const FilterManager = {
  /**
   * Scans and hides posts based on user filters.
   */
  scanAndApply(settings) {
    const filters = settings.postFilters || [];
    const blockedSubs = settings.blockedSubreddits || [];
    
    if (filters.length === 0 && blockedSubs.length === 0) return;

    const posts = RedditDetector.findPosts();
    if (posts.length === 0) return;

    const currentSubreddit = RedditDetector.getCurrentSubreddit()?.toLowerCase();

    posts.forEach(postEl => {
      // Avoid re-processing hidden posts
      if (postEl.dataset.rsFiltered === 'true') return;

      const postText = (postEl.innerText || '').toLowerCase();
      
      // Determine post subreddit (sometimes available in attributes for cross-posts/feeds)
      let postSub = currentSubreddit;
      const shredditSub = postEl.getAttribute('subreddit-prefixed-name');
      if (shredditSub) {
        postSub = shredditSub.replace(/^r\//i, '').toLowerCase();
      } else {
        const a = postEl.querySelector('a[href*="/r/"]');
        if (a && a.innerText.toLowerCase().startsWith('r/')) {
          postSub = a.innerText.replace(/^r\//i, '').toLowerCase();
        }
      }

      // Check if this post is from a completely blocked subreddit
      if (postSub && blockedSubs.includes(postSub)) {
        this._applyFilter(postEl, `Subreddit blocked (r/${postSub})`);
        return; // Move to next post
      }

      for (const filter of filters) {
        let subMatch = true;
        let keyMatch = true;

        if (filter.subreddit) {
          subMatch = postSub === filter.subreddit;
        }

        if (filter.keyword) {
          // Use word boundary regex to prevent partial matches like "work" matching "networking"
          const regex = new RegExp(`\\b${this.escapeRegExp(filter.keyword)}\\b`, 'i');
          keyMatch = regex.test(postText);
        }

        if (subMatch && keyMatch) {
          // Rule matched, hide the post
          let reasonText = 'Keyword filter';
          if (filter.keyword) reasonText += ` ("${filter.keyword}")`;
          
          this._applyFilter(postEl, reasonText);
          break; // Stop checking other rules for this post
        }
      }
    });
  },

  /**
   * Hides a post and inserts an individual "Post hidden" banner in its exact
   * spot - styled after Reddit's own native hide-post pattern (image 3 in
   * conversation: one hidden post = one banner with Undo, right where that
   * post was). No merging/stacking across posts, so blocks never pile up
   * together at one spot in the feed regardless of how many are blocked.
   * @param {HTMLElement} postEl
   * @param {string} reasonText
   */
  _applyFilter(postEl, reasonText) {
    postEl.dataset.rsFiltered = 'true';
    postEl.style.display = 'none';

    // Hide parent article to prevent huge blank margins
    let parentToHide = null;
    if (postEl.tagName === 'SHREDDIT-POST' && postEl.parentElement && postEl.parentElement.tagName === 'ARTICLE') {
      parentToHide = postEl.parentElement;
      parentToHide.dataset.rsFiltered = 'true';
      parentToHide.style.display = 'none';
    }

    // Hide any trailing spacer (like <hr> or tracking divs) to prevent massive gray gaps
    let spacerToHide = null;
    const nextEl = (parentToHide || postEl).nextElementSibling;
    if (nextEl && ['HR', 'FACEPLATE-TRACKER'].includes(nextEl.tagName)) {
      spacerToHide = nextEl;
      spacerToHide.style.display = 'none';
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'rs-filter-placeholder';
    placeholder.dataset.rsReason = reasonText;
    placeholder.style.cssText = 'padding: 12px 16px; margin: 0; background: transparent; border-bottom: 1px solid rgba(71, 85, 105, 0.3); display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #94a3b8; font-family: sans-serif;';

    placeholder.innerHTML = `
      <span class="rs-placeholder-text">Post hidden: ${reasonText}</span>
      <button class="rs-undo-filter-btn" style="background: transparent; border: none; color: #4fbcff; padding: 4px 8px; cursor: pointer; font-size: 13px; font-weight: 600; white-space: nowrap; margin-left: 8px;">Undo</button>
    `;

    const undoBtn = placeholder.querySelector('.rs-undo-filter-btn');
    undoBtn.addEventListener('click', () => {
      postEl.style.display = '';
      if (parentToHide) parentToHide.style.display = '';
      if (spacerToHide) spacerToHide.style.display = '';
      placeholder.remove();
    });

    const insertTarget = parentToHide || postEl;
    insertTarget.parentNode.insertBefore(placeholder, insertTarget);
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterManager;
}
