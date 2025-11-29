// singup.js

// ====== Custom Modal Alert ======
function setupCustomAlert() {
  const modal = document.getElementById("alertModal");
  const textEl = document.getElementById("alertText");
  const closeBtn = document.getElementById("alertClose");

  function hide() {
    if (modal) modal.style.display = "none";
  }

  // tombol OK
  if (closeBtn) {
    closeBtn.addEventListener("click", hide);
  }

  // klik di luar card
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hide();
    });
  }

  // esc untuk tutup
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  // fungsi yang dipakai di bawah
  return function showAlert(msg) {
    if (!modal || !textEl) {
      // fallback kalau elemen modal belum ada
      window.alert(msg);
      return;
    }
    textEl.textContent = msg;
    modal.style.display = "flex";
  };
}

// bikin fungsi showAlert global utk dipakai di mana-mana
const showAlert = setupCustomAlert();

// ====== Show/Hide Password ======
document.querySelectorAll(".toggle").forEach((icon) => {
  icon.addEventListener("click", () => {
    const input = icon.previousElementSibling;
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon.textContent = show ? "🙈" : "👁️";
  });
});

const USERS_KEY = "maziUsers_v1";

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list || []));
}

// 🔐 Password harus: min 8, huruf kecil, huruf besar, angka, simbol
function validPassword(pass) {
  return (
    /[a-z]/.test(pass) && // huruf kecil
    /[A-Z]/.test(pass) && // huruf besar
    /\d/.test(pass) && // angka
    /[^A-Za-z0-9]/.test(pass) && // simbol
    pass.length >= 8
  );
}

// 🔹 Ambil elemen form sekali di awal
const nameEl = document.getElementById("fullname");
const emailEl = document.getElementById("email");
const phoneEl = document.getElementById("phone");
const passEl = document.getElementById("password");
const confirmEl = document.getElementById("confirm-password");
const submitBtn = document.getElementById("createAccountBtn");

submitBtn.addEventListener("click", () => {
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const phone = phoneEl.value.trim();
  const pass = passEl.value;
  const confirm = confirmEl.value;

  // 🔴 Semua field wajib diisi
  if (!name || !email || !phone || !pass || !confirm) {
    showAlert("Semua kolom wajib diisi ya 🙂");
    return;
  }

  // 🔴 Validasi password kuat
  if (!validPassword(pass)) {
    showAlert(
      "Password harus minimal 8 karakter, ada huruf besar, huruf kecil, angka, dan simbol."
    );
    return;
  }

  // 🔴 Konfirmasi password sama
  if (pass !== confirm) {
    showAlert("Password dan konfirmasinya tidak sama.");
    return;
  }

  // 🔴 Cek email sudah pernah dipakai
  const users = loadUsers();
  const exists = users.some(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );
  if (exists) {
    showAlert("Email ini sudah terdaftar. Silakan Sign In saja ya 🙂");
    // setelah user klik OK, baru kita arahkan
    const modal = document.getElementById("alertModal");
    const closeBtn = document.getElementById("alertClose");
    if (closeBtn && modal) {
      const handler = () => {
        modal.style.display = "none";
        closeBtn.removeEventListener("click", handler);
        window.location.href = "singin.html";
      };
      closeBtn.addEventListener("click", handler);
    }
    return;
  }

  // ➕ Simpan user baru ke "database" lokal
  users.push({ email, password: pass, name, phone });
  saveUsers(users);

  // 🪪 Set session info
  localStorage.setItem("maziRole", "user");
  localStorage.setItem("maziEmail", email);
  localStorage.setItem("maziName", name);
  localStorage.setItem("maziPhone", phone);

  // 👤 Set profile untuk halaman prl.html
  const parts = name.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  const profile = {
    firstName,
    lastName,
    email,
    phone,
    memberSince: new Date().getFullYear(),
  };

  localStorage.setItem("profile", JSON.stringify(profile));

  // ➡ Langkah berikutnya: isi alamat dulu
  window.location.href = "alamat.html?from=signup";
});
