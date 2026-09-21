/**
 * Reddit Privacy & Posting Safety Extension
 * Subreddit Blocker - Runs at document_start to aggressively block access.
 */

(async () => {
  // Only run on HTML pages
  if (document.contentType !== 'text/html') return;

  const url = new URL(window.location.href);
  const path = url.pathname.toLowerCase();

  // Fast check: Are we even on a subreddit page?
  const match = path.match(/^\/r\/([^\/]+)/);
  if (!match) return;

  const currentSub = match[1];

  // We need to wait for browserAPI and StorageManager to be available.
  // Since this runs at document_start, we might need to rely on direct browser.storage.
  const api = typeof browser !== 'undefined' ? browser : chrome;
  
  try {
    const rawStorage = await api.storage.local.get(null);
    const activeProfile = rawStorage.activeProfile || 'default';
    const profileSettings = rawStorage.profiles ? (rawStorage.profiles[activeProfile] || {}) : rawStorage;
    const blockedSubs = profileSettings.blockedSubreddits || [];

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
    console.error('[Reddit Safety] Blocker failed to read storage:', err);
  }
})();
