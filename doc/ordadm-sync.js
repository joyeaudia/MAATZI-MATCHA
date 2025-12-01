// ordadm-sync.js — small Firestore -> localStorage sync for admin UI
// Usage: include in admin HTML: <script type="module" src="./ordadm-sync.js"></script>

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function(){
  // helper safe parse
  function safeParse(key){
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch(e){ return []; }
  }
  function saveLocalOrders(arr){
    try { localStorage.setItem('orders', JSON.stringify(arr||[])); }
    catch(e){ console.error('saveLocalOrders failed', e); }
  }

  // merge logic:
  // - keep local modifications (paymentStatus/status) if doc exists locally (don't overwrite admin local edits)
  // - update/add from Firestore for new fields (items/total/createdAt etc)
  function mergeFirestoreIntoLocal(fireOrders){
    const local = safeParse('orders') || [];
    const mapLocal = {};
    local.forEach(o => { if (o && o.id) mapLocal[String(o.id)] = o; });

    // fireOrders = array of objects with id field (order.id in doc) or _firestoreId
    fireOrders.forEach(f => {
      const key = String(f.id || f._firestoreId || f._id || '');
      if (!key) return;
      const existing = mapLocal[key];
      if (existing) {
        // preserve admin-managed fields if they exist locally (paymentStatus/status)
        const preserved = {
          paymentStatus: existing.paymentStatus || f.paymentStatus || 'pending',
          status: existing.status || f.status || 'active'
        };
        // merge: firestore wins for items/total/user etc, but keep preserved
        mapLocal[key] = Object.assign({}, f, preserved, { id: key });
      } else {
        // fresh order from firestore
        mapLocal[key] = Object.assign({}, f, { id: key });
      }
    });

    // convert map back to array sorted by createdAt desc if available
    const merged = Object.values(mapLocal).sort((a,b)=>{
      const ta = (a.createdAt && a.createdAt.seconds) ? a.createdAt.seconds : (a.createdAt || 0);
      const tb = (b.createdAt && b.createdAt.seconds) ? b.createdAt.seconds : (b.createdAt || 0);
      return (tb - ta);
    });

    saveLocalOrders(merged);
    // also trigger storage event so other tabs can update UI
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'orders', newValue: JSON.stringify(merged) })); } catch(e){}
  }

  // subscribe to all orders (admin view). If permission denied, just stop silently.
  try {
    const qRef = query(collection(db, 'orders'), orderBy('createdAt','desc'));
    onSnapshot(qRef, snap => {
      const arr = [];
      snap.forEach(docSnap => {
        const d = docSnap.data() || {};
        // normalize a bit
        arr.push(Object.assign({}, d, { _firestoreId: docSnap.id, id: d.id || docSnap.id }));
      });
      mergeFirestoreIntoLocal(arr);
    }, err => {
      console.warn('ordadm-sync onSnapshot error', err);
    });
  } catch (e) {
    console.warn('ordadm-sync init failed', e);
  }
})();
