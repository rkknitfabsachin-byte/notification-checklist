/* Firebase SW for background web push (must be at site root scope) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyARyrAq3YsAPrG_qssIxA6N2VWUmHcA_XI",
  authDomain: "doer-dashboard-notifications.firebaseapp.com",
  projectId: "doer-dashboard-notifications",
  storageBucket: "doer-dashboard-notifications.firebasestorage.app",
  messagingSenderId: "311504357996",
  appId: "1:311504357996:web:1f092d859ff9f4e1e0a649"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Task Update';
  const body  = payload.notification?.body  || 'You have a task update';
  const badge = payload.data?.badge;

  const options = {
    body,
    icon: `${self.registration.scope}icon-192.png`,
    badge: `${self.registration.scope}icon-192.png`,
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);

  // optional app badge (where supported)
  if (navigator.setAppBadge && badge) {
    navigator.setAppBadge(parseInt(badge,10)||1).catch(()=>{});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = self.registration.scope || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if (c.url.includes(url)) return c.focus();
      return clients.openWindow(url);
    })
  );
});
