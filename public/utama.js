// Animasi & aksesibilitas untuk tombol Buy (paste ke utama.js atau di bawah DOM ready)
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.buy-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // animasi singkat
      btn.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.06)', opacity: 0.95 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });

      // contoh: set focus ring & aria-live (opsional)
      btn.setAttribute('aria-pressed', 'true');
      setTimeout(()=> btn.removeAttribute('aria-pressed'), 600);
      // di sini Anda bisa panggil fungsi add-to-cart / open modal dsb.
    });

    btn.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); btn.click(); }
    });
  });
});
