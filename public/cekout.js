// cekout.js — semua JS untuk halaman checkout
document.addEventListener('DOMContentLoaded', function () {
  // format rupiah sederhana
  const formatRp = (n) => {
    const num = Number(n) || 0;
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',00';
  };

  // Quantity controls & subtotal calculation
  const qtyControls = Array.from(document.querySelectorAll('.qty-control'));
  const deliveryBtns = Array.from(document.querySelectorAll('.delivery-item'));
  const deliveryRow = document.getElementById('deliveryRow');

  function calcSubtotal() {
    let totalItems = 0;
    let totalPrice = 0;

    qtyControls.forEach(q => {
      const price = Number(q.dataset.price || 0);
      const qty = Number(q.querySelector('.qty-input').value) || 0;
      totalPrice += price * qty;
      totalItems += qty;
    });

    const subtotalEl = document.getElementById('subtotalRp');
    const shippingEl = document.getElementById('shippingFee');
    const totalEl = document.getElementById('totalRp');

    // Hitung ongkir berdasarkan metode aktif
    const activeMethod = document.querySelector('.delivery-item.active')?.dataset.method || 'regular';
    let baseOngkir = 0;
    switch (activeMethod) {
      case 'regular': baseOngkir = 15000; break;
      case 'nextday': baseOngkir = 20000; break;
      case 'sameday': baseOngkir = 30000; break;
      case 'instant': baseOngkir = 50000; break;
      case 'self': baseOngkir = 5000; break;
      default: baseOngkir = 15000; break;
    }

    // Kalau barang <= 5, biaya = baseOngkir. Untuk setiap kelipatan 5, tambahkan lagi.
    const kelipatan = Math.max(1, Math.ceil(totalItems / 5)); // minimal 1
    const shippingFee = baseOngkir * kelipatan;
    const grandTotal = totalPrice + shippingFee;

    // Update tampilan (cek dulu elemen ada)
    if (subtotalEl) subtotalEl.textContent = formatRp(totalPrice);
    if (shippingEl) shippingEl.textContent = formatRp(shippingFee);
    if (totalEl) totalEl.textContent = formatRp(grandTotal);
  }

  // Hook quantity controls
  qtyControls.forEach(control => {
    const dec = control.querySelector('.dec');
    const inc = control.querySelector('.inc');
    const input = control.querySelector('.qty-input');

    dec.addEventListener('click', () => {
      let v = Number(input.value) || 0;
      if (v > 0) input.value = v - 1;
      calcSubtotal();
    });
    inc.addEventListener('click', () => {
      let v = Number(input.value) || 0;
      input.value = v + 1;
      calcSubtotal();
    });

    input.addEventListener('input', () => {
      // keep only digits
      input.value = input.value.replace(/[^\d]/g,'');
      if (input.value === '') input.value = '0';
      calcSubtotal();
    });
  });

  // Delivery method single-select + auto center when selected
  deliveryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      deliveryBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed','false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');

      // scroll clicked item to center of the row for nicer UX
      if (typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else if (deliveryRow) {
        const rowRect = deliveryRow.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const offset = (btnRect.left + btnRect.width / 2) - (rowRect.left + rowRect.width / 2);
        deliveryRow.scrollBy({ left: offset, behavior: 'smooth' });
      }

      // update total setelah ganti metode pengiriman
      calcSubtotal();

      // (optional) save selection:
      // localStorage.setItem('deliveryMethod', btn.dataset.method);
    });
  });

  // Restore previous choice if any (optional)
  // const savedDelivery = localStorage.getItem('deliveryMethod');
  // if (savedDelivery) {
  //   const el = deliveryBtns.find(i => i.dataset.method === savedDelivery);
  //   if (el) {
  //     deliveryBtns.forEach(b => b.classList.remove('active'));
  //     el.classList.add('active');
  //     el.setAttribute('aria-pressed','true');
  //     setTimeout(()=> el.scrollIntoView({behavior:'auto', inline:'center'}), 80);
  //   }
  // }

  // Place order click (demo)
  const placeOrderBtn = document.getElementById('placeOrder');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', () => {
      const subtotalText = document.getElementById('subtotalRp')?.textContent || '';
      const shippingText = document.getElementById('shippingFee')?.textContent || '';
      const totalText = document.getElementById('totalRp')?.textContent || '';
      const selectedDelivery = deliveryBtns.find(b => b.classList.contains('active'))?.dataset.method || '';
      alert(
        'Place Order clicked\n' +
        subtotalText + '\n' +
        'Shipping: ' + shippingText + '\n' +
        'Total: ' + totalText + '\n' +
        'Delivery: ' + selectedDelivery + '\n(Implement real flow di sini)'
      );
    });
  }

  // initial calc
  calcSubtotal();
});
