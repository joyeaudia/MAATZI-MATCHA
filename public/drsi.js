// drsi.js — cleaned + share menu + tolerant price reading
(async function () {
  'use strict';

  // helpers
  const q = s => document.querySelector(s);
  const formatPrice = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n) || 0);
  const intVal = v => Number(String(v || '').replace(/[^\d]/g, '')) || 0;
  const getIdFromUrl = () => new URLSearchParams(location.search).get('id');

  // try fetch item.json (adjust filename if you use another name)
  async function loadProducts() {
    const urls = ['drsi.json', 'dsri.json', 'products.json', '/drsi.json', '/products.json', '/dsri.json'];
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) continue;
        const json = await res.json();
        if (Array.isArray(json)) return json;
      } catch (e) { /* ignore and try next */ }
    }
    throw new Error('products file not found (tried drsi.json/products.json)');
  }

  // main
  try {
    const id = getIdFromUrl();
    if (!id) {
      console.error('No product id in URL (use ?id=product-id)');
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
          // also expose globally
          window.productBasePrice = Number(product.price || 0);
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
        if (descEl) {
          // support description as array or string
          if (Array.isArray(product.description)) descEl.innerHTML = product.description.join('<br><br>');
          else descEl.innerHTML = product.description || '';
        }

        // init option-related UI if present
        if (typeof window.initOptionButtons === 'function') window.initOptionButtons();
        if (typeof window.updatePriceFromUI === 'function') window.updatePriceFromUI();
      }
    }
  } catch (err) {
    console.error('Error loading product:', err);
  }

  // ---- option + price logic (compact, tolerant) ----
  function attachOptionLogic() {
    const priceEl = q('#product-price');
    const base = intVal(priceEl?.dataset.base || window.productBasePrice || 0);

    function readButtonPrice(btn) {
      // support data-price (preferred) or data-price-delta (legacy)
      const p = btn.dataset.price ?? btn.dataset.priceDelta ?? btn.getAttribute('data-price-delta');
      return intVal(p);
    }

    function updatePriceFromUI() {
      let total = base;
      // milk group (radio-like)
      const milkSel = document.querySelector('.option-group[data-key="milk"] button[aria-pressed="true"]');
      if (milkSel) total += readButtonPrice(milkSel);
      // addons (multiple)
      document.querySelectorAll('.option-group[data-key="addons"] button[aria-pressed="true"]').forEach(b => {
        total += readButtonPrice(b);
      });
      // update DOM
      if (priceEl) priceEl.textContent = formatPrice(total);
      const priceDisplay = document.getElementById('price-display');
      if (priceDisplay) priceDisplay.textContent = formatPrice(total);
    }

    // initialize button behaviors (radio-like & toggles)
    document.querySelectorAll('.option-group').forEach(group => {
      const buttons = Array.from(group.querySelectorAll('button'));
      const isAddon = group.dataset.key === 'addons';
      buttons.forEach(btn => {
        // normalize aria-pressed if missing
        if (!btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', 'false');
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

    // expose
    window.updatePriceFromUI = updatePriceFromUI;
    window.initOptionButtons = function () { /* noop */ };
    setTimeout(updatePriceFromUI, 40);
  }

  attachOptionLogic();

})(); // end async IIFE


// ---- Share menu IIFE (separate, runs after DOM ready because script is at body end) ----
(function(){
  const shareBtn = document.getElementById('share-btn');
  const shareMenu = document.getElementById('share-menu');
  const shareToast = document.getElementById('share-toast');
  const shareClose = document.getElementById('share-close');

  if (!shareBtn || !shareMenu) return; // nothing to do

  // use actual current page url
  const shareUrl = window.location.href;

  function showMenu() {
    shareMenu.style.display = 'block';
    shareMenu.setAttribute('aria-hidden', 'false');
  }
  function hideMenu() {
    shareMenu.style.display = 'none';
    shareMenu.setAttribute('aria-hidden', 'true');
  }
  function showToast(msg='Link copied!') {
    if (!shareToast) return;
    shareToast.textContent = msg;
    shareToast.hidden = false;
    setTimeout(()=> shareToast.hidden = true, 1600);
  }

  // copy to clipboard
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link disalin ke clipboard');
    } catch(e) {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('Link disalin ke clipboard'); } catch(err) { alert('Copy failed. Link: ' + shareUrl); }
      document.body.removeChild(ta);
    }
    hideMenu();
  }

  // Web Share API (native)
  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title || 'Check this product',
          text: 'Lihat produk ini:',
          url: shareUrl
        });
      } catch(err) {
        // ignore
      }
    } else {
      const wa = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareUrl);
      window.open(wa, '_blank');
    }
    hideMenu();
  }


  // event binding
  shareBtn.addEventListener('click', e => {
    e.stopPropagation();
    showMenu();
  });
  shareClose?.addEventListener('click', hideMenu);

  shareMenu.addEventListener('click', e => {
    const act = e.target.getAttribute('data-action');
    if (!act) return;
    if (act === 'copy') copyLink();
    if (act === 'native') nativeShare();
  });

  // close when clicking outside
  document.addEventListener('click', (ev) => {
    if (!shareMenu.contains(ev.target) && ev.target !== shareBtn) hideMenu();
  });

})();
