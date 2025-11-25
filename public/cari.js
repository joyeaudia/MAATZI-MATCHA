// script.js
const recentGrid = document.getElementById('recent-grid');
const resultsGrid = document.getElementById('results');
const q = document.getElementById('q');
const clearBtn = document.getElementById('clear-recent');

const JSON_PATHS = [
  'drsi.json', // drinks (uploaded). See file. :contentReference[oaicite:2]{index=2}
  'dsri.json'  // desserts (uploaded). See file. :contentReference[oaicite:3]{index=3}
];

let catalog = []; // merged JSON
const RECENT_KEY = 'recently_viewed_v1';
const MAX_RECENT = 8;

async function loadCatalog(){
  const promises = JSON_PATHS.map(p => fetch(p).then(r => r.json()).catch(e => {
    console.error('Gagal load', p, e);
    return [];
  }));
  const arrays = await Promise.all(promises);
  catalog = arrays.flat();
  // normalize: ensure each item has id,title,price,images array
  catalog = catalog.map(it => ({
    id: it.id || '',
    title: it.title || '',
    price: it.price || 0,
    images: Array.isArray(it.images) ? it.images : (it.images ? [it.images] : []),
    ...it
  }));
}

function getRecent(){
  try{
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}
function setRecent(arr){
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0,MAX_RECENT)));
}

function renderRecent(){
  const rec = getRecent();
  recentGrid.innerHTML = '';
  if(rec.length === 0){
    // show empty placeholders (same as earlier design)
    for(let i=0;i<4;i++){
      const d = document.createElement('div');
      d.className = 'recent-card';
      recentGrid.appendChild(d);
    }
    return;
  }
  rec.forEach(item=>{
    const el = document.createElement('div');
    el.className = 'recent-card';
    // image
    const img = document.createElement('img');
    img.src = item.images && item.images.length ? item.images[0] : 'assets/placeholder.png';
    img.alt = item.title;
    // price tag
    const p = document.createElement('div');
    p.className = 'price-tag';
    p.textContent = formatRp(item.price);
    el.appendChild(img);
    el.appendChild(p);
    // click open
    el.addEventListener('click', ()=> {
      // placeholder action - you can replace with actual navigation
      alert('Open: ' + item.title);
      pushToRecent(item); // mark as viewed now (moves to front)
      renderRecent();
    });
    recentGrid.appendChild(el);
  });
}

function formatRp(n){
  const num = Number(n) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

function pushToRecent(item){
  const cur = getRecent();
  // remove if exists
  const filtered = cur.filter(i => i.id !== item.id);
  filtered.unshift({
    id: item.id, title: item.title, price: item.price, images: item.images
  });
  setRecent(filtered);
}

// Render search results
function renderResults(items){
  resultsGrid.innerHTML = '';
  if(!items || items.length === 0){
    resultsGrid.innerHTML = '<div style="color:#8b8b92;padding:8px">No results</div>';
    return;
  }
  items.forEach(it=>{
    const card = document.createElement('div');
    card.className = 'result-card';
    const img = document.createElement('img');
    img.src = it.images && it.images.length ? it.images[0] : 'assets/placeholder.png';
    img.alt = it.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const t = document.createElement('div');
    t.className = 'result-title';
    t.textContent = it.title;
    const p = document.createElement('div');
    p.className = 'result-price';
    p.textContent = formatRp(it.price);
    meta.appendChild(t);
    meta.appendChild(p);
    card.appendChild(img);
    card.appendChild(meta);

    // click behavior
    card.addEventListener('click', ()=>{
      // open item detail (placeholder)
      alert('Open product: ' + it.title);
      // push to recent
      pushToRecent(it);
      renderRecent();
    });

    resultsGrid.appendChild(card);
  });
}

// perform search by title contains term
function performSearch(term){
  const q = (term || '').trim().toLowerCase();
  if(!q){
    renderResults([]);
    return [];
  }
  const matches = catalog.filter(it => it.title.toLowerCase().includes(q));
  // set recent to these matches (per request) — we will push them in order but avoid duplicates
  if(matches.length){
    // create an array of objects to store
    const toStore = matches.map(it => ({ id: it.id, title: it.title, price: it.price, images: it.images }));
    // merge with existing recent but keep new matches at front
    const cur = getRecent().filter(r => !toStore.find(t => t.id === r.id));
    const merged = [...toStore, ...cur].slice(0, MAX_RECENT);
    setRecent(merged);
    renderRecent();
  }
  renderResults(matches);
  return matches;
}

q.addEventListener('keyup', (e)=>{
  const val = e.target.value;
  // search on Enter or after small debounce for live search
  if(e.key === 'Enter'){
    performSearch(val);
  } else {
    // optional: live search after 300ms
    debounceLive(val);
  }
});

// simple debounce
let _debounceTimer = null;
function debounceLive(val){
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(()=> performSearch(val), 300);
}

clearBtn.addEventListener('click', ()=>{
  localStorage.removeItem(RECENT_KEY);
  renderRecent();
});

// init
(async function init(){
  await loadCatalog();
  renderRecent();
  // optional: you can prepopulate suggestions/results if you want
})();
