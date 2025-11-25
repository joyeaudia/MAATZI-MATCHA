// Simple multi-address manager using localStorage
(function(){
  const KEY = 'savedAddresses_v1';
  const listEl = document.getElementById('address-list');
  const doneBtn = document.getElementById('done-btn');

  // sample initial addresses (only used when storage empty)
  const SAMPLE = [
    {
      label: 'Home',
      name: 'Verent Florensa',
      phone: '08118281416',
      address: 'Green Lake City cluster Europe,\nKetapang, Cipondoh.\nTangerang, Banten 15147',
      isDefault: true
    },
    {
      label: 'Office',
      name: 'Verent Florensa',
      phone: '08118281416',
      address: 'Office Building Lt. 5\nJl. Example No.10\nJakarta Selatan',
      isDefault: false
    },
    {
      label: "Ashley's",
      name: 'Verent Florensa',
      phone: '08118281416',
      address: 'Some other address\nCity, Province',
      isDefault: false
    }
  ];

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return SAMPLE.slice();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return SAMPLE.slice();
      return parsed;
    } catch (e) { return SAMPLE.slice(); }
  }

  function write(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

  function render() {
    const arr = read();
    listEl.innerHTML = '';
    if (!arr.length) {
      listEl.innerHTML = '<div class="empty">No saved addresses yet. Click Add New Address.</div>';
      return;
    }

    arr.forEach((it, idx) => {
      const card = document.createElement('div');
      card.className = 'address-card';
card.innerHTML = `
  <div class="address-label">${escapeHtml(it.label || '')}</div> <input class="address-radio" type="radio" name="addrSelect" data-idx="${idx}" ${it.isDefault ? 'checked' : ''} aria-label="Select ${escapeHtml(it.label||'address')}">
  <div class="addr-name">${escapeHtml(it.name||'')}</div>      
  <div class="addr-phone">${escapeHtml(it.phone||'')}</div>
        <div class="address-divider"></div>
        <div class="addr-full">${(escapeHtml(it.address||'')).replace(/\n/g,'<br>')}</div>
      `;
      listEl.appendChild(card);
    });

    // attach change handlers for radios
    listEl.querySelectorAll('.address-radio').forEach(r => {
      r.addEventListener('change', function(e){
        const idx = Number(this.dataset.idx);
        const arr = read();
        arr.forEach((x,i)=> x.isDefault = (i===idx));
        write(arr);
      });
    });
  }

  // helpers
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Done button: save then go back to profile (prl.html)
  doneBtn.addEventListener('click', function(){
    // simply redirect back (profile will read addresses from localStorage as needed)
    window.location.href = 'prl.html';
  });

  // initialize
  document.addEventListener('DOMContentLoaded', render);
})();
