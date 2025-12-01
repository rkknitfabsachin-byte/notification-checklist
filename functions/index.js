const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = (...args)=>import('cross-fetch').then(({default:fetch})=>fetch(...args));
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ✅ Set your Apps Script API base via functions config or hardcode here.
const APPS_SCRIPT_API_BASE = functions.config().appscript?.base || process.env.APPS_SCRIPT_API_BASE || "https://script.google.com/macros/s/REPLACE/exec";
const TIMEZONE = "Asia/Kolkata";

/** Save token (CORS enabled) */
exports.registerToken = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === 'OPTIONS') return res.status(204).send('');
      if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method-not-allowed' });
      const { email, token, ua } = req.body || {};
      if (!email || !token) return res.status(400).json({ ok:false, error:'missing' });

      await db.collection('tokens').doc(token).set({
        email: String(email).toLowerCase(),
        token, ua: ua || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      return res.json({ ok:true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok:false, error:String(e) });
    }
  });
});

/** Core logic shared */
async function twoHourlyPushCore() {
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
      const url = `${APPS_SCRIPT_API_BASE}?action=getTasks&email=${encodeURIComponent(email)}&name=`;
      const resp = await fetch(url);
      const tasks = await resp.json();

      const pending = (tasks || []).filter(t => String(t.status||'').toLowerCase() !== 'done');

      if (pending.length > 0) {
        const title = `You have ${pending.length} pending task${pending.length>1?'s':''}`;
        const body  = pending.slice(0,3).map(t=>t.task).join(', ') + (pending.length>3 ? '…' : '');
        const badge = String(pending.length);

        await admin.messaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: { badge, kind: "reminder" },
          webpush: { headers: { Urgency: "high" }, fcmOptions: { link: "/" } }
        });
      }
    } catch (e) { console.error("push error for", email, e); }
  }
}

/** Free plan friendly HTTPS trigger (use cron-job.org every 2 hours) */
exports.runTwoHourlyPush = functions.https.onRequest(async (req, res) => {
  try {
    await twoHourlyPushCore();
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
});

/** If you later switch to Blaze, enable native scheduler: */
exports.twoHourlyPush = functions.pubsub
  .schedule('every 2 hours').timeZone(TIMEZONE)
  .onRun(twoHourlyPushCore);
