// edit-profile.js
document.addEventListener('DOMContentLoaded', () => {
  const KEY = 'profile';

  // form elements
  const firstEl = document.getElementById('first-name');
  const lastEl  = document.getElementById('last-name');
  const emailEl = document.getElementById('email');
  const phoneEl = document.getElementById('phone');
  const saveBtn = document.getElementById('save-btn');

  function safeParse(raw){ try { return JSON.parse(raw || '{}'); } catch { return {}; } }

  // load existing profile
  const stored = safeParse(localStorage.getItem(KEY));
  firstEl.value = stored.firstName || '';
  lastEl.value  = stored.lastName || '';
  emailEl.value = stored.email || '';
  phoneEl.value = stored.phone || '';

  // save handler
  function saveProfile(e){
    // collect
    const profile = {
      firstName: firstEl.value.trim(),
      lastName:  lastEl.value.trim(),
      email:     emailEl.value.trim(),
      phone:     phoneEl.value.trim()
    };

    // basic validation
    if(!profile.firstName || !profile.email){
      alert('Isi minimal nama depan dan email.');
      return;
    }

    localStorage.setItem(KEY, JSON.stringify(profile));

    // Use storage event for other tabs/frames; redirect back to profile page
    window.location.href = 'prl.html';
  }

  // wire save button and also form submit via Enter
  saveBtn.addEventListener('click', saveProfile);
  document.getElementById('profile-form').addEventListener('submit', function(e){
    e.preventDefault();
    saveProfile();
  });
});
