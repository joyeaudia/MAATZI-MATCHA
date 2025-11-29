// singup.js – versi tahan banting 😎

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
  // 👀 Cari elemen pakai beberapa kemungkinan id/class
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
    console.error(
      "Tombol signup tidak ditemukan. Coba kasih id='createAccountBtn' atau class='create-btn' di HTML."
    );
    return;
  }

  // ====== Toggle show/hide password (kalau ada icon .toggle) ======
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

  submitBtn.addEventListener("click", async () => {
    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const pass = passEl?.value || "";
    const confirm = confirmEl?.value || "";

    if (!name || !email || !phone || !pass || !confirm) {
      showAlert("Semua kolom wajib diisi ya 🙂");
      return;
    }

    if (!validPassword(pass)) {
      showAlert(
        "Password harus minimal 8 karakter, ada huruf besar, huruf kecil, angka, dan simbol."
      );
      return;
    }

    if (pass !== confirm) {
      showAlert("Password dan konfirmasinya tidak sama.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const user = cred.user;

      await updateProfile(user, { displayName: name });

      const ADMIN_EMAIL = "byverent@gmail.com";
      const role =
        email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        phone,
        role,
        memberSince: new Date().getFullYear(),
        createdAt: serverTimestamp(),
      });

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

      showAlert("Akun berhasil dibuat! 🎉");

      // habis klik OK pindah ke alamat.html
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
    }
  });
});
