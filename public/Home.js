// Animasi & aksesibilitas untuk tombol Buy + Admin-editable Booths v1
document.addEventListener('DOMContentLoaded', function () {

  // ---- 1) Animasi & aksesibilitas untuk tombol Buy ----
  document.querySelectorAll('.buy-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      btn.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.06)', opacity: 0.95 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });

      btn.setAttribute('aria-pressed', 'true');
      setTimeout(()=> btn.removeAttribute('aria-pressed'), 600);
      // tempat panggil add-to-cart / open modal dsb.
    });

    btn.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); btn.click(); }
    });
  });

  // ---- 2) Admin-editable Booths v1 ----
  // Aktifkan admin mode dengan query param ?admin=1
  const chipsContainer = document.querySelector('.visit .grid');
  if (!chipsContainer) return; // nothing to do (no visit section on page)

  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin = urlParams.get('admin') === '1';

  const STORAGE_KEY = 'verent_booths_v1';
  function loadBoothsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse booths data', e);
      return null;
    }
  }

  function saveBoothsToStorage(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error('Failed to save booths', e);
    }
  }

  function readChipsFromDOM() {
    const chips = Array.from(chipsContainer.querySelectorAll('.chip'));
    return chips.map(chip => ({
      title: (chip.querySelector('.chip-title') || {}).textContent || '',
      small: (chip.querySelector('.small') || {}).textContent || ''
    }));
  }

  function renderBooths(data) {
    const existing = Array.from(chipsContainer.querySelectorAll('.chip'));
    data.forEach((b, idx) => {
      let chip = existing[idx];
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = '<div class="chip-title"></div><div class="small"></div>';
        chipsContainer.appendChild(chip);
      }
      const t = chip.querySelector('.chip-title');
      const s = chip.querySelector('.small');
      if (t) t.textContent = b.title;
      if (s) s.textContent = b.small;
    });
    // leave extra existing chips untouched
  }

  // initial load from storage (if any)
  const stored = loadBoothsFromStorage();
  if (stored && Array.isArray(stored) && stored.length) {
    renderBooths(stored);
  }

  // if not admin, stop here
  if (!isAdmin) return;

  // create admin UI controls (insert before the .grid)
  const adminBar = document.createElement('div');
  adminBar.className = 'admin-booth-bar';
  adminBar.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-bottom:8px;';
  adminBar.innerHTML = `
    <button type="button" class="btn-edit-booths">Edit Booths</button>
    <button type="button" class="btn-save-booths" style="display:none;">Save</button>
    <button type="button" class="btn-export-booths">Export</button>
    <button type="button" class="btn-import-booths">Import</button>
    <input type="file" accept="application/json" style="display:none;" class="btn-import-file">
  `;
  chipsContainer.parentNode.insertBefore(adminBar, chipsContainer);

  const btnEdit = adminBar.querySelector('.btn-edit-booths');
  const btnSave = adminBar.querySelector('.btn-save-booths');
  const btnExport = adminBar.querySelector('.btn-export-booths');
  const btnImport = adminBar.querySelector('.btn-import-booths');
  const inputFile = adminBar.querySelector('.btn-import-file');

  let editing = false;

  function enableEditing() {
    editing = true;
    btnEdit.style.display = 'none';
    btnSave.style.display = 'inline-block';
    chipsContainer.querySelectorAll('.chip').forEach(chip => {
      const t = chip.querySelector('.chip-title');
      const s = chip.querySelector('.small');
      if (t) {
        t.setAttribute('contenteditable', 'true');
        t.setAttribute('aria-label', 'Edit booth title');
        t.classList.add('editable');
      }
      if (s) {
        s.setAttribute('contenteditable', 'true');
        s.setAttribute('aria-label', 'Edit booth time');
        s.classList.add('editable');
      }
      chip.style.outline = '2px dashed rgba(0,150,80,0.12)';
      chip.style.padding = '10px';
    });
    const firstTitle = chipsContainer.querySelector('.chip .chip-title');
    if (firstTitle) firstTitle.focus();
  }

  function disableEditing(save = false) {
    editing = false;
    btnEdit.style.display = 'inline-block';
    btnSave.style.display = 'none';
    chipsContainer.querySelectorAll('.chip').forEach(chip => {
      const t = chip.querySelector('.chip-title');
      const s = chip.querySelector('.small');
      if (t) {
        t.removeAttribute('contenteditable');
        t.classList.remove('editable');
      }
      if (s) {
        s.removeAttribute('contenteditable');
        s.classList.remove('editable');
      }
      chip.style.outline = '';
      chip.style.padding = '';
    });
    if (save) {
      const arr = readChipsFromDOM();
      saveBoothsToStorage(arr);
      btnSave.textContent = 'Saved ✓';
      setTimeout(()=> btnSave.textContent = 'Save', 1200);
    }
  }

  btnEdit.addEventListener('click', () => enableEditing());
  btnSave.addEventListener('click', () => disableEditing(true));

  btnExport.addEventListener('click', () => {
    const arr = readChipsFromDOM();
    const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booths.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  btnImport.addEventListener('click', () => inputFile.click());
  inputFile.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed)) throw new Error('Invalid format: expected array');
        renderBooths(parsed);
        saveBoothsToStorage(parsed);
        alert('Imported and saved booths.');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(f);
  });

  document.addEventListener('keydown', (ev) => {
    if (!editing) return;
    if (ev.key === 'Escape') {
      const stored = loadBoothsFromStorage();
      if (stored && stored.length) renderBooths(stored);
      disableEditing(false);
    }
  });

  // small style for editable text (you can move to utama.css if preferred)
  const style = document.createElement('style');
  style.innerHTML = `
    .chip .editable:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0,150,80,0.12);
      border-radius: 6px;
    }
    .admin-booth-bar .btn-edit-booths,
    .admin-booth-bar .btn-save-booths,
    .admin-booth-bar .btn-export-booths,
    .admin-booth-bar .btn-import-booths {
      background: #ffffff;
      border: 1px solid #e6e6e6;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
    }
    .admin-booth-bar .btn-save-booths { background: #e8fff3; border-color: rgba(0,150,80,0.12); }
  `;
  document.head.appendChild(style);
// fungsi yang membaca localStorage dan merender boilerplate visit grid
function reloadBoothsFromStorage() {
  try {
    const raw = localStorage.getItem('verent_booths_v1');
    if (!raw) return;
    const arr = JSON.parse(raw);
    // sesuaikan dengan fungsi render di utama.js; contoh generik:
    const container = document.querySelector('.visit .grid');
    if (!container) return;
    // kosongkan dan render ulang sesuai struktur arr
    container.innerHTML = '';
    arr.slice(0,4).forEach(b => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<div class="chip-title">${b.title || ''}</div><div class="small">${b.small || ''}</div>`;
      container.appendChild(chip);
    });
  } catch (e) {
    console.warn('Failed to reload booths', e);
  }
}

// reload when another tab/page (same origin) changes localStorage
window.addEventListener('storage', (ev) => {
  if (ev.key === 'verent_booths_v1') reloadBoothsFromStorage();
});

// also reload when user returns to the tab (safe fallback)
window.addEventListener('focus', () => reloadBoothsFromStorage());

// initial load (if you didn't already load elsewhere)
document.addEventListener('DOMContentLoaded', () => reloadBoothsFromStorage());


function reloadBoothsFromStorage() {
  try {
    const raw = localStorage.getItem('verent_booths_v1');
    console.log('UTAMA: raw localStorage for verent_booths_v1 ->', raw);
    if (!raw) return;
    const arr = JSON.parse(raw);
    console.log('UTAMA: parsed booths ->', arr);
    // -- kemudian render sesuai fungsi render di utama.js --
  } catch (e) {
    console.error('UTAMA: failed to read booths', e);
  }
}

window.addEventListener('storage', (ev) => {
  if (ev.key === 'verent_booths_v1') {
    console.log('UTAMA: storage event fired', ev);
    reloadBoothsFromStorage();
  }
});

document.addEventListener('DOMContentLoaded', () => reloadBoothsFromStorage());

}); // end DOMContentLoaded

