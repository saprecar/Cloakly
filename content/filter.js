/**
 * Reddit Privacy & Posting Safety Extension
 * Post Filter & Muting Manager
 */

const FilterManager = {
  /**
   * Scans and hides posts based on user filters.
   */
  scanAndApply(settings) {
    if (!settings || !settings.postFilters || settings.postFilters.length === 0) return;

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

      for (const filter of settings.postFilters) {
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
          postEl.dataset.rsFiltered = 'true';
          postEl.style.display = 'none';

          // Create a placeholder with an undo button
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'padding: 8px 12px; margin: 8px 0; background: rgba(30, 41, 59, 0.5); border: 1px dashed rgba(100, 116, 139, 0.5); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8; font-family: sans-serif;';
          
          let reasonText = 'Post hidden by your filter';
          if (filter.keyword) reasonText += ` (Keyword: "${filter.keyword}")`;
          
          placeholder.innerHTML = `
            <span>${reasonText}</span>
            <button class="rs-undo-filter-btn" style="background: transparent; border: 1px solid #475569; color: #cbd5e1; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px;">Show Anyway</button>
          `;

          const undoBtn = placeholder.querySelector('.rs-undo-filter-btn');
          undoBtn.addEventListener('click', () => {
            postEl.style.display = ''; // Restore original display
            placeholder.remove(); // Remove placeholder
          });

          // Insert placeholder right before the hidden post
          postEl.parentNode.insertBefore(placeholder, postEl);

          break; // Stop checking other rules for this post
        }
      }
    });
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterManager;
}
