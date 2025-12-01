const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = (...args)=>import('cross-fetch').then(({default:fetch})=>fetch(...args));

admin.initializeApp();
const db = admin.firestore();

// ENV you must set:
const APPS_SCRIPT_API_BASE = process.env.APPS_SCRIPT_API_BASE; // e.g. https://script.google.com/macros/s/AKfy.../exec
const TIMEZONE = "Asia/Kolkata";

// save token (called by push.js)
exports.registerToken = functions.https.onRequest(async (req, res) => {
  try {
    const { email, token, ua } = req.body || {};
    if (!email || !token) return res.status(400).json({ ok:false, error:'missing' });

    await db.collection('tokens').doc(token).set({
      email: String(email).toLowerCase(),
      token,
      ua: ua || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ ok:true });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
});

// cron: every 2 hours — check each user’s pending tasks and notify until done
exports.twoHourlyPush = functions.pubsub
  .schedule('every 2 hours')
  .timeZone(TIMEZONE)
  .onRun(async () => {
    // fetch unique emails from tokens
    const snap = await db.collection('tokens').get();
    const byEmail = new Map();
    snap.forEach(doc => {
      const { email, token } = doc.data() || {};
      if (!email || !token) return;
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(token);
    });

    for (const [email, tokens] of byEmail.entries()) {
      try {
        // hit your Apps Script to get tasks for user
        const url = `${APPS_SCRIPT_API_BASE}?action=getTasks&email=${encodeURIComponent(email)}&name=`;
        const resp = await fetch(url);
        const tasks = await resp.json();

        // pending tasks
        const pending = (tasks || []).filter(t => String(t.status||'').toLowerCase() !== 'done');

        if (pending.length > 0) {
          const title = `You have ${pending.length} pending task${pending.length>1?'s':''}`;
          const body  = pending.slice(0,3).map(t=>t.task).join(', ') + (pending.length>3 ? '…' : '');
          const badge = String(pending.length);

          await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: { badge, kind: "reminder" },
            webpush: {
              headers: { Urgency: "high" },
              fcmOptions: { link: "/" }
            }
          });
        }
      } catch (e) {
        console.error("push error for", email, e);
      }
    }
    return null;
  });
