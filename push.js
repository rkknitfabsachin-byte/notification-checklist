// push.js — Firebase Web Push bootstrap (GitHub Pages–safe)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyARyrAq3YsAPrG_qssIxA6N2VWUmHcA_XI",
  authDomain: "doer-dashboard-notifications.firebaseapp.com",
  projectId: "doer-dashboard-notifications",
  storageBucket: "doer-dashboard-notifications.firebasestorage.app",
  messagingSenderId: "311504357996",
  appId: "1:311504357996:web:1f092d859ff9f4e1e0a649"
};

// 🔑 VAPID public key
const VAPID_KEY = "BJjlFWkDOla70jnjKCtKjQUCJmpP2f0lCNHmZYtPqjN42e2uJRv-p9EqVkbB5-2238L_XcxWWz-eAwAAZ2Usw7E";

// ✅ Replace with your deployed Cloud Function endpoint (after deploy)
const REGISTER_URL = "https://us-central1-doer-dashboard-notifications.cloudfunctions.net/registerToken";

// GitHub Pages base path detect
const isGh = location.hostname.endsWith("github.io");
const basePath = isGh ? ("/" + location.pathname.split("/")[1]) : "";
const swUrl = `${basePath}/firebase-messaging-sw.js`;
const swScope = `${basePath}/`;

export const app = initializeApp(firebaseConfig);

export async function initPushForUser(email) {
  try {
    if (!('serviceWorker' in navigator)) return { ok:false, reason:'no-sw' };
    if (!await isSupported()) return { ok:false, reason:'messaging-not-supported' };

    // register SW
    const reg = await navigator.serviceWorker.register(swUrl, { scope: swScope });
    await navigator.serviceWorker.ready;

    // permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok:false, reason:'permission-denied' };

    // token
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok:false, reason:'no-token' };

    localStorage.setItem("firebase-messaging-token", token);
    console.log("✅ FCM token:", token);

    // save token to backend
    await fetch(REGISTER_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, token, ua: navigator.userAgent })
    });

    // foreground push → sound + badge
    onMessage(messaging, (payload) => {
      console.log("🔔 onMessage:", payload);
      if (!window.DD_QUIET) {
        const a = document.getElementById('notifSound');
        if (a) { a.currentTime = 0; a.play().catch(()=>{}); }
      }
      const badge = document.getElementById('notifBadge');
      if (badge) { badge.style.display='flex'; badge.textContent = '•'; }
    });

    return { ok:true, token };
  } catch(e){
    console.error('initPushForUser error', e);
    return { ok:false, error:String(e) };
  }
}
