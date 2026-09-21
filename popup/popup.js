/**
 * Reddit Privacy & Posting Safety Extension
 * Popup Controller Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await StorageManager.getSettings();

  // Render user account status
  const usernameEl = document.getElementById('popupUsername');
  const userStatsEl = document.getElementById('popupUserStats');
  if (usernameEl && userStatsEl) {
    if (settings.useManualProfile) {
      const uName = settings.manualUsername ? `u/${settings.manualUsername}` : 'Manual Profile';
      const age = settings.manualAccountAgeDays !== null ? `${settings.manualAccountAgeDays}d` : 'Unknown';
      const karma = settings.manualKarma !== null ? settings.manualKarma : 'Unknown';
      usernameEl.textContent = `${uName} (Manual Override)`;
      userStatsEl.textContent = `Age: ${age} • Karma: ${karma}`;
    } else if (settings.lastDetectedUser) {
      const u = settings.lastDetectedUser;
      const uName = u.username ? `u/${u.username}` : 'Logged In User';
      const age = u.accountAgeDays !== null ? `${u.accountAgeDays}d` : 'Unknown';
      const karma = u.combinedKarma !== null ? u.combinedKarma : 'Unknown';
      usernameEl.textContent = uName;
      userStatsEl.textContent = `Age: ${age} • Karma: ${karma} (Auto-detected)`;
    } else {
      usernameEl.textContent = 'Auto-Detect Active';
      userStatsEl.textContent = 'Open Reddit to sync profile automatically';
    }

    const quickInput = document.getElementById('quickUsernameInput');
    const btnSync = document.getElementById('btnQuickSync');

    if (quickInput && btnSync) {
      if (settings.lastDetectedUser?.username) {
        quickInput.value = settings.lastDetectedUser.username;
      } else if (settings.manualUsername) {
        quickInput.value = settings.manualUsername;
      }

      btnSync.addEventListener('click', async () => {
        const uname = quickInput.value.trim().replace(/^u\//i, '');
        if (!uname) return;

        btnSync.textContent = '...';
        try {
          const url = `https://www.reddit.com/user/${encodeURIComponent(uname)}/about.json`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const json = await res.json();
            const user = json.data || json;
            const createdUtc = user.created_utc || user.created;
            const accountAgeDays = createdUtc ? Math.max(0, Math.floor((Date.now() - (createdUtc * 1000)) / 86400000)) : null;
            const commentKarma = typeof user.comment_karma === 'number' ? user.comment_karma : null;
            const linkKarma = typeof user.link_karma === 'number' ? user.link_karma : null;
            const combinedKarma = typeof user.total_karma === 'number' ? user.total_karma :
                                  (commentKarma !== null && linkKarma !== null ? commentKarma + linkKarma : null);

            const lastDetectedUser = {
              username: uname,
              accountAgeDays,
              combinedKarma,
              timestamp: Date.now()
            };

            await StorageManager.updateSettings({
              lastDetectedUser,
              manualUsername: uname
            });

            usernameEl.textContent = `u/${uname}`;
            userStatsEl.textContent = `Age: ${accountAgeDays}d • Karma: ${combinedKarma} (Synced!)`;
            btnSync.textContent = '✓';
            setTimeout(() => { btnSync.textContent = 'Sync'; }, 2000);
          } else {
            alert(`Reddit user u/${uname} not found (HTTP ${res.status}).`);
            btnSync.textContent = 'Sync';
          }
        } catch (err) {
          alert('Failed to sync profile: ' + err.message);
          btnSync.textContent = 'Sync';
        }
      });
    }

    // Render Account Health (Shadowban Status)
    const healthCard = document.getElementById('accountHealthCard');
    const healthAvatar = document.getElementById('healthAvatar');
    const healthStatusText = document.getElementById('healthStatusText');
    
    if (healthCard && healthAvatar && healthStatusText) {
      healthCard.style.display = 'flex';
      healthCard.style.cursor = 'pointer';
      healthCard.title = 'Click to force a re-check';
      
      const updateHealthUI = (isBanned) => {
        if (isBanned) {
          healthCard.style.borderColor = '#ef4444';
          healthAvatar.style.backgroundColor = '#ef4444';
          healthAvatar.textContent = '⚠️';
          healthStatusText.textContent = 'SHADOWBANNED';
          healthStatusText.style.color = '#ef4444';
        } else {
          healthCard.style.borderColor = '#22c55e';
          healthAvatar.style.backgroundColor = '#22c55e';
          healthAvatar.textContent = '✓';
          healthStatusText.textContent = 'Normal';
          healthStatusText.style.color = '#22c55e';
        }
      };

      if (settings.lastShadowbanCheck) {
        updateHealthUI(settings.isShadowbanned);
      } else {
        healthCard.style.borderColor = '#334155';
        healthAvatar.style.backgroundColor = '#334155';
        healthAvatar.textContent = '⚕️';
        healthStatusText.textContent = 'Pending check...';
        healthStatusText.style.color = '#94a3b8';
      }

      // Allow manual click to force check (bypasses cache)
      healthCard.addEventListener('click', async () => {
        const uname = settings.lastDetectedUser?.username || settings.manualUsername;
        if (!uname) {
          alert('Please wait for a username to be detected first.');
          return;
        }

        healthCard.style.borderColor = '#334155';
        healthAvatar.style.backgroundColor = '#334155';
        healthAvatar.textContent = '⏳';
        healthStatusText.textContent = 'Checking... (Takes 2s)';
        healthStatusText.style.color = '#94a3b8';

        const api = typeof browser !== 'undefined' ? browser : chrome;
        api.runtime.sendMessage({ action: 'CHECK_SHADOWBAN', username: uname }, async (res) => {
          if (res && res.success) {
            await StorageManager.updateSettings({
              isShadowbanned: !!res.isShadowbanned,
              lastShadowbanCheck: Date.now()
            });
            updateHealthUI(res.isShadowbanned);
          } else {
            healthStatusText.textContent = res?.error || 'Check failed';
            healthStatusText.style.color = '#ef4444';
          }
        });
      });
      
      // Auto-trigger if it has NEVER been checked
      if (!settings.lastShadowbanCheck) {
        healthCard.click();
      }
    }
  }

  // Map popup UI IDs to actual setting keys
  const checkboxMap = {
    'popupNsfwProtection': 'nsfwProtection',
    'popupSpoilerProtection': 'spoilerProtection',
    'popupAutoRevealNative': 'autoRevealNative',
    'popupPostCheckEnabled': 'postCheckEnabled',
    'popupCommentCheckEnabled': 'commentCheckEnabled'
  };

  const nsfwEl = document.getElementById('popupNsfwProtection') || document.getElementById('nsfwProtection');
  const spoilerEl = document.getElementById('popupSpoilerProtection') || document.getElementById('spoilerProtection');
  const autoRevealEl = document.getElementById('popupAutoRevealNative') || document.getElementById('autoRevealNative');

  function syncBlurToggles() {
    if (!nsfwEl || !spoilerEl || !autoRevealEl) return;

    if (autoRevealEl.checked) {
      nsfwEl.checked = false;
      spoilerEl.checked = false;
      
      nsfwEl.disabled = true;
      nsfwEl.parentElement.style.opacity = '0.5';
      spoilerEl.disabled = true;
      spoilerEl.parentElement.style.opacity = '0.5';
    } else {
      nsfwEl.disabled = false;
      nsfwEl.parentElement.style.opacity = '1';
      spoilerEl.disabled = false;
      spoilerEl.parentElement.style.opacity = '1';
    }

    if (nsfwEl.checked || spoilerEl.checked) {
      autoRevealEl.checked = false;
      
      autoRevealEl.disabled = true;
      autoRevealEl.parentElement.style.opacity = '0.5';
    } else {
      autoRevealEl.disabled = false;
      autoRevealEl.parentElement.style.opacity = '1';
    }
  }

  const checkboxes = [
    'nsfwProtection',
    'spoilerProtection',
    'autoRevealNative',
    'postCheckEnabled',
    'commentCheckEnabled'
  ];

  checkboxes.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = !!settings[id];
      el.addEventListener('change', async (e) => {
        // Enforce mutual exclusivity
        if (id === 'autoRevealNative' && el.checked) {
          nsfwEl.checked = false;
          spoilerEl.checked = false;
          await StorageManager.updateSettings({ nsfwProtection: false, spoilerProtection: false });
        }
        if ((id === 'nsfwProtection' || id === 'spoilerProtection') && el.checked) {
          autoRevealEl.checked = false;
          await StorageManager.updateSettings({ autoRevealNative: false });
        }
        
        syncBlurToggles();
        await StorageManager.updateSettings({ [id]: e.target.checked });
      });
    }
  });
  
  syncBlurToggles();

  // Protection Level
  const protWarning = document.getElementById('protWarning');
  const protStrict = document.getElementById('protStrict');

  if (protWarning && protStrict) {
    if (settings.protectionLevel === 'strict') {
      protStrict.checked = true;
    } else {
      protWarning.checked = true;
    }
  }

  const btnExplore = document.getElementById('btnScrollingOnlyMode');
  const btnPost = document.getElementById('btnAllowPostCreation');
  const btnComment = document.getElementById('btnAllowCommentCreation');

  function updateFeatureBtn(btn, isEnabled) {
    if (!btn) return;
    if (isEnabled) {
      btn.textContent = 'ENABLED';
      btn.className = 'status-btn unlocked'; // Re-use unlocked style (green)
    } else {
      btn.textContent = 'DISABLED';
      btn.className = 'status-btn blocked'; // Re-use blocked style (red)
    }
  }

  function updatePermissionBtn(btn, isAllowed) {
    if (!btn) return;
    if (isAllowed) {
      btn.textContent = 'ALLOWED';
      btn.className = 'status-btn unlocked'; // green
    } else {
      btn.textContent = 'BLOCKED';
      btn.className = 'status-btn blocked'; // red
    }
  }

  if (btnExplore) {
    updateFeatureBtn(btnExplore, settings.scrollingOnlyMode);
    btnExplore.onclick = async () => {
      const newVal = !settings.scrollingOnlyMode;
      await StorageManager.updateSettings({ scrollingOnlyMode: newVal });
      settings.scrollingOnlyMode = newVal;
      updateFeatureBtn(btnExplore, newVal);
    };
  }

  if (btnPost) {
    updatePermissionBtn(btnPost, settings.allowPostCreation);
    btnPost.onclick = async () => {
      const newVal = !settings.allowPostCreation;
      await StorageManager.updateSettings({ allowPostCreation: newVal });
      settings.allowPostCreation = newVal;
      updatePermissionBtn(btnPost, newVal);
    };
  }

  if (btnComment) {
    updatePermissionBtn(btnComment, settings.allowCommentCreation);
    btnComment.onclick = async () => {
      const newVal = !settings.allowCommentCreation;
      await StorageManager.updateSettings({ allowCommentCreation: newVal });
      settings.allowCommentCreation = newVal;
      updatePermissionBtn(btnComment, newVal);
    };
  }

  [protWarning, protStrict].forEach(radio => {
    if (radio) {
      radio.addEventListener('change', async () => {
        const val = protStrict.checked ? 'strict' : 'warning';
        await StorageManager.updateSettings({ protectionLevel: val });
      });
    }
  });

  // Temporary Overrides (10 min = 600,000 ms)
  const btnTempPost = document.getElementById('btnTempPost');
  const btnTempComment = document.getElementById('btnTempComment');

  if (btnTempPost) {
    btnTempPost.addEventListener('click', async () => {
      const until = Date.now() + 600000;
      await StorageManager.updateSettings({ tempPostEnableUntil: until });
      alert('Posting creation temporarily enabled for 10 minutes.');
    });
  }

  if (btnTempComment) {
    btnTempComment.addEventListener('click', async () => {
      const until = Date.now() + 600000;
      await StorageManager.updateSettings({ tempCommentEnableUntil: until });
      alert('Comment creation temporarily enabled for 10 minutes.');
    });
  }

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Popup Filter UI Logic
  const popupFilterSubreddit = document.getElementById('popupFilterSubreddit');
  const popupFilterKeyword = document.getElementById('popupFilterKeyword');
  const btnPopupAddFilter = document.getElementById('btnPopupAddFilter');
  const btnPopupBlockSub = document.getElementById('btnPopupBlockSub');
  const btnManageFilters = document.getElementById('btnManageFilters');

  if (btnManageFilters) {
    btnManageFilters.addEventListener('click', () => {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      if (api.runtime.openOptionsPage) {
        api.runtime.openOptionsPage();
      } else {
        window.open(api.runtime.getURL('options/options.html'));
      }
    });
  }

  if (btnPopupAddFilter) {
    btnPopupAddFilter.addEventListener('click', async () => {
      const sub = popupFilterSubreddit.value.trim().toLowerCase().replace(/^r\//, '');
      const keyword = popupFilterKeyword.value.trim().toLowerCase();

      if (!sub && !keyword) {
        alert('Please enter a subreddit, a keyword, or both.');
        return;
      }

      const s = await StorageManager.getSettings();
      if (!s.postFilters) s.postFilters = [];
      
      s.postFilters.push({
        id: Date.now().toString(),
        subreddit: sub,
        keyword: keyword
      });

      await StorageManager.updateSettings({ postFilters: s.postFilters });
      
      popupFilterSubreddit.value = '';
      popupFilterKeyword.value = '';
      
      // Briefly show feedback on the button
      const oldText = btnPopupAddFilter.textContent;
      btnPopupAddFilter.textContent = '✓ ADDED';
      setTimeout(() => { btnPopupAddFilter.textContent = oldText; }, 1500);
    });
  }

  if (btnPopupBlockSub) {
    btnPopupBlockSub.addEventListener('click', async () => {
      let sub = popupFilterSubreddit.value.trim().toLowerCase().replace(/^r\//, '');
      if (!sub) {
        alert('Please enter a subreddit name in the first box to block it entirely.');
        return;
      }

      const s = await StorageManager.getSettings();
      if (!s.blockedSubreddits) s.blockedSubreddits = [];
      if (!s.blockedSubreddits.includes(sub)) {
        s.blockedSubreddits.push(sub);
        await StorageManager.updateSettings({ blockedSubreddits: s.blockedSubreddits });
      }

      popupFilterSubreddit.value = '';
      
      // Briefly show feedback on the button
      const oldText = btnPopupBlockSub.textContent;
      btnPopupBlockSub.textContent = '✓ BLOCKED';
      setTimeout(() => { btnPopupBlockSub.textContent = oldText; }, 1500);
    });
  }

  // Cleaner UI Logic
  const btnStartCleaner = document.getElementById('btnStartCleaner');
  const btnStopCleaner = document.getElementById('btnStopCleaner');
  const progressContainer = document.getElementById('cleanerProgressContainer');
  const statusText = document.getElementById('cleanerStatusText');
  const progressBar = document.getElementById('cleanerProgressBar');
  const timeRangeSelect = document.getElementById('cleanerTimeRange');
  const customDateContainer = document.getElementById('cleanerCustomDate');

  if (btnStartCleaner && btnStopCleaner) {
    if (timeRangeSelect) {
      timeRangeSelect.addEventListener('change', (e) => {
        customDateContainer.style.display = e.target.value === 'custom' ? 'block' : 'none';
      });
    }

    // Check initial status
    browserAPI.runtime.sendMessage({ action: 'GET_CLEANER_STATUS' }, (res) => {
      if (res && res.isRunning) {
        btnStartCleaner.style.display = 'none';
        btnStopCleaner.style.display = 'block';
        progressContainer.style.display = 'block';
        statusText.textContent = 'Cleaner is currently running in background...';
      }
    });

    btnStartCleaner.addEventListener('click', () => {
      const username = document.getElementById('popupUsername').textContent;
      if (!username || username.includes('Detecting') || username.includes('Manual')) {
        alert('Please open Reddit to sync your account before cleaning.');
        return;
      }
      
      const typesToClean = [];
      if (document.getElementById('cleanPosts').checked) typesToClean.push('posts');
      if (document.getElementById('cleanComments').checked) typesToClean.push('comments');
      if (document.getElementById('cleanSaved').checked) typesToClean.push('saved');
      if (document.getElementById('cleanUpvoted').checked) typesToClean.push('upvoted');
      if (document.getElementById('cleanDownvoted').checked) typesToClean.push('downvoted');

      if (typesToClean.length === 0) {
        alert('Please select at least one item type to clean.');
        return;
      }

      const timeRange = timeRangeSelect ? timeRangeSelect.value : 'all';
      let dateStart = null;
      let dateEnd = null;
      
      if (timeRange === 'custom') {
        dateStart = document.getElementById('cleanerDateStart').value;
        dateEnd = document.getElementById('cleanerDateEnd').value;
        if (!dateStart && !dateEnd) {
          alert('Please select at least one date for the custom range.');
          return;
        }
      }

      const confirmation = prompt(`☢️ WARNING: This will PERMANENTLY delete your ${typesToClean.join(', ')}.\n\nTo confirm, type exactly: DELETE`);
      if (confirmation !== 'DELETE') {
        alert('Cancelled.');
        return;
      }

      browserAPI.runtime.sendMessage({ 
        action: 'START_CLEANER', 
        username, 
        typesToClean,
        timeRange,
        dateStart,
        dateEnd
      });
      
      btnStartCleaner.style.display = 'none';
      btnStopCleaner.style.display = 'block';
      progressContainer.style.display = 'block';
      statusText.textContent = 'Starting cleaner...';
      progressBar.style.width = '0%';
    });

    btnStopCleaner.addEventListener('click', () => {
      browserAPI.runtime.sendMessage({ action: 'STOP_CLEANER' });
      statusText.textContent = 'Cancelling (waiting for active request to finish)...';
      btnStopCleaner.disabled = true;
    });

    // Listen for progress messages
    browserAPI.runtime.onMessage.addListener((request) => {
      if (request.action === 'CLEANER_PROGRESS') {
        statusText.textContent = `${request.status} (Total Processed: ${request.count})`;
        
        // Very basic progress bar simulation (we don't know total items, so just pulse it)
        let currentWidth = parseFloat(progressBar.style.width) || 0;
        if (currentWidth >= 95) currentWidth = 0;
        progressBar.style.width = request.isDone ? '100%' : (currentWidth + 5) + '%';
        
        if (request.isDone) {
          btnStartCleaner.style.display = 'block';
          btnStopCleaner.style.display = 'none';
          btnStopCleaner.disabled = false;
          if (request.error) {
            progressBar.style.background = '#f59e0b'; // warning color
          } else {
            progressBar.style.background = '#22c55e'; // success color
          }
        }
      }
    });
  }

  // Open Full Options
  document.getElementById('btnOpenOptions').addEventListener('click', () => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    } else {
      window.open(api.runtime.getURL('options/options.html'));
    }
  });
});
