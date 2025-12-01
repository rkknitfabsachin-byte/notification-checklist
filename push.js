// push.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "doer-dashboard-notifications.firebaseapp.com",
  projectId: "doer-dashboard-notifications",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// ⚠️ Paste your **Web Push certificate key (VAPID public key)** here
const VAPID_KEY = "PASTE_VAPID_PUBLIC_KEY";

export const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Register SW (must be at root)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

// Ask permission + get FCM token (call after user logs in; see below)
export async function initPushForUser(email) {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok:false, reason:'permission-denied' };

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.ready });
    if (!token) return { ok:false, reason:'no-token' };

    // Save token to Firestore (through a Cloud Function HTTPS endpoint), or directly to Firestore from client:
    await fetch('https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/registerToken', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, token, ua: navigator.userAgent })
    });

    // Foreground messages
    onMessage(messaging, (payload) => {
      // Optional: play sound + show in-app banner
      const a = document.getElementById('notifSound');
      if (a && !window.DD_QUIET) { a.currentTime = 0; a.play().catch(()=>{}); }
      // Update badge in UI if you maintain count:
      const badge = document.getElementById('notifBadge');
      if (badge){ badge.style.display='flex'; badge.textContent = '•'; }
    });

    return { ok:true, token };
  } catch (e) {
    return { ok:false, error: String(e) };
  }
}
