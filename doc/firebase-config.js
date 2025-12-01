// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDfEkw2WZuFaSo5BPa1cdBnbA733A10aVo",
  authDomain: "mazi-matcha.firebaseapp.com",
  projectId: "mazi-matcha",
  storageBucket: "mazi-matcha.firebasestorage.app",
  messagingSenderId: "357529462736",
  appId: "1:357529462736:web:f2d689ad55f4b69e1bbbd5",
  measurementId: "G-CRRR3CTHQD"
};

// 🔥 Inisialisasi Firebase
export const app = initializeApp(firebaseConfig);

// 🔐 Authentication
export const auth = getAuth(app);

// 🗄 Firestore Database
export const db = getFirestore(app);
