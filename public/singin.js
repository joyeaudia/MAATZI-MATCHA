// singin.js (versi Firebase)

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 🔹 Toggle show/hide password
document.querySelectorAll(".toggle").forEach((icon) => {
  icon.addEventListener("click", () => {
    const input = icon.previousElementSibling;
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    icon.textContent = input.type === "password" ? "👁️" : "🙈";
  });
});

const signInBtn = document.getElementById("signInBtn");

if (signInBtn) {
  signInBtn.addEventListener("click", async () => {
    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");

    const email = (emailEl?.value || "").trim();
    const password = passwordEl?.value || "";

    if (!email || !password) {
      alert("Isi email dan password dulu ya 🙂");
      return;
    }

    try {
      // 🔐 Login ke Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // 🔎 Ambil data user di Firestore (koleksi "users")
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      let data = {};
      if (snap.exists()) {
        data = snap.data();
      }

      // 🎭 Tentukan role
      const ADMIN_EMAIL = "byverent@gmail.com";
      const role =
        data.role ||
        (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user");

      const name = data.name || user.displayName || "";
      const phone = data.phone || "";





// 🪪 Simpan session di localStorage
localStorage.setItem("maziRole", role);
localStorage.setItem("maziEmail", email);
localStorage.setItem("maziName", name);
localStorage.setItem("maziPhone", phone);

// simpan UID agar order disimpan per-user (sekali)
localStorage.setItem("maziUID", user.uid);

// Coba flush queue jika available (non-blocking so redirect not delayed)
if (typeof window.flushOrderQueue === 'function') {
  window.flushOrderQueue().catch(e => console.warn('flush after sign-in failed', e));
}

// Jika sign-in terjadi karena checkout flow, restore cart dan kembalikan user
const sp = new URLSearchParams(window.location.search);
const from = sp.get('from');
if (from === 'bag' || from === 'checkout') {
  try {
    const draft = JSON.parse(localStorage.getItem('checkoutDraft_cart') || 'null');
    if (draft) {
      localStorage.setItem('cart', JSON.stringify(draft));
      localStorage.removeItem('checkoutDraft_cart');
    }
  } catch (e) { console.warn('failed restore draft', e); }

  // redirect langsung kembali ke halaman asal
  window.location.href = from === 'bag' ? 'bagfr.html' : 'cekout.html';
  return;
}


// ⭐️ PASTE KODE INI TEPAAT SETELAH BLOK DI ATAS ⭐️

// simpan UID ke localStorage (WAJIB untuk Firestore rules)
localStorage.setItem("maziUID", user.uid);

// coba flush queue bila ada order yang gagal kirim
try {
  if (typeof window.flushOrderQueue === "function") {
    await window.flushOrderQueue();
    console.log("flushOrderQueue completed after sign-in");
  } else {
    console.log("flushOrderQueue not loaded on this page");
  }
} catch (e) {
  console.warn("flushOrderQueue error after sign-in", e);
}

      // 👤 Siapkan profile untuk prl.html
      const parts = (name || "").split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ");

      const existingRaw = localStorage.getItem("profile");
      let profile = null;
      try {
        profile = JSON.parse(existingRaw || "null");
      } catch {
        profile = null;
      }

      if (!profile || (profile.email || "").toLowerCase() !== email.toLowerCase()) {
        profile = {
          firstName,
          lastName,
          email,
          phone,
          memberSince: data.memberSince || new Date().getFullYear(),
        };
      } else {
        profile = {
          ...profile,
          firstName,
          lastName,
          phone: phone || profile.phone,
        };
      }

      localStorage.setItem("profile", JSON.stringify(profile));

      // 🚀 Redirect sesuai role
      if (role === "admin") {
        window.location.href = "frsadm.html"; // halaman admin kamu
      } else {
        window.location.href = "Home.html"; // halaman utama user
      }
    } catch (err) {
      console.error(err);
      let msg = "Gagal login. Cek lagi email dan password ya 🙂";

      if (err.code === "auth/user-not-found") {
        msg = "Email belum terdaftar. Silakan Sign Up dulu ya 🙂";
      } else if (err.code === "auth/wrong-password") {
        msg = "Password salah. Coba lagi ya 😊";
      } else if (err.code === "auth/invalid-email") {
        msg = "Format email tidak valid.";
      }

      alert(msg);
    }
  });
}
