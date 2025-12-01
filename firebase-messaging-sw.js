/* Firebase SW for background push */
self.addEventListener('install', ()=> self.skipWaiting());
self.addEventListener('activate', e=> e.waitUntil(self.clients.claim()));

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "doer-dashboard-notifications.firebaseapp.com",
  projectId: "doer-dashboard-notifications",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

/* Background handler */
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Task Update';
  const body  = payload.notification?.body  || 'You have a task update';
  const badge = payload.data?.badge || '';
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);

  // Try set App Badge (supported on some platforms)
  if ('setAppBadge' in navigator && badge) {
    navigator.setAppBadge(parseInt(badge, 10) || 1).catch(()=>{});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = self.registration.scope; // open app root
  event.waitUntil(clients.matchAll({type:'window'}).then(clientsArr=>{
    const client = clientsArr.find(c=>c.url.includes(url));
    if (client) return client.focus();
    return clients.openWindow(url);
  }));
});
