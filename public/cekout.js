// ---- Place Order: create scheduled order and redirect ----
const placeOrderBtn = document.getElementById('placeOrder');

if (placeOrderBtn) {
  placeOrderBtn.addEventListener('click', async function () {
    const cart = loadCart();
    if (!cart || !cart.length) {
      alert('Keranjang kosong — tidak ada yang dipesan.');
      return;
    }

    // Pastikan user LOGIN dulu
    const currentUser = auth.currentUser;
    if (!currentUser) {
      try {
        localStorage.setItem('checkoutDraft_cart', JSON.stringify(cart));
      } catch (e) {}
      alert('Silakan sign in dulu untuk melanjutkan pemesanan.');
      window.location.href = 'singin.html?from=checkout';
      return;
    }

    // ==============================
    // 1. Baca jadwal terpilih (Schedule)
    // ==============================
    let scheduledAt = null;
    try {
      const dateSel = document.querySelector('select[aria-label="Date"]');
      const monthSel = document.querySelector('select[aria-label="Month"]');
      const yearSel = document.querySelector('select[aria-label="Year"]');

      const dateVal = dateSel?.value || '';
      const monthVal = monthSel?.value || '';
      const yearVal = yearSel?.value || '';

      const d = Number(dateVal);
      const y = Number(yearVal);

      if (!isNaN(d) && !isNaN(y) && monthVal) {
        const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
        let mIndex = Number(monthVal);

        // support "Jan / January" dsb
        if (isNaN(mIndex)) {
          const mm = String(monthVal).trim().slice(0,3).toLowerCase();
          mIndex = monthMap[mm] || NaN;
        }

        if (!isNaN(mIndex)) {
          // jam default 09:00
          const dt = new Date(y, mIndex - 1, d, 9, 0, 0);
          if (!isNaN(dt.getTime())) {
            scheduledAt = dt.toISOString();
          }
        }
      }
    } catch (e) {
      console.warn('Gagal parsing jadwal:', e);
    }

    const notes = document.getElementById('notes')?.value?.trim() || '';
    const recipient = document.getElementById('recipient')?.value?.trim() || '';

    // ==============================
    // 2. Hitung subtotal, ongkir, total
    // ==============================
    let subtotal = 0;
    const totalItems = cart.reduce((sum, it) => {
      const price = Number(it.unitPrice || it.price || 0);
      const qty = Math.max(0, Number(it.qty || 0));
      subtotal += price * qty;
      return sum + qty;
    }, 0);

    const selectedDelivery = document.querySelector('.delivery-item.active')?.dataset.method || 'regular';

    let baseOngkir = 15000;
    switch (selectedDelivery) {
      case 'nextday': baseOngkir = 20000; break;
      case 'sameday': baseOngkir = 30000; break;
      case 'instant': baseOngkir = 50000; break;
      case 'self':    baseOngkir = 5000;  break;
      case 'regular':
      default:        baseOngkir = 15000; break;
    }

    const kelipatan = Math.max(1, Math.ceil(totalItems / 5));
    const shippingFee = baseOngkir * kelipatan;
    const grandTotal = Number(subtotal) + Number(shippingFee);

    // ==============================
    // 3. Cek apakah ini GIFT order
    // ==============================
    let giftConfig = null;
    let isGift = false;
    try {
      giftConfig = JSON.parse(localStorage.getItem('giftConfig_v1') || 'null');
      isGift = !!(giftConfig && giftConfig.type === 'gift');
    } catch (e) {
      giftConfig = null;
      isGift = false;
    }

    // ==============================
    // 4. Siapkan data user (per-user meta)
    // ==============================
    const userMeta = {
      userId:   currentUser.uid,
      userEmail: currentUser.email || (localStorage.getItem('maziEmail') || ''),
      userName:  currentUser.displayName || (localStorage.getItem('maziName') || '')
    };

    // ==============================
    // 5. Bentuk ORDER OBJECT lokal (buat UI & localStorage)
    // ==============================
    const localOrder = {
      id: genOrderId(),           // ID human-readable, contoh: ORD-2025-...
      createdAt: Date.now(),      // utk tampilan lokal
      status: 'scheduled',        // karena ini scheduled order
      scheduledAt: scheduledAt,   // bisa null kalau user gak pilih tanggal
      total: grandTotal,
      shippingFee: shippingFee,
      items: cart.map(it => ({
        id: it.id,
        title: it.title,
        qty: Number(it.qty || 1),
        unitPrice: Number(it.unitPrice || it.price || 0),
        subtotal: Number(
          it.subtotal ||
          (Number(it.unitPrice || it.price || 0) * Number(it.qty || 1))
        ),
        addons: it.addons || [],
        image: it.image || (it.images && it.images[0]) || ''
      })),
      meta: {
        notes: notes,
        recipient: recipient,
        deliveryMethod: selectedDelivery
      },
      paymentStatus: 'pending',
      isGift: isGift,
      gift: isGift ? {
        message: giftConfig.message || '',
        fromName: giftConfig.fromName || '',
        revealMode: giftConfig.revealMode || 'reveal',
        theme: giftConfig.theme || null
      } : null,
      // per-user meta ditempel langsung
      ...userMeta
    };

    // ==============================
    // 6. Simpan ke Firestore (per-user)
    // ==============================
    try {
      const firestoreOrder = {
        ...localOrder,
        // createdAt server-side supaya orderBy di Firestore rapi
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "orders"), firestoreOrder);
      console.log("Order tersimpan di Firestore dengan id:", docRef.id);

      // Kalau mau, bisa simpan docId:
      localOrder.firestoreId = docRef.id;

    } catch (err) {
      console.error("Gagal menyimpan order ke Firestore:", err);

      // Offline / permission error → simpan ke queue supaya bisa di-flush nanti
      try {
        const queued = {
          ...localOrder,
          queuedAt: Date.now()
        };
        enqueueLocalOrder(queued);
        alert("Peringatan: koneksi ke server bermasalah. Pesanan disimpan sementara dan akan dikirim ke server saat koneksi pulih.");
      } catch (e) {
        console.error('Failed to enqueue order after firestore write error', e);
      }
    }

    // ==============================
    // 7. Cache ke localStorage 'orders' (dipakai order.js buat render)
    // ==============================
    const orders = loadOrders();
    orders.unshift(localOrder); // paling baru di atas
    saveOrders(orders);

    // ==============================
    // 8. Bersihkan cart + giftConfig
    // ==============================
    try { localStorage.removeItem('cart'); } catch (e) {}
    try { localStorage.removeItem('giftConfig_v1'); } catch (e) {}

    // ==============================
    // 9. Kirim WA ke admin + redirect ke order.html
    // ==============================
    try {
      const waNumber = '628118281416';

      const tanggalText = localOrder.scheduledAt
        ? new Date(localOrder.scheduledAt).toLocaleString('id-ID')
        : '(tanpa jadwal)';

      let waText = '';

      if (isGift) {
        waText =
          `Halo mimin Mazi, ini pesanan GIFT terjadwal dengan ID ${localOrder.id}. ` +
          `Mohon dibantu proses untuk jadwal ${tanggalText}.`;
      } else {
        waText =
          `Halo mimin Mazi, tolong proses pesanan terjadwal saya dengan ID ${localOrder.id}.`;
      }

      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

      const overlay = document.getElementById('ddno-overlay');
      const logo    = document.getElementById('ddno-logo');

      if (overlay) overlay.classList.add('show');
      if (logo) {
        logo.classList.remove('show');
        setTimeout(() => logo.classList.add('show'), 50);
      }

      setTimeout(() => {
        try {
          window.open(waUrl, '_blank');
        } catch (err) {
          console.warn('Failed to open WhatsApp', err);
        }
        window.location.href = './order.html?order=' + encodeURIComponent(localOrder.id);
      }, 1500);
    } catch (e) {
      console.warn('Failed to prepare WhatsApp redirect', e);
      window.location.href = './order.html?order=' + encodeURIComponent(localOrder.id);
    }
  });
}
