// notif.js — notification center (tanpa dummy seed + mark as read)
(function () {
  'use strict';

  const STORAGE_KEY = 'notifications_v1';

  function loadNotifs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveNotifs(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  }

  function renderList() {
    const listEl = document.getElementById('notif-list');
    const emptyEl = document.getElementById('notif-empty');
    if (!listEl || !emptyEl) return;

    const notifs = loadNotifs();
    listEl.innerHTML = '';

    if (!notifs.length) {
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    notifs.forEach(n => {
      const card = document.createElement('article');
      card.className = 'notif-card';
      card.dataset.id = n.id;

      card.innerHTML = `
        <div class="notif-card-header">
          <div class="notif-card-title">
            <span class="notif-card-emoji">${n.emoji || ''}</span>
            ${escapeHtml(n.title || '')}
          </div>
          <div class="notif-card-time">${escapeHtml(n.time || '')}</div>
        </div>
        <div class="notif-card-body">
          ${escapeHtml(n.message || '')}
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function clearAll() {
    saveNotifs([]);
    renderList();
  }

  // ✅ tandai semua notif sebagai sudah dibaca
  function markAllAsRead() {
    const list = loadNotifs();
    if (!Array.isArray(list) || !list.length) return;

    let changed = false;
    const updated = list.map(n => {
      if (!n.isRead) {
        changed = true;
        // clone + set isRead
        return Object.assign({}, n, { isRead: true });
      }
      return n;
    });

    if (changed) {
      saveNotifs(updated);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // tampilkan notif
    renderList();
    // dan langsung anggap sudah dibaca
    markAllAsRead();

    const btnBack = document.getElementById('btn-back');
    const btnClear = document.getElementById('btn-clear');

    if (btnBack) {
      btnBack.addEventListener('click', function () {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = 'order.html';
        }
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (confirm('Clear all notifications?')) {
          clearAll();
        }
      });
    }
  });

})();
