// order-user-sync.js — subscribe Firestore orders for the logged-in user & sync to localStorage
// include in Orders page HTML BEFORE order.js so order.js that reads localStorage sees updates
// <script type="module" src="./order-user-sync.js"></script>

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

(function(){
  function safeParse(key){
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; }
  }
  function saveLocalOrders(arr){ try { localStorage.setItem('orders', JSON.stringify(arr||[])); } catch(e){ console.error(e); } }

  const uid = localStorage.getItem('maziUID') || null;
  const email = (localStorage.getItem('maziEmail') || '').toLowerCase().trim();

  if (!uid && !email) {
    // no logged user — do nothing (order.js will fallback to localStorage)
    return;
  }

  try {
    let qRef;
    if (uid) {
      qRef = query(collection(db,'orders'), where('userId','==', uid), orderBy('createdAt','desc'));
    } else {
      qRef = query(collection(db,'orders'), where('userEmail','==', email), orderBy('createdAt','desc'));
    }

    onSnapshot(qRef, snap => {
      const arr = [];
      snap.forEach(ds => {
        const d = ds.data() || {};
        arr.push(Object.assign({}, d, { _firestoreId: ds.id, id: d.id || ds.id }));
      });
      // merge into local — replace only user orders, but preserve others (admin might have global orders)
      const local = safeParse('orders') || [];
      // remove existing entries with same ids (user ones)
      const other = local.filter(o => !(arr.some(a => String(a.id) === String(o.id))));
      const merged = [...arr, ...other].sort((a,b)=>{
        const ta = (a.createdAt && a.createdAt.seconds) ? a.createdAt.seconds : (a.createdAt || 0);
        const tb = (b.createdAt && b.createdAt.seconds) ? b.createdAt.seconds : (b.createdAt || 0);
        return tb - ta;
      });
      saveLocalOrders(merged);
      try { window.dispatchEvent(new StorageEvent('storage', { key:'orders', newValue: JSON.stringify(merged) })); } catch(e){}
    }, err => {
      console.warn('order-user-sync onSnapshot error', err);
    });
  } catch(e){
    console.warn('order-user-sync init fail', e);
  }
})();
