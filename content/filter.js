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
          postEl.style.setProperty('display', 'none', 'important');
          
          // If we are in old reddit, the parent container might also need hiding
          if (postEl.parentElement && postEl.parentElement.classList.contains('sitetable')) {
             // Leave it, hiding the postEl itself is enough
          }
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
