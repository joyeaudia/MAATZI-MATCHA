// simple tabs logic
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // deactivate all
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected','false');
      });
      // hide panels
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

      // activate clicked
      btn.classList.add('active');
      btn.setAttribute('aria-selected','true');
      const tab = btn.dataset.tab; // e.g. 'active', 'scheduled', 'history'
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.remove('hidden');
    });
  });
});
