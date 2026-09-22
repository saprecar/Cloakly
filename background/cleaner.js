/**
 * Cloakly
 * Account Cleaner API Logic
 */

const RedditCleaner = {
  isRunning: false,
  cancelRequested: false,

  async getModhash() {
    try {
      const res = await fetch('https://old.reddit.com/api/me.json', { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.modhash;
    } catch (e) {
      console.error('[Reddit Cleaner] Failed to get modhash:', e);
      return null;
    }
  },

  async fetchItems(username, type, after = null) {
    // type: 'comments', 'submitted' (posts), 'saved', 'upvoted', 'downvoted'
    try {
      let url = `https://old.reddit.com/user/${encodeURIComponent(username)}/${type}/.json?limit=100`;
      
      // Saved items are safer to fetch from the root endpoint to avoid privacy 403s
      if (type === 'saved') {
        url = `https://old.reddit.com/saved/.json?limit=100`;
      }

      if (after) {
        url += `&after=${after}`;
      }
      
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return { items: [], after: null };
      
      const json = await res.json();
      const items = json.data?.children || [];
      const nextAfter = json.data?.after;
      
      return { items, after: nextAfter };
    } catch (e) {
      console.error(`[Reddit Cleaner] Failed to fetch ${type}:`, e);
      return { items: [], after: null };
    }
  },

  async performAction(action, itemId, modhash) {
    // action: 'del', 'unsave', 'vote'
    try {
      const body = new URLSearchParams();
      body.append('id', itemId);
      body.append('uh', modhash);
      body.append('api_type', 'json');
      
      if (action === 'vote') {
        body.append('dir', '0'); // 0 removes the vote
      }

      const res = await fetch(`https://old.reddit.com/api/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body.toString()
      });

      const text = await res.text();
      let json = {};
      try { json = JSON.parse(text); } catch (e) {}

      if (json && json.json && json.json.errors && json.json.errors.length > 0) {
        console.error(`[Reddit Cleaner] API Error for ${action} on ${itemId}:`, json.json.errors);
        return false;
      }
      
      // If it doesn't return an error array, we assume success
      return res.ok;
    } catch (e) {
      console.error(`[Reddit Cleaner] Failed to perform ${action} on ${itemId}:`, e);
      return false;
    }
  },

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async startCleaning(username, typesToClean, timeRange, dateStart, dateEnd, onProgress) {
    if (this.isRunning) return false;
    this.isRunning = true;
    this.cancelRequested = false;

    let totalDeleted = 0;

    // Calculate boundary timestamps (in seconds since epoch, to match Reddit API)
    const now = Math.floor(Date.now() / 1000);
    let minTime = 0;
    let maxTime = Number.MAX_SAFE_INTEGER;

    if (timeRange === '1h') minTime = now - (60 * 60);
    else if (timeRange === '24h') minTime = now - (24 * 60 * 60);
    else if (timeRange === '7d') minTime = now - (7 * 24 * 60 * 60);
    else if (timeRange === '30d') minTime = now - (30 * 24 * 60 * 60);
    else if (timeRange === '1y') minTime = now - (365 * 24 * 60 * 60);
    else if (timeRange === 'custom') {
      if (dateStart) minTime = Math.floor(new Date(dateStart).getTime() / 1000);
      if (dateEnd) {
        const dEnd = new Date(dateEnd);
        dEnd.setHours(23, 59, 59, 999);
        maxTime = Math.floor(dEnd.getTime() / 1000);
      }
    }

    try {
      const modhash = await this.getModhash();
      if (!modhash) {
        throw new Error('Not logged in or unable to get modhash. Please log into Reddit first.');
      }

      const typeMap = {
        'posts': { path: 'submitted', action: 'del' },
        'comments': { path: 'comments', action: 'del' },
        'saved': { path: 'saved', action: 'unsave' },
        'upvoted': { path: 'upvoted', action: 'vote' },
        'downvoted': { path: 'downvoted', action: 'vote' }
      };

      for (const type of typesToClean) {
        if (this.cancelRequested) break;
        if (!typeMap[type]) continue;

        const { path, action } = typeMap[type];
        let currentAfter = null;
        let hasMore = true;

        onProgress({ status: `Fetching ${type}...`, count: totalDeleted, activeType: type });

        while (hasMore && !this.cancelRequested) {
          const { items, after } = await this.fetchItems(username, path, currentAfter);
          
          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }

          for (const item of items) {
            if (this.cancelRequested) break;

            const itemId = item.data.name;
            const created = item.data.created_utc;

            // If item is newer than our max custom date, skip it but keep going
            if (created > maxTime) {
              continue; 
            }

            // If item is older than our min time, stop fetching completely! (because list is chronological)
            if (created < minTime) {
              hasMore = false;
              break; 
            }

            onProgress({ status: `Processing ${type} (${itemId})...`, count: totalDeleted, activeType: type });
            
            const success = await this.performAction(action, itemId, modhash);
            
            if (success) {
              totalDeleted++;
            }
            
            // Reddit API Rate limit safety (1 request per second approx)
            await this.delay(1000); 
          }

          currentAfter = after;
          if (!currentAfter) {
            hasMore = false;
          }
        }
      }

      this.isRunning = false;
      onProgress({ status: this.cancelRequested ? 'Cancelled' : 'Finished', count: totalDeleted, isDone: true });
      return true;
    } catch (error) {
      this.isRunning = false;
      onProgress({ status: 'Error: ' + error.message, count: totalDeleted, isDone: true, error: true });
      return false;
    }
  },

  cancel() {
    if (this.isRunning) {
      this.cancelRequested = true;
    }
  }
};

// Listen for messages from popup
if (typeof browserAPI !== 'undefined') {
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_CLEANER') {
      RedditCleaner.startCleaning(
        request.username, 
        request.typesToClean, 
        request.timeRange,
        request.dateStart,
        request.dateEnd,
        (progressInfo) => {
          // Broadcast progress back to popup
          browserAPI.runtime.sendMessage({ action: 'CLEANER_PROGRESS', ...progressInfo }).catch(() => {});
        }
      );
      sendResponse({ success: true, message: 'Cleaner started' });
    }
    
    if (request.action === 'STOP_CLEANER') {
      RedditCleaner.cancel();
      sendResponse({ success: true, message: 'Cancel requested' });
    }

    if (request.action === 'GET_CLEANER_STATUS') {
      sendResponse({ isRunning: RedditCleaner.isRunning });
    }
  });
}
