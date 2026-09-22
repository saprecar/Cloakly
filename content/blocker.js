/**
 * Cloakly
 * Subreddit Blocker - Runs at document_start to aggressively block access.
 */

(async () => {
  // Only run on HTML pages (contentType may be undefined at document_start in some browsers)
  if (document.contentType && document.contentType !== 'text/html') return;

  const api = typeof browser !== 'undefined' ? browser : chrome;

  // Inject auto-reveal.js into the MAIN world dynamically
  // This replaces the removed 'world: MAIN' manifest entry for Firefox compatibility
  try {
    const scriptUrl = api.runtime.getURL('content/auto-reveal.js');
    const s = document.createElement('script');
    s.src = scriptUrl;
    s.type = 'text/javascript';
    // Use documentElement since head may not exist at document_start
    (document.head || document.documentElement).appendChild(s);
    s.onload = () => s.remove();
    s.onerror = () => {
      // Fallback: If CSP blocks external script, inject content inline
      s.remove();
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', scriptUrl, false); // synchronous
        xhr.send();
        if (xhr.status === 200) {
          const inline = document.createElement('script');
          inline.textContent = xhr.responseText;
          (document.head || document.documentElement).appendChild(inline);
          inline.remove();
        }
      } catch (e2) {
        console.warn('[Cloakly] Auto-reveal injection failed entirely:', e2);
      }
    };
  } catch (e) {
    console.warn('[Cloakly] Failed to inject auto-reveal script:', e);
  }

  const url = new URL(window.location.href);
  const path = url.pathname.toLowerCase();

  // Fast check: Are we even on a subreddit page?
  const match = path.match(/^\/r\/([^\/]+)/);
  if (!match) return;

  const currentSub = match[1];
  
  try {
    const rawStorage = await api.storage.local.get(null);
    const activeProfile = rawStorage.activeProfile || 'default';
    const profileSettings = rawStorage.profiles ? (rawStorage.profiles[activeProfile] || {}) : rawStorage;
    
    // 1. Block Post Creation via URL
    // Check if post creation is explicitly allowed (default true) or temporarily overridden
    const isPostAllowed = profileSettings.allowPostCreation !== false || (profileSettings.tempPostEnableUntil && Date.now() < profileSettings.tempPostEnableUntil);
    if (!isPostAllowed) {
      if (path.includes('/submit') || (path.includes('/r/') && path.endsWith('/submit'))) {
        window.stop();
        // Redirect to Reddit home with a blocked flag
        window.location.replace('https://www.reddit.com/?rs_blocked=post');
        return;
      }
    }
    const blockedSubs = profileSettings.blockedSubreddits || [];

    // 1. Block Subreddits
    if (blockedSubs.includes(currentSub)) {
      // STOP PAGE RENDER!
      window.stop();

      // Wipe document and inject blocking UI
      document.documentElement.innerHTML = `
        <html>
          <head>
            <title>Blocked Subreddit</title>
            <style>
              body {
                background-color: #0f172a;
                color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
              }
              .container {
                background-color: #1e293b;
                padding: 40px;
                border-radius: 12px;
                border: 1px solid #334155;
                max-width: 500px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              }
              h1 { color: #ef4444; margin-top: 0; }
              p { color: #94a3b8; font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
              .btn {
                background-color: #3b82f6;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
              }
              .btn:hover { background-color: #2563eb; }
              .profile-badge {
                display: inline-block;
                background-color: #334155;
                padding: 4px 10px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: bold;
                color: #cbd5e1;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⛔ Access Denied</h1>
              <p>You have blocked access to <strong>r/${currentSub}</strong> on this profile.</p>
              <button class="btn" onclick="window.history.back();">Go Back</button>
              <br>
              <div class="profile-badge">Active Profile: ${activeProfile}</div>
            </div>
          </body>
        </html>
      `;
    }
  } catch (err) {
    console.error('[Cloakly] Blocker failed to read storage:', err);
  }
})();
