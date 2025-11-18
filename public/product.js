
    // Toggle heart behavior + animation + accessible aria-pressed
    document.addEventListener('DOMContentLoaded', () => {
      const heartBtn = document.querySelector('.heart');
      const heartPath = heartBtn.querySelector('.heart-path');

      heartBtn.addEventListener('click', () => {
        const active = heartBtn.classList.toggle('active');
        heartBtn.setAttribute('aria-pressed', active ? 'true' : 'false');

        // pulse animation
        heartPath.classList.remove('pulse');
        void heartPath.offsetWidth;
        heartPath.classList.add('pulse');
      });
    });