// singin.js (versi Firebase Email/Password)

// Import Firebase
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ✨ Email admin utama (HARUS sama dengan yang di ordadm.js & signup.js)
const ADMIN_EMAIL = "byverent@gmail.com";

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

      // 🎭 Tentukan role:
      // - Kalau Firestore punya field role -> pakai itu
      // - Kalau tidak ada, tapi email == ADMIN_EMAIL -> admin
      // - Selain itu -> user
      let role = "user";
      if (data.role) {
        role = data.role;
      } else if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        role = "admin";
      }

      const name = data.name || user.displayName || "";
      const phone = data.phone || "";

      // 🪪 Simpan session di localStorage
      localStorage.setItem("maziRole", role);
      localStorage.setItem("maziEmail", email);
      localStorage.setItem("maziName", name);
      localStorage.setItem("maziPhone", phone);
      localStorage.setItem("maziUID", user.uid); // penting buat orders per-user

      // 🔁 Coba flush antrean order kalau ada (non-blocking)
      try {
        if (typeof window.flushOrderQueue === "function") {
          window.flushOrderQueue().catch((e) =>
            console.warn("flush after sign-in failed", e)
          );
        }
      } catch (e) {
        console.warn("flushOrderQueue throw", e);
      }

      // 🔁 Kalau sign-in dari bag/checkout, kembalikan ke sana
      const sp = new URLSearchParams(window.location.search);
      const from = sp.get("from");
      if (from === "bag" || from === "checkout") {
        try {
          const draft = JSON.parse(
            localStorage.getItem("checkoutDraft_cart") || "null"
          );
          if (draft) {
            localStorage.setItem("cart", JSON.stringify(draft));
            localStorage.removeItem("checkoutDraft_cart");
          }
        } catch (e) {
          console.warn("failed restore draft", e);
        }

        window.location.href = from === "bag" ? "bagfr.html" : "cekout.html";
        return;
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

      if (
        !profile ||
        (profile.email || "").toLowerCase() !== email.toLowerCase()
      ) {
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
        // HANYA admin (email ADMIN_EMAIL / role=admin) yang bisa sampai sini
        window.location.href = "frsadm.html"; // halaman admin
      } else {
        window.location.href = "Home.html"; // halaman utama user
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err.code, err.message);
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
