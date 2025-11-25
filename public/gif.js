(function() {
  // existing choice buttons code (keep)
  const choices = Array.from(document.querySelectorAll('.choice-btn'));
  choices.forEach(btn => {
    btn.addEventListener('click', () => {
      choices.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    });
  });

  // THEME SWATCHES: single-select, update preview large image
  const swatches = Array.from(document.querySelectorAll('.theme-swatch'));
  const previewImg = document.getElementById('theme-preview-img');
  const previewWrap = document.getElementById('theme-preview-wrap');

  function selectSwatch(el) {
    if (!el) return;
    swatches.forEach(s => {
      s.classList.remove('active');
      s.setAttribute('aria-pressed','false');
    });
    el.classList.add('active');
    el.setAttribute('aria-pressed','true');

    // get img inside swatch and set as preview src
    const img = el.querySelector('img');
    if (img && img.src) {
      previewImg.src = img.src;
      previewImg.alt = img.alt || 'Selected theme';
      // store selection on form (for later submission)
      document.querySelector('.gift-form').dataset.selectedTheme = el.dataset.theme || '';
    }
    // small animation
    try { previewWrap.animate([{ opacity: 0.85 }, { opacity: 1 }], { duration: 220 }); } catch(e){}
  }

  swatches.forEach((s, idx) => {
    // if swatch has no inner img (fallback), mark empty
    const inner = s.querySelector('img');
    if (!inner) s.classList.add('empty');

    s.addEventListener('click', () => selectSwatch(s));
    // set first as initial selected if none selected
    if (idx === 0 && !document.querySelector('.theme-swatch.active')) {
      selectSwatch(s);
    }
  });

  // expose selection for debugging
  window.getSelectedGiftTheme = () => document.querySelector('.gift-form')?.dataset.selectedTheme || null;
})();