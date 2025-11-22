// item.js — dynamic loader: fetch item.json, render product fields, then init options logic
(async function () {
  'use strict';

  // helpers
  const q = s => document.querySelector(s);
  const formatPrice = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n) || 0);
  const intVal = v => Number(String(v).replace(/[^\d]/g, '')) || 0;
  const getIdFromUrl = () => new URLSearchParams(location.search).get('id');

  // try fetch item.json (adjust filename if you use another name)
  async function loadProducts() {
    const urls = ['item.json', 'products.json', '/item.json', '/products.json'];
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) continue;
        const json = await res.json();
        if (Array.isArray(json)) return json;
      } catch (e) { /* ignore and try next */ }
    }
    throw new Error('products file not found (tried item.json/products.json)');
  }

  // main
  try {
    const id = getIdFromUrl();
    if (!id) {
      console.error('No product id in URL (use ?id=product-id)');
      // optionally keep default static content
    } else {
      const products = await loadProducts();
      const product = products.find(p => p.id === id);
      if (!product) {
        console.error('Product not found for id:', id);
      } else {
        // render fields (selectors must exist in item.html)
        const nameEl = q('.product-name');
        const subEl = q('.product-subtitle'); // optional
        const priceEl = q('#product-price');
        const imgEl = q('.product-image'); // may be <img> or container
        const descEl = q('#detail-desc');

        if (nameEl) {
          nameEl.textContent = product.title || '';
          nameEl.dataset.id = product.id; // helpful for cart
        }
        if (subEl) subEl.textContent = product.subtitle || '';
        if (priceEl) {
          priceEl.dataset.base = product.price || 0; // numeric base for option logic
          priceEl.textContent = formatPrice(product.price || 0);
          priceEl.setAttribute('aria-live', 'polite');
        }
        if (imgEl) {
          // handle two cases: .product-image is an <img> or a container div
          if (imgEl.tagName && imgEl.tagName.toLowerCase() === 'img') {
            imgEl.src = (product.images && product.images[0]) || '';
            imgEl.alt = product.title || '';
          } else {
            imgEl.innerHTML = `<img src="${(product.images && product.images[0]) || ''}" alt="${product.title || ''}" />`;
          }
        }
        if (descEl) descEl.innerHTML = product.description || '';

        // now product fields updated — proceed to initialize options/price logic
        // If you have initOptionButtons() and updatePriceFromUI() in your item.js previously,
        // call them here. Example:
        if (typeof window.initOptionButtons === 'function') window.initOptionButtons();
        if (typeof window.updatePriceFromUI === 'function') window.updatePriceFromUI();
      }
    }
  } catch (err) {
    console.error('Error loading product:', err);
  }

  // --- If you don't have global init functions, include (or append) your options + price logic here ---
  // Below is a compact version of option init & price update if you haven't separated them:
  // (You can remove if you already have the full item.js logic loaded after this script.)
  function attachOptionLogic() {
    // single small implementation to make sure price updates use #product-price[data-base]
    const priceEl = q('#product-price');
    const base = intVal(priceEl?.dataset.base || 0);
    let currentTotal = base;

    function updatePriceFromUI() {
      let total = base;
      const milkSel = document.querySelector('.option-group[data-key="milk"] button[aria-pressed="true"]');
      if (milkSel) total += intVal(milkSel.dataset.priceDelta || 0);
      document.querySelectorAll('.option-group[data-key="addons"] button[aria-pressed="true"]').forEach(b => total += intVal(b.dataset.price || 0));
      currentTotal = total;
      if (priceEl) priceEl.textContent = formatPrice(total);
    }

    // initialize button behaviors (radio-like & toggles)
    document.querySelectorAll('.option-group').forEach(group => {
      const buttons = Array.from(group.querySelectorAll('button'));
      const isAddon = group.dataset.key === 'addons';
      buttons.forEach(btn => {
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

    window.updatePriceFromUI = updatePriceFromUI; // expose for earlier call
    window.initOptionButtons = function () { /* noop if already attached */ }; // placeholder
    // run one update
    setTimeout(updatePriceFromUI, 40);
  }

  // attach logic (if not already present)
  attachOptionLogic();

})();
