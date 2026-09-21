/**
 * Reddit Privacy & Posting Safety Extension
 * Options Controller Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const saveStatusEl = document.getElementById('saveStatus');

  // Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const tabTitle = document.getElementById('tab-title');
  const tabDesc = document.getElementById('tab-desc');

  const tabMeta = {
    'tab-browsing': {
      title: 'Browsing Protection',
      desc: 'Configure local media blur and sensitive content filtering preferences.'
    },
    'tab-filtering': {
      title: 'Feed Filters & Post Hiding',
      desc: 'Dynamically hide posts as you scroll based on subreddits and keywords.'
    },
    'tab-posting': {
      title: 'Posting & Commenting Safety',
      desc: 'Set pre-submission requirements checking and safety controls.'
    },
    'tab-cache': {
      title: 'Subreddit Rule Cache',
      desc: 'Manage locally cached subreddit rule definitions.'
    },
    'tab-advanced': {
      title: 'Advanced & Privacy',
      desc: 'Manage developer diagnostics and reset storage.'
    },
    'tab-profile': {
      title: 'User Profile & Overrides',
      desc: 'Manually set your Reddit account age and karma for reliable rule checking.'
    }
  };

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      navItems.forEach(n => n.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');

      if (tabMeta[tabId]) {
        tabTitle.textContent = tabMeta[tabId].title;
        tabDesc.textContent = tabMeta[tabId].desc;
      }

      if (tabId === 'tab-cache') {
        renderRuleCache();
      } else if (tabId === 'tab-filtering') {
        renderFilters();
      }
    });
  });

  // Fetch current settings
  let settings = await StorageManager.getSettings();

  // Filter Rules Management
  const filterListContainer = document.getElementById('filterListContainer');
  const btnAddFilter = document.getElementById('btnAddFilter');
  const newFilterSubreddit = document.getElementById('newFilterSubreddit');
  const newFilterKeyword = document.getElementById('newFilterKeyword');

  async function renderFilters() {
    if (!filterListContainer) return;
    const filters = settings.postFilters || [];
    
    if (filters.length === 0) {
      filterListContainer.innerHTML = '<div class="empty-state">No filter rules created yet. Add one above.</div>';
      return;
    }

    filterListContainer.innerHTML = filters.map(f => {
      const subText = f.subreddit ? `<b>r/${f.subreddit}</b>` : '<i>All Subreddits</i>';
      const keyText = f.keyword ? `<b>"${f.keyword}"</b>` : '<i>Any Keyword</i>';
      return `
        <div class="cache-card" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="cache-sub-title">Hide posts if:</div>
            <div class="cache-rules-preview" style="margin-top: 4px;">
              Subreddit is ${subText} AND text contains ${keyText}
            </div>
          </div>
          <button class="btn btn-danger btn-delete-filter" data-id="${f.id}" style="padding: 4px 8px; font-size: 11px;">Delete</button>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-delete-filter').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idToRemove = e.target.getAttribute('data-id');
        settings.postFilters = settings.postFilters.filter(f => f.id !== idToRemove);
        await StorageManager.updateSettings({ postFilters: settings.postFilters });
        renderFilters();
        showSaveFeedback();
      });
    });
  }

  if (btnAddFilter) {
    btnAddFilter.addEventListener('click', async () => {
      const sub = newFilterSubreddit.value.trim().toLowerCase().replace(/^r\//, '');
      const keyword = newFilterKeyword.value.trim().toLowerCase();

      if (!sub && !keyword) {
        alert('Please enter a subreddit, a keyword, or both.');
        return;
      }

      if (!settings.postFilters) settings.postFilters = [];
      
      settings.postFilters.push({
        id: Date.now().toString(),
        subreddit: sub,
        keyword: keyword
      });

      await StorageManager.updateSettings({ postFilters: settings.postFilters });
      
      newFilterSubreddit.value = '';
      newFilterKeyword.value = '';
      renderFilters();
      showSaveFeedback();
    });
  }

  // Helper to trigger save feedback toast
  function showSaveFeedback() {
    saveStatusEl.classList.add('visible');
    setTimeout(() => {
      saveStatusEl.classList.remove('visible');
    }, 2000);
  }

  // Bind Boolean Checkbox Switches
  const checkboxKeys = [
    'nsfwProtection', 'spoilerProtection',
    'blurImages', 'blurVideos', 'blurGifs', 'blurThumbnails',
    'keepRevealed', 'reblurOnNavigation',
    'postCheckEnabled', 'commentCheckEnabled',
    'allowPostCreation', 'allowCommentCreation',
    'useManualProfile',
    'debugMode'
  ];

  checkboxKeys.forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.checked = !!settings[key];
      el.addEventListener('change', async (e) => {
        const val = e.target.checked;
        await StorageManager.updateSettings({ [key]: val });
        settings[key] = val;
        showSaveFeedback();
      });
    }
  });

  // Bind Select Dropdowns
  const selectKeys = ['blurIntensity', 'revealMethod', 'protectionLevel'];

  selectKeys.forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.value = settings[key] || el.options[0].value;
      el.addEventListener('change', async (e) => {
        const val = e.target.value;
        await StorageManager.updateSettings({ [key]: val });
        settings[key] = val;
        showSaveFeedback();
      });
    }
  });

  // Temporary Overrides (10 mins)
  const btnTempPostOpt = document.getElementById('btnTempPostOpt');
  const btnTempCommentOpt = document.getElementById('btnTempCommentOpt');
  const overrideStatusText = document.getElementById('overrideStatusText');

  function updateOverrideText() {
    const now = Date.now();
    const postRemaining = settings.tempPostEnableUntil && settings.tempPostEnableUntil > now
      ? Math.ceil((settings.tempPostEnableUntil - now) / 60000)
      : 0;

    const commentRemaining = settings.tempCommentEnableUntil && settings.tempCommentEnableUntil > now
      ? Math.ceil((settings.tempCommentEnableUntil - now) / 60000)
      : 0;

    if (postRemaining > 0 || commentRemaining > 0) {
      const parts = [];
      if (postRemaining > 0) parts.push(`Post creation active (${postRemaining}m left)`);
      if (commentRemaining > 0) parts.push(`Comment creation active (${commentRemaining}m left)`);
      overrideStatusText.textContent = `⏳ Active Overrides: ${parts.join(' | ')}`;
    } else {
      overrideStatusText.textContent = 'No temporary overrides currently active.';
    }
  }

  updateOverrideText();

  btnTempPostOpt.addEventListener('click', async () => {
    const until = Date.now() + 600000;
    await StorageManager.updateSettings({ tempPostEnableUntil: until });
    settings.tempPostEnableUntil = until;
    updateOverrideText();
    showSaveFeedback();
  });

  btnTempCommentOpt.addEventListener('click', async () => {
    const until = Date.now() + 600000;
    await StorageManager.updateSettings({ tempCommentEnableUntil: until });
    settings.tempCommentEnableUntil = until;
    updateOverrideText();
    showSaveFeedback();
  });

  // Profile Overrides
  const profileToggle = document.getElementById('useManualProfile');
  const profileFields = document.getElementById('manual-profile-fields');
  const manualUsernameEl = document.getElementById('manualUsername');
  const manualAccountAgeDaysEl = document.getElementById('manualAccountAgeDays');
  const manualKarmaEl = document.getElementById('manualKarma');

  function updateProfileFieldsState() {
    if (profileToggle && profileFields) {
      if (profileToggle.checked) {
        profileFields.style.opacity = '1';
        profileFields.style.pointerEvents = 'auto';
      } else {
        profileFields.style.opacity = '0.5';
        profileFields.style.pointerEvents = 'none';
      }
    }
  }

  if (profileToggle && profileFields) {
    updateProfileFieldsState();
    profileToggle.addEventListener('change', updateProfileFieldsState);

    // Initialize values
    if (manualUsernameEl) manualUsernameEl.value = settings.manualUsername || '';
    if (manualAccountAgeDaysEl) manualAccountAgeDaysEl.value = settings.manualAccountAgeDays !== null ? settings.manualAccountAgeDays : '';
    if (manualKarmaEl) manualKarmaEl.value = settings.manualKarma !== null ? settings.manualKarma : '';

    const saveProfileData = async () => {
      const data = {
        manualUsername: manualUsernameEl.value.trim(),
        manualAccountAgeDays: manualAccountAgeDaysEl.value !== '' ? parseInt(manualAccountAgeDaysEl.value, 10) : null,
        manualKarma: manualKarmaEl.value !== '' ? parseInt(manualKarmaEl.value, 10) : null
      };
      await StorageManager.updateSettings(data);
      Object.assign(settings, data);
      showSaveFeedback();
    };

    [manualUsernameEl, manualAccountAgeDaysEl, manualKarmaEl].forEach(el => {
      if (el) {
        el.addEventListener('change', saveProfileData);
      }
    });

    // Update Detected Account Status in Profile Tab
    const optionsDetectedUsername = document.getElementById('optionsDetectedUsername');
    const optionsDetectedMeta = document.getElementById('optionsDetectedMeta');
    const optionsDetectedBadge = document.getElementById('optionsDetectedBadge');

    function updateDetectedAccountStatus() {
      if (!optionsDetectedUsername || !optionsDetectedMeta) return;

      if (settings.lastDetectedUser) {
        const u = settings.lastDetectedUser;
        const uName = u.username ? `u/${u.username}` : 'Logged In User';
        const age = u.accountAgeDays !== null ? `${u.accountAgeDays} days` : 'Unknown';
        const karma = u.combinedKarma !== null ? u.combinedKarma.toLocaleString() : 'Unknown';
        const time = u.timestamp ? new Date(u.timestamp).toLocaleTimeString() : 'Just now';

        optionsDetectedUsername.textContent = uName;
        optionsDetectedMeta.textContent = `Account Age: ${age} • Total Karma: ${karma} • Last synchronized: ${time}`;
        if (optionsDetectedBadge) {
          optionsDetectedBadge.textContent = 'CONNECTED';
          optionsDetectedBadge.style.background = 'rgba(34, 197, 94, 0.15)';
          optionsDetectedBadge.style.color = '#4ade80';
          optionsDetectedBadge.style.borderColor = 'rgba(74, 222, 128, 0.3)';
        }
      } else {
        optionsDetectedUsername.textContent = 'Auto-Detect Active';
        optionsDetectedMeta.textContent = 'Visit any Reddit page while logged in to automatically synchronize your account stats.';
        if (optionsDetectedBadge) {
          optionsDetectedBadge.textContent = 'WAITING';
          optionsDetectedBadge.style.background = 'rgba(234, 179, 8, 0.15)';
          optionsDetectedBadge.style.color = '#fde047';
          optionsDetectedBadge.style.borderColor = 'rgba(253, 224, 71, 0.3)';
        }
      }
    }

    updateDetectedAccountStatus();
  }

  // Render Rule Cache List
  async function renderRuleCache() {
    settings = await StorageManager.getSettings();
    const cacheListContainer = document.getElementById('cacheListContainer');
    const cacheCountText = document.getElementById('cacheCountText');
    const cacheMap = settings.ruleCache || {};
    const keys = Object.keys(cacheMap);

    cacheCountText.textContent = `${keys.length} subreddit${keys.length === 1 ? '' : 's'} cached locally`;

    if (keys.length === 0) {
      cacheListContainer.innerHTML = `<div class="empty-state">No subreddit rules currently cached. Visit Reddit subreddits to build cache.</div>`;
      return;
    }

    cacheListContainer.innerHTML = keys.map(sub => {
      const item = cacheMap[sub];
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString() + ' ' + new Date(item.timestamp).toLocaleTimeString() : 'Unknown';
      const parsed = item.parsedRules || {};

      const parsedSummary = [];
      if (parsed.accountAgeDays) parsedSummary.push(`Account Age: ${parsed.accountAgeDays} days`);
      if (parsed.commentKarma) parsedSummary.push(`Comment Karma: ${parsed.commentKarma}`);
      if (parsed.postKarma) parsedSummary.push(`Post Karma: ${parsed.postKarma}`);
      if (parsed.combinedKarma) parsedSummary.push(`Total Karma: ${parsed.combinedKarma}`);
      if (parsed.flairRequired) parsedSummary.push(`Flair Required`);
      if (parsed.noLinks) parsedSummary.push(`Links Restricted`);

      return `
        <div class="cache-card">
          <div class="cache-card-header">
            <span class="cache-sub-title">r/${sub}</span>
            <span class="cache-time">Last Checked: ${timeStr}</span>
          </div>
          <div class="cache-rules-preview">
            <strong>Detected Rules:</strong> ${parsedSummary.length > 0 ? parsedSummary.join(' • ') : 'General community rules'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Clear Rule Cache
  document.getElementById('btnClearCache').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all locally cached subreddit rules?')) {
      await StorageManager.updateSettings({ ruleCache: {} });
      settings.ruleCache = {};
      renderRuleCache();
      showSaveFeedback();
    }
  });

  // Reset Default Configuration
  document.getElementById('btnResetDefaults').addEventListener('click', async () => {
    if (confirm('Restore all extension settings back to factory default values?')) {
      await StorageManager.updateSettings(DEFAULT_SETTINGS);
      window.location.reload();
    }
  });
});
