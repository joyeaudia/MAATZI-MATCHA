// alamat.js — robust save addresses (handles missing default checkbox, max 5 entries)
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const KEY = "savedAddresses_v1";
  const MAX_ADDR = 5; // ubah kalau mau kapasitas lain

  function readStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeStore(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      console.error("Failed to write addresses to localStorage", e);
    }
  }

  form.addEventListener("submit", function(e){
    e.preventDefault();

    // read inputs
    const label = (document.getElementById("address-label")?.value || "").trim() || "Other";
    const name = (document.getElementById("recipient-name")?.value || "").trim();
    const phone = (document.getElementById("phone-number")?.value || "").trim();
    const street = (document.getElementById("street-address")?.value || "").trim();
    const city = (document.getElementById("city")?.value || "").trim();
    const province = (document.getElementById("province")?.value || "").trim();
    const postal = (document.getElementById("postal-code")?.value || "").trim();

    // safe read of checkbox (may be missing in markup)
    const defaultEl = document.getElementById("default-address");
    const isDefault = !!(defaultEl && defaultEl.checked);

    // basic validation (name + phone + street)
    if (!name || !phone || !street) {
      alert("Isi Nama, No. Telepon, dan Alamat jalan minimal.");
      return;
    }

    const addressText = `${street}\n${city}${city && province ? ', ' : ''}${province}\n${postal}`;

    const newAddress = {
      label,
      name,
      phone,
      address: addressText,
      isDefault: !!isDefault
    };

    // read existing
    const arr = readStore();

    // enforce max count
    if (arr.length >= MAX_ADDR) {
      alert(`Maksimum ${MAX_ADDR} alamat saja. Hapus salah satu jika ingin menambah lagi.`);
      return;
    }

    // if set default, unset others
    if (newAddress.isDefault) arr.forEach(a => a.isDefault = false);

    arr.push(newAddress);
    writeStore(arr);

    // bentuk teks siap tempel ke Recipient (nama + telp + alamat lengkap)
    const recipientText = `${name}\n${phone}\n${addressText}`;

    // cek apakah datang dari flow checkout (alamat.html?from=checkout)
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');

    const fromCheckout = from === 'checkout';
    const fromSignup   = from === 'signup';

    if (fromCheckout) {
      // dipanggil dari halaman checkout → balik ke checkout
      try {
        localStorage.setItem('checkoutRecipientDraft_v1', recipientText);
      } catch (e) {}

      window.location.href = 'cekout.html';

    } else if (fromSignup) {
      // user baru selesai isi alamat pertama → ke Home
      window.location.href = 'Home.html';

    } else {
      // flow biasa (misal dari drafamt / profile) → balik ke list alamat
      window.location.href = 'drafamt.html';
    }


  });
});
