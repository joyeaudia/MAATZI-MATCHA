// prl.js — show profile + connected default shipping address from savedAddresses_v1
(function () {
  const DEFAULT_PROFILE = {
    firstName: 'Veren',
    lastName: 'Florensa',
    email: 'verentflorensa@gmail.com',
    phone: '08118281416',
    address: 'Green Lake City cluster Europe,\\nKetapang, Cipondoh.\\nTangerang, Banten 15147',
    memberSince: '2024'
  };

  const PROFILE_KEY = 'profile';
  const ADDR_KEY = 'savedAddresses_v1';

  function safeParseJSON(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      return fallback;
    }
  }

  function getProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return DEFAULT_PROFILE;
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_PROFILE, parsed);
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  }

  function getSavedAddresses() {
    const raw = localStorage.getItem(ADDR_KEY);
    const parsed = safeParseJSON(raw, null);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  }

  function chooseAddress(arr) {
    if (!arr || !arr.length) return null;
    const def = arr.find(a => a.isDefault);
    return def || arr[0] || null;
  }

  function escapeHtml(s){
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function nl2br_escaped(s){
    return escapeHtml(s).replace(/\n/g, '<br>');
  }

  function setText(id, text, options = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    if (options.allowHtml) {
      el.innerHTML = text || '';
    } else {
      el.textContent = text || '';
    }
  }

  function render() {
    // profile basics
    const p = getProfile();
    setText('name-first', p.firstName || '');
    setText('name-last', p.lastName || '');
    setText('email-val', p.email || '');
    setText('phone-val', p.phone || '');
    setText('member-since', p.memberSince || '');

    // address: prefer savedAddresses_v1
    const addrs = getSavedAddresses();
    const chosen = chooseAddress(addrs);

    if (chosen) {
      // Build combined "Label - Name" first line, then phone + address below
      const label = escapeHtml(chosen.label || '');
      const name = escapeHtml(chosen.name || '');
      const phone = escapeHtml(chosen.phone || '');
      const addr = nl2br_escaped(chosen.address || '');

      // Combined first line: "Label - Name"
      const combined = `${label ? label : ''}${label && name ? ' - ' : ''}${name ? name : ''}`;

      const html = `
        <div class="prl-address-line-combined">${combined}</div>
        ${phone ? `<div class="prl-address-phone">${phone}</div>` : ''}
        <div class="prl-address-body">${addr}</div>
      `;
      setText('address-text', html, { allowHtml: true });
    } else {
      // fallback to profile.address (if any)
      setText('address-text', (p.address || ''), { allowHtml: true });
    }
  }

  // Listen to any storage changes for profile or addresses
  window.addEventListener('storage', function (ev) {
    if (ev.key === PROFILE_KEY || ev.key === ADDR_KEY) {
      render();
    }
  });

  document.addEventListener('DOMContentLoaded', render);
})();
