// singup.js – versi tahan banting (diperbaiki)
// Pastikan <script type="module" src="singup.js"></script> di HTML
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ====== Custom Alert (kalau tidak ada, fallback ke alert biasa) ======
function setupCustomAlert() {
  const modal = document.getElementById("alertModal");
  const textEl = document.getElementById("alertText");
  const closeBtn = document.getElementById("alertClose");

  function hide() {
    if (modal) modal.style.display = "none";
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", hide);
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hide();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  return function showAlert(msg) {
    if (!modal || !textEl) {
      window.alert(msg);
      return;
    }
    textEl.textContent = msg;
    modal.style.display = "flex";
  };
}

const showAlert = setupCustomAlert();

document.addEventListener("DOMContentLoaded", () => {
  // element lookup (robust)
  const nameEl =
    document.querySelector("#fullname, #name, #nama") || document.querySelector("input[name='fullname'], input[name='name']");
  const emailEl =
    document.querySelector("#email") || document.querySelector("input[type='email']");
  const phoneEl =
    document.querySelector("#phone, #telp, #nohp") || document.querySelector("input[type='tel']");
  const passEl =
    document.querySelector("#password") || document.querySelector("input[type='password']");
  const confirmEl =
    document.querySelector("#confirm-password, #password2, #confirmpassword");

  const submitBtn =
    document.querySelector(
      "#createAccountBtn, #create-account-btn, #signupBtn, #signUpBtn, .create-btn, .signup-btn"
    ) || document.querySelector("button[type='submit']");

  console.log("cek elemen signup:", {
    nameEl,
    emailEl,
    phoneEl,
    passEl,
    confirmEl,
    submitBtn,
  });

  if (!submitBtn) {
    console.error("Tombol signup tidak ditemukan. Tambah id/create-btn di HTML.");
    return;
  }

  // toggle pw visibility
  document.querySelectorAll(".toggle").forEach((icon) => {
    icon.addEventListener("click", () => {
      const input = icon.previousElementSibling;
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      icon.textContent = show ? "🙈" : "👁️";
    });
  });

  function validPassword(pass) {
    return (
      /[a-z]/.test(pass) &&
      /[A-Z]/.test(pass) &&
      /\d/.test(pass) &&
      /[^A-Za-z0-9]/.test(pass) &&
      pass.length >= 8
    );
  }

  submitBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();

    // prevent double submit
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const pass = passEl?.value || "";
    const confirm = confirmEl?.value || "";

    if (!name || !email || !phone || !pass || !confirm) {
      showAlert("Semua kolom wajib diisi ya 🙂");
      submitBtn.disabled = false;
      return;
    }

    if (!validPassword(pass)) {
      showAlert(
        "Password harus minimal 8 karakter, ada huruf besar, huruf kecil, angka, dan simbol."
      );
      submitBtn.disabled = false;
      return;
    }

    if (pass !== confirm) {
      showAlert("Password dan konfirmasinya tidak sama.");
      submitBtn.disabled = false;
      return;
    }

    try {
      // create account
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const user = cred.user;

      // set display name in Firebase Auth
      try {
        await updateProfile(user, { displayName: name });
      } catch (e) {
        console.warn("updateProfile warning:", e);
      }

      // determine role
      const ADMIN_EMAIL = "byverent@gmail.com";
      const role = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

      // --- WRITE USER DOC TO FIRESTORE (IMPORTANT) ---
      try {
        await setDoc(doc(db, "users", user.uid), {
          name,
          email,
          phone,
          role,
          memberSince: new Date().getFullYear(),
          createdAt: serverTimestamp(),
        });
        console.log("User doc written to Firestore for uid:", user.uid);
      } catch (err) {
        console.warn("Warning: failed to write user doc to Firestore", err);
        // we continue anyway (still save local session) but log for debug
      }

      // --- save session & profile locally (do this BEFORE redirect)
      localStorage.setItem("maziUID", user.uid);
      localStorage.setItem("maziRole", role);
      localStorage.setItem("maziEmail", email);
      localStorage.setItem("maziName", name);
      localStorage.setItem("maziPhone", phone);

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

      // attempt to flush queued orders (non-blocking)
      if (typeof window.flushOrderQueue === 'function') {
        window.flushOrderQueue()
          .then(()=>console.log('flushOrderQueue completed after signup'))
          .catch(e=>console.warn('flush after signup failed', e));
      } else {
        console.log('flushOrderQueue not present on this page');
      }

      // handle redirect back to bag/checkout if signup came from there
      const sp = new URLSearchParams(window.location.search);
      const from = sp.get('from'); // e.g. ?from=checkout or ?from=bag
      if (from === 'bag' || from === 'checkout') {
        try {
          const draft = JSON.parse(localStorage.getItem('checkoutDraft_cart') || 'null');
          if (draft) {
            localStorage.setItem('cart', JSON.stringify(draft));
            localStorage.removeItem('checkoutDraft_cart');
          }
        } catch (e) { console.warn('restore draft failed', e); }

        // redirect back so user can continue checkout
        window.location.href = from === 'bag' ? 'bagfr.html' : 'cekout.html';
        return;
      }

      // normal onboarding flow: show success then go to alamat.html
      showAlert("Akun berhasil dibuat! 🎉");

      const modal = document.getElementById("alertModal");
      const closeBtn = document.getElementById("alertClose");
      if (closeBtn && modal) {
        const handler = () => {
          modal.style.display = "none";
          closeBtn.removeEventListener("click", handler);
          window.location.href = "alamat.html?from=signup";
        };
        closeBtn.addEventListener("click", handler);
      } else {
        window.location.href = "alamat.html?from=signup";
      }
    } catch (err) {
      console.error("Error Firebase:", err);
      let msg = "Terjadi kesalahan saat mendaftar.";

      if (err.code === "auth/email-already-in-use") {
        msg = "Email ini sudah terdaftar. Silakan Sign In saja ya 🙂";
      } else if (err.code === "auth/invalid-email") {
        msg = "Format email tidak valid.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password terlalu lemah.";
      }

      showAlert(msg);
    } finally {
      submitBtn.disabled = false;
    }
  });
});
