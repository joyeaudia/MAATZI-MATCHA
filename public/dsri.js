// item.js — dynamic loader + options + price logic (cleaned + pill-button UI)
(async function () {
  'use strict';

  /* ===========
     Helpers
     =========== */
  const q = s => document.querySelector(s);
  const formatPrice = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n) || 0);
  const intVal = v => Number(String(v).replace(/[^\d]/g, '')) || 0;
  const getIdFromUrl = () => new URLSearchParams(location.search).get('id');

  // simple element creator
  function el(tag, attrs = {}) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'class') e.className = v;
      else e.setAttribute(k, String(v));
    });
    return e;
  }

  /* =========================
     Load products JSON file
     Tries several filenames/paths (prefer dsri.json)
     ========================= */
  async function loadProducts() {
    const urls = ['dsri.json', 'products.json', '/dsri.json', '/products.json'];
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) continue;
        const json = await res.json();
        if (Array.isArray(json)) return json;
      } catch (e) { /* ignore and try next */ }
    }
    throw new Error('products file not found (tried dsri.json/products.json)');
  }

  /* ======================
     Render product into DOM
     ====================== */
  function renderProduct(product) {
    const nameEl = q('.product-name');
    const subEl = q('.product-subtitle');
    const priceEl = q('#product-price');
    const imgEl = q('.product-image');
    const descEl = q('#detail-desc');
    const qtyEl = q('#quantity');

    if (nameEl) {
      nameEl.textContent = product.title || '';
      nameEl.dataset.id = product.id || '';
    }
    if (subEl) subEl.textContent = product.subtitle || '';
    window.productBasePrice = Number(product.price || 0);
    if (priceEl) {
      priceEl.dataset.base = window.productBasePrice;
      priceEl.textContent = formatPrice(window.productBasePrice);
      priceEl.setAttribute('aria-live', 'polite');
    }
    if (imgEl) {
      const src = (product.images && product.images[0]) || '';
      const alt = product.title || '';
      if (imgEl.tagName && imgEl.tagName.toLowerCase() === 'img') {
        imgEl.src = src;
        imgEl.alt = alt;
      } else {
        imgEl.innerHTML = `<img src="${src}" alt="${alt}" />`;
      }
    }
    if (descEl) descEl.innerHTML = product.description || '';
    // Render Tips (if any)
const tipsList = document.getElementById('tips-list');
if (tipsList) {
  if (Array.isArray(product.tips) && product.tips.length > 0) {
    tipsList.innerHTML = '';
    product.tips.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      tipsList.appendChild(li);
    });
  } else {
    // default tips if none in JSON
    tipsList.innerHTML = `
      <li>Serve chilled for best taste.</li>
      <li>Consume within 4 hours for optimal freshness.</li>
    `;
  }
}

    if (qtyEl && (!qtyEl.value || Number(qtyEl.value) <= 0)) qtyEl.value = 1;
  }

  /* =========================
     Render product options UI (Pill buttons for radio/checkbox)
     ========================= */
  function renderOptions(options = []) {
    const container = document.getElementById('product-options');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(options) || options.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';

    options.forEach(group => {
      const fieldset = el('fieldset', { class: 'opt-group' });
      const legend = el('legend', { text: group.title || '' });
      fieldset.appendChild(legend);

      if (group.note) fieldset.appendChild(el('p', { class: 'opt-note', text: group.note }));

      const inputName = group.key || ('opt_' + Math.random().toString(36).slice(2,7));

      // SELECT: native select dropdown
      if (group.type === 'select') {
        const select = el('select', { name: inputName });
        select.addEventListener('change', () => updatePriceFromUI());
        group.choices.forEach(choice => {
          const opt = el('option', { value: choice.id, text: choice.label || choice.id });
          opt.dataset.price = choice.price || 0;
          if (choice.enabled === false) opt.disabled = true;
          if (choice.default) opt.selected = true;
          select.appendChild(opt);
        });
        fieldset.appendChild(select);
        container.appendChild(fieldset);
        return;
      }

      // radio / checkbox => render pill buttons
      const groupWrap = el('div', { class: 'choices' });
      group.choices.forEach(choice => {
        const isCheckbox = (group.type === 'checkbox') && (group.key !== 'sauce');        const btnClass = isCheckbox ? 'addon-btn' : 'opt-btn';
        const btn = el('button', {
          class: btnClass,
          type: 'button',
          'data-price': choice.price || 0,
          'data-choice-id': choice.id,
          'aria-pressed': choice.default ? 'true' : 'false',
          'aria-label': choice.label || choice.id,
          text: choice.label || choice.id
        });

        if (choice.enabled === false) {
          btn.disabled = true;
          btn.classList.add('disabled');
        }

        if (choice.price) {
          const hint = el('small', { class: 'opt-price', text: ' (+' + new Intl.NumberFormat('id-ID').format(choice.price) + ')' });
          btn.appendChild(hint);
        }

        btn.addEventListener('click', () => {
          if (choice.enabled === false) return;
          if (isCheckbox) {
            const cur = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', (!cur).toString());
          } else {
            groupWrap.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
          }
          updatePriceFromUI();
        });

        btn.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            btn.click();
          }
        });

        groupWrap.appendChild(btn);
      });

      fieldset.appendChild(groupWrap);
      container.appendChild(fieldset);
    });

    updatePriceFromUI();
  }

  /* ===========================
     Compute options extra cost
     (now supports <input>, <select>, and pill <button>)
     =========================== */
  function computeOptionsDelta() {
    const container = document.getElementById('product-options');
    if (!container) return 0;
    let delta = 0;
    // inputs
    container.querySelectorAll('input').forEach(i => {
      if (i.disabled) return;
      if (i.type === 'checkbox' && i.checked) delta += Number(i.dataset.price || 0);
      if (i.type === 'radio' && i.checked) delta += Number(i.dataset.price || 0);
    });
    // selects
    container.querySelectorAll('select').forEach(s => {
      if (s.disabled) return;
      const opt = s.options[s.selectedIndex];
      if (opt && !opt.disabled) delta += Number(opt.dataset.price || 0);
    });
    // pill buttons
    container.querySelectorAll('button[data-choice-id]').forEach(b => {
      if (b.disabled) return;
      if (b.getAttribute('aria-pressed') === 'true') delta += Number(b.dataset.price || 0);
    });
    return delta;
  }

  /* ===========================
     Update price displayed on page
     =========================== */
  function updatePriceFromUI() {
    try {
      const base = Number(window.productBasePrice || 0);
      const optionsDelta = computeOptionsDelta();
      const qty = Number(document.getElementById('quantity')?.value || 1);
      const total = (base + optionsDelta) * Math.max(1, qty);

      const baseEl = document.getElementById('product-price');
      if (baseEl) baseEl.textContent = formatPrice(base + optionsDelta);
      const priceEl = document.getElementById('price-display') || document.getElementById('product-price');
      if (priceEl) priceEl.textContent = formatPrice(total);
    } catch (e) {
      console.error('updatePriceFromUI error', e);
    }
  }

  /* ===========================
     Attach option button behavior for existing static markup
     =========================== */
  function attachOptionLogicForButtons() {
    document.querySelectorAll('.option-group').forEach(group => {
      const buttons = Array.from(group.querySelectorAll('button'));
      if (!buttons.length) return;
      const isAddon = group.dataset.key === 'addons';
      buttons.forEach(btn => {
        if (btn.dataset.price === undefined) btn.dataset.price = btn.getAttribute('data-price') || 0;
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.addEventListener('click', () => {
          if (isAddon) {
            const cur = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', (!cur).toString());
          } else {
            buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
          }
          updatePriceFromUI();
        });
        btn.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); btn.click(); }
        });
      });
    });
  }

  /* ===========================
     Initialization
     =========================== */
  try {
    const id = getIdFromUrl();
    if (!id) {
      console.error('No product id in URL (use ?id=product-id). Keeping static/default content if present.');
      attachOptionLogicForButtons();
      document.getElementById('quantity')?.addEventListener('change', updatePriceFromUI);
    } else {
      const products = await loadProducts();
      const product = products.find(p => p.id === id);
      if (!product) {
        console.error('Product not found for id:', id);
        attachOptionLogicForButtons();
      } else {
        renderProduct(product);
        const opts = product.options || product.optionGroups || [];
        renderOptions(opts);
        attachOptionLogicForButtons();
        const qty = document.getElementById('quantity');
        if (qty) qty.addEventListener('change', updatePriceFromUI);
      }
    }
  } catch (err) {
    console.error('Error loading product:', err);
  }

  // Expose globally
  window.renderOptions = renderOptions;
  window.updatePriceFromUI = updatePriceFromUI;
  window.computeOptionsDelta = computeOptionsDelta;
}

)(); // end IIFE
