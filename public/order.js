// js/app.js
document.addEventListener('DOMContentLoaded', function () {
  const tabButtons = Array.from(document.querySelectorAll('.tabs .tab'));
  const panels = {
    active: document.getElementById('tab-active'),
    scheduled: document.getElementById('tab-scheduled'),
    history: document.getElementById('tab-history')
  };

  // Ensure every tab button has a data-tab attribute (fallback to text)
  tabButtons.forEach(btn => {
    if (!btn.dataset.tab) {
      btn.dataset.tab = btn.textContent.trim().toLowerCase();
    }
  });

  // --- Sliding pill setup (creates .tab-pill and syncing) ---
  (function enableSlidingTabPill() {
    const tabsEl = document.querySelector('.tabs');
    if (!tabsEl) return;

    // create pill element if not present
    let pill = tabsEl.querySelector('.tab-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'tab-pill';
      tabsEl.insertBefore(pill, tabsEl.firstChild);
    }

    // function to position pill relative to a button
    function positionPillFor(button) {
      if (!button) return hidePill();
      const tabsRect = tabsEl.getBoundingClientRect();
      const btnRect = button.getBoundingClientRect();

      // calculate left relative to tabs container with a tiny padding
      const left = Math.round(btnRect.left - tabsRect.left + 4);
      const width = Math.round(Math.max(48, btnRect.width - 8));

      // apply styles (use transform for smoother animation if desired)
      pill.style.left = `${left}px`;
      pill.style.width = `${width}px`;
      pill.style.opacity = '1';
    }

    function hidePill() {
      pill.style.opacity = '0';
    }

    function syncPillToActive() {
      // find active button (aria-selected="true") or .tab-active
      const activeBtn = tabsEl.querySelector('.tab[aria-selected="true"]') || tabsEl.querySelector('.tab.tab-active');
      if (activeBtn) positionPillFor(activeBtn);
      else hidePill();
    }

    // debounce resize handling
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncPillToActive, 110);
    });

    window.addEventListener('orientationchange', () => {
      // small delay to allow layout to stabilize on orientation change
      setTimeout(syncPillToActive, 80);
    });

    // expose refresh function globally so other code can call it
    window.__refreshTabPill = syncPillToActive;

    // initial sync after a short delay to let DOM/CSS settle
    setTimeout(syncPillToActive, 40);
  })();
  // --- end sliding pill setup ---

  // activateTab updates button states and panels, and refreshes the pill
  function activateTab(tabName) {
    // update buttons
    tabButtons.forEach(btn => {
      const isTarget = btn.dataset.tab === tabName;
      btn.classList.toggle('tab-active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // show/hide panels with simple class toggle
    Object.keys(panels).forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      if (key === tabName) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    });

    // refresh pill position if available
    if (typeof window.__refreshTabPill === 'function') {
      // use rAF to ensure DOM updates applied before measuring
      window.requestAnimationFrame(() => {
        window.__refreshTabPill();
      });
    }

    // OPTIONAL: update URL query param so tab can be shared/bookmarked
    // history.replaceState(null, '', '?tab=' + tabName);
  }

  // attach click listeners to tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName) activateTab(tabName);
    });

    // keyboard support: Enter/Space to activate
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const tabName = btn.dataset.tab;
        if (tabName) activateTab(tabName);
      }
    });
  });

  // initial: read ?tab= from URL if present, otherwise default to 'active'
  (function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t && panels[t]) activateTab(t);
    else {
      // if any tab already marked aria-selected=true use it, otherwise default 'active'
      const preselected = tabButtons.find(b => b.getAttribute('aria-selected') === 'true');
      if (preselected && panels[preselected.dataset.tab]) {
        activateTab(preselected.dataset.tab);
      } else {
        activateTab('active');
      }
    }
  })();
});
