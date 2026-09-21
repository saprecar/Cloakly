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

  // Bind toggles
  const checkboxes = ['nsfwProtection', 'spoilerProtection', 'autoRevealNative', 'postCheckEnabled', 'allowPostCreation', 'commentCheckEnabled', 'allowCommentCreation'];

  const nsfwEl = document.getElementById('nsfwProtection');
  const spoilerEl = document.getElementById('spoilerProtection');
  const autoRevealEl = document.getElementById('autoRevealNative');

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

  if (settings.protectionLevel === 'strict') {
    protStrict.checked = true;
  } else {
    protWarning.checked = true;
  }

  [protWarning, protStrict].forEach(radio => {
    radio.addEventListener('change', async () => {
      const val = protStrict.checked ? 'strict' : 'warning';
      await StorageManager.updateSettings({ protectionLevel: val });
    });
  });

  // Temporary Overrides (10 min = 600,000 ms)
  const btnTempPost = document.getElementById('btnTempPost');
  const btnTempComment = document.getElementById('btnTempComment');

  btnTempPost.addEventListener('click', async () => {
    const until = Date.now() + 600000;
    await StorageManager.updateSettings({ tempPostEnableUntil: until });
    alert('Posting creation temporarily enabled for 10 minutes.');
  });

  btnTempComment.addEventListener('click', async () => {
    const until = Date.now() + 600000;
    await StorageManager.updateSettings({ tempCommentEnableUntil: until });
    alert('Comment creation temporarily enabled for 10 minutes.');
  });

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
