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
