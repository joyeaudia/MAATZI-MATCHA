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

// ===== Heart (Like) handler: save to localStorage 'likes' =====
(function(){
  const heartBtn = document.querySelector('.heart');
  if (!heartBtn) return;

  // helper localStorage read/write
  const loadLikes = () => {
    try { return JSON.parse(localStorage.getItem('likes')||'[]'); } catch(e){ return []; }
  };
  const saveLikes = (arr) => localStorage.setItem('likes', JSON.stringify(arr||[]));

  // small toast
  function miniToast(msg) {
    let t = document.querySelector('.mini-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'mini-toast';
      Object.assign(t.style, {
        position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:'28px',
        background:'#111', color:'#fff', padding:'8px 12px', borderRadius:'8px', zIndex:1600, opacity:0, transition:'opacity .18s'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    setTimeout(()=> t.style.opacity = '0', 1300);
  }

  // build a minimal product object to store
  function makeLikeObj() {
    const id = document.querySelector('.product-name')?.dataset?.id || new URLSearchParams(location.search).get('id') || '';
    const title = document.querySelector('.product-name')?.textContent?.trim() || document.title || '';
    const imgEl = document.querySelector('.product-image') || document.querySelector('.product-image img');
    const image = (imgEl && imgEl.tagName && imgEl.tagName.toLowerCase()==='img') ? imgEl.src : (imgEl && imgEl.querySelector && imgEl.querySelector('img')?.src) || '';
    const price = Number(document.getElementById('product-price')?.dataset?.base || 0);
    return { id, title, image, price };
  }

  heartBtn.addEventListener('click', function(e){
    const pressed = heartBtn.getAttribute('aria-pressed') === 'true';
    // toggle visual state
    heartBtn.setAttribute('aria-pressed', String(!pressed));

    // animate a little
    try { heartBtn.animate([{ transform:'scale(1)'},{ transform:'scale(1.12)'},{ transform:'scale(1)' }], { duration: 220 }); } catch(e){}

    // update localStorage
    const likes = loadLikes();
    const obj = makeLikeObj();
    if (!obj.id) {
      // fallback: don't store nameless items
      miniToast('Tidak dapat menyukai item ini');
      return;
    }

    const idx = likes.findIndex(x => x.id === obj.id);
    if (!pressed) {
      // add
      if (idx === -1) likes.unshift(obj);
      saveLikes(likes);
      miniToast('Ditambahkan ke Liked');
    } else {
      // remove
      if (idx > -1) likes.splice(idx, 1);
      saveLikes(likes);
      miniToast('Dihapus dari Liked');
    }

    // optional: dispatch event so bagfr page can listen (if open in same tab)
    window.dispatchEvent(new CustomEvent('likes:updated', { detail: { likes } }));
  });
})();

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

// === ADD TO BAG (paste at end of product page JS) ===
(function(){
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const num = v => Number(String(v||0).replace(/[^\d]/g,'')) || 0;

  function readOptions() {
    const addons = [];
    // button-style
    qa('.option-group button[aria-pressed="true"]').forEach(btn=>{
      const id = btn.dataset.choiceId || btn.dataset.id || btn.getAttribute('data-id') || btn.textContent.trim();
      const label = btn.dataset.label || btn.textContent.trim();
      const price = num(btn.dataset.price ?? btn.dataset.priceDelta ?? btn.getAttribute('data-price-delta'));
      addons.push({ id: String(id).replace(/_/g,'-'), label, price });
    });
    // inputs/selects
    const cont = document.getElementById('product-options');
    if (cont) {
      cont.querySelectorAll('input').forEach(inp=>{
        if (inp.disabled) return;
        if ((inp.type==='checkbox' && inp.checked) || (inp.type==='radio' && inp.checked)) {
          const id = inp.dataset.choiceId || inp.id || (inp.name + '_' + inp.value);
          const label = inp.dataset.label || cont.querySelector(`label[for="${inp.id}"]`)?.textContent?.trim() || id;
          const price = num(inp.dataset.price || inp.getAttribute('data-price') || 0);
          addons.push({ id: String(id).replace(/_/g,'-'), label: label.trim(), price });
        }
      });
      cont.querySelectorAll('select').forEach(sel=>{
        const opt = sel.options[sel.selectedIndex];
        if (opt && !opt.disabled) {
          const price = num(opt.dataset.price || opt.getAttribute('data-price') || 0);
          addons.push({ id: sel.name + '_' + opt.value, label: opt.text || opt.value, price });
        }
      });
    }
    return addons;
  }

  function compute(base, qty, addons){
    const addTotal = (addons||[]).reduce((s,a)=>s + Number(a.price||0), 0);
    const unit = Number(base||0) + addTotal;
    return { unit, subtotal: unit * Math.max(1, Number(qty||1)), addTotal };
  }

  function loadCart(){ try{ return JSON.parse(localStorage.getItem('cart')||'[]'); }catch(e){return []} }
  function saveCart(c){ localStorage.setItem('cart', JSON.stringify(c||[])); }

  function merge(cart, item){
    const sig = it => (it.addons||[]).map(a=>a.id).sort().join('|');
    const s = sig(item);
    for (let i=0;i<cart.length;i++){
      if (cart[i].id === item.id && sig(cart[i]) === s) {
        cart[i].qty = Number(cart[i].qty || 1) + Number(item.qty || 1);
        cart[i].subtotal = Number(cart[i].subtotal || 0) + Number(item.subtotal || 0);
        return cart;
      }
    }
    cart.push(item);
    return cart;
  }

  function toast(msg='Added to bag') {
    let t = document.querySelector('.mini-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'mini-toast';
      t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:28px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;z-index:1600;opacity:0;transition:opacity .18s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(()=> t.style.opacity = '0', 1200);
  }

function addToBag(goToBag = true) {
  // ambil id/title/price/qty dari halaman
  const id = q('.product-name')?.dataset?.id || new URLSearchParams(location.search).get('id');
  const title = (q('.product-name')?.textContent || q('.product-title')?.textContent || '').trim();
  const base = num(q('#product-price')?.dataset?.base || q('#product-price')?.textContent);
  const qty = Number(q('#quantity')?.value || 1);

  if (!id) { console.warn('no product id'); return false; }

  const addons = readOptions();
  const pricing = compute(base, qty, addons);

  // ambil gambar produk dengan aman (bisa container atau <img>)
  const productImageEl = q('.product-image');
  const imageSrc = (productImageEl && productImageEl.tagName && productImageEl.tagName.toLowerCase() === 'img')
    ? productImageEl.src
    : (q('.product-image img')?.src || '');

  // objek item final untuk disimpan ke cart
  const item = {
    id: String(id),
    title: title,
    unitPrice: Number(pricing.unit || 0),
    qty: Number(qty || 1),
    addons: Array.isArray(addons) ? addons : [],
    subtotal: Number(pricing.subtotal || 0),
    image: imageSrc || ''
  };

  // merge ke cart dan simpan
  let cart = loadCart();
  cart = merge(cart, item);
  saveCart(cart);

  toast('Item added to bag');

  if (goToBag) setTimeout(() => window.location.href = 'bagfr.html', 450);
  return true;
}



  document.addEventListener('click', e=>{
    const btn = e.target.closest && e.target.closest('.add-btn, [data-add-to-bag]');
    if (!btn) return;
    e.preventDefault();
    const noRedirect = btn.hasAttribute('data-no-redirect');
    addToBag(!noRedirect ? true : false);
  });

  window.addToBagFromPage = addToBag;
})();
// === CHECKOUT -> ORDER + WA (paste into bagfr.js) ===
(function(){
  const fmt = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n||0));
  function loadCart(){ try{return JSON.parse(localStorage.getItem('cart')||'[]')}catch(e){return []} }
  function saveOrders(arr){ localStorage.setItem('orders', JSON.stringify(arr||[])); }
  function loadOrders(){ try{return JSON.parse(localStorage.getItem('orders')||'[]')}catch(e){return []} }
  function genId(){ return 'ORD-' + new Date().toISOString().slice(0,10) + '-' + Math.random().toString(36).slice(2,6); }

  function buildMsg(order){
    const lines = [];
    lines.push(`📦 New Order — ${order.id}`);
    lines.push(`Waktu: ${new Date(order.createdAt).toLocaleString('id-ID')}`);
    lines.push('');
    order.items.forEach(it=>{
      const addon = (it.addons || []).map(a=>`${a.label} (+${fmt(a.price)})`).join(', ');
      lines.push(`• ${it.title} x${it.qty} — ${fmt(it.unitPrice)} ${addon? ' | '+addon : ''} = ${fmt(it.subtotal)}`);
    });
    lines.push('');
    lines.push(`Total: ${fmt(order.total)}`);
    lines.push('');
    lines.push('Nama:');
    lines.push('No. HP:');
    lines.push('Alamat / Catatan:');
    lines.push('');
    lines.push('Mohon konfirmasi ketersediaan & instruksi pembayaran via chat. Terima kasih!');
    return lines.join('\n');
  }

  document.addEventListener('click', function(e){
    if (!e.target.closest) return;
    const btn = e.target.closest('.checkout, [data-checkout]');
    if (!btn) return;
    e.preventDefault();
    const cart = loadCart();
    if (!cart.length) { alert('Keranjang kosong'); return; }
    // compute order
    let total=0;
    const items = cart.map(it=>{
      total += Number(it.subtotal||0);
      return {
        id: it.id, title: it.title, qty: it.qty, unitPrice: it.unitPrice, addons: it.addons || [], subtotal: it.subtotal
      };
    });
    const order = { id: genId(), createdAt: Date.now(), status: 'active', items, total };
    const orders = loadOrders(); orders.unshift(order); saveOrders(orders);

    // WA open
    const waUrl = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(buildMsg(order));
    window.open(waUrl, '_blank');

    // redirect to order page
    window.location.href = 'order.html?order=' + encodeURIComponent(order.id);
  });
})();
const likeObj = {
  id: productId,
  title: productTitle,
  image: productImageSrc,
  price: Number(productPrice || 0)
};
let likes = JSON.parse(localStorage.getItem('likes')||'[]');
likes.unshift(likeObj); // or push, but ensure no duplicates
localStorage.setItem('likes', JSON.stringify(likes));
window.dispatchEvent(new CustomEvent('likes:updated',{detail:{likes}}));


})();
