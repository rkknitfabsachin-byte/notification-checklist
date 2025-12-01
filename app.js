/* ====== CONFIG ====== */
const API_BASE = 'https://script.google.com/macros/s/AKfycbxG3oLMO-UfKQZjaCe0JH0BGhhBNbsukhAEzMDHnztW0o2-6YlVTKXoOyitn2_horXX/exec'; // e.g. https://script.google.com/macros/s/AKfyc.../exec

/* ====== STATE ====== */
const S = { name:'', email:'', tasks:[], unread:0, quiet:false, notifs:[] };
const $ = (id)=>document.getElementById(id);

/* ====== THEME ====== */
(function initTheme(){
  const saved = localStorage.getItem('theme') || 'light';
  document.body.dataset.theme = saved;
  $('themeBtn').textContent = saved==='dark' ? '☀️' : '🌙';
})();
$('themeBtn').onclick = ()=>{
  const now = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = now;
  localStorage.setItem('theme', now);
  $('themeBtn').textContent = now==='dark' ? '☀️' : '🌙';
};

/* ====== LOGIN ====== */
$('signinBtn').onclick = doLogin;
function doLogin(){
  const id = $('loginId').value.trim();
  const pw = $('loginPw').value.trim();
  if(!id || !pw){ return showErr('Enter login details'); }
  $('signinBtn').disabled = true; $('signinBtn').textContent = 'Signing...';

  fetch(API_BASE + `?action=login&loginId=${encodeURIComponent(id)}&password=${encodeURIComponent(pw)}`)
    .then(r=>r.json())
    .then(res=>{
      $('signinBtn').disabled = false; $('signinBtn').textContent = 'Sign in';
      if(!res || !res.success){ return showErr(res && res.message || 'Invalid credentials'); }
      S.name = res.name || ''; S.email = res.email || '';
      $('greetText').textContent = 'Hi, ' + S.name;
      $('headerDate').textContent = new Date().toDateString();
      $('loginView').style.display = 'none';
      $('appView').style.display = 'block';
      initQuietMode();
      loadTasks();
      startNotificationPolling();
    })
    .catch(err=>{ $('signinBtn').disabled=false; $('signinBtn').textContent='Sign in'; showErr('Network error'); console.error(err); });
}
function showErr(msg){ $('loginErr').style.display='block'; $('loginErr').textContent = msg; }

/* ====== NAV ====== */
document.querySelectorAll('.navItem').forEach(n=>{
  n.addEventListener('click', ()=>{
    document.querySelectorAll('.navItem').forEach(x=>x.classList.remove('active'));
    n.classList.add('active'); showTab(n.dataset.tab);
  });
});
function showTab(tab){
  $('todayList').parentElement.style.display = tab==='today' ? 'block' : 'none';
  $('pendingCard').style.display = tab==='pending' ? 'block' : 'none';
  $('doneCard').style.display = tab==='done' ? 'block' : 'none';
}

/* ====== TASKS ====== */
function loadTasks(){
  fetch(API_BASE + `?action=getTasks&email=${encodeURIComponent(S.email)}&name=${encodeURIComponent(S.name)}`)
    .then(r=>r.json())
    .then(tasks=>{ S.tasks = tasks||[]; renderTasks(); })
    .catch(console.error);
}
function renderTasks(){
  const todayKey = fmtKey(new Date());
  const today=[], pending=[], done=[];

  (S.tasks||[]).forEach(t=>{
    const status = String(t.status||'').toLowerCase();
    const d = t.date ? fmtKey(new Date(t.date)) : '';
    if(status==='done') done.push(t);
    else if(d===todayKey) today.push(t);
    else pending.push(t);
  });

  injectList('todayList', today);
  injectList('pendingList', pending);
  injectList('doneList', done);
}
function injectList(id, arr){
  const el = $(id); el.innerHTML = '';
  if(!arr || arr.length===0){ el.innerHTML = `<div class="muted" style="padding:10px">No tasks</div>`; return; }
  arr.forEach(t=>{
    const wrap = document.createElement('div');
    wrap.className='task';
    wrap.innerHTML = `
      <div class="taskTitle">${esc(t.task||'Untitled')}</div>
      <div class="meta">${esc(t.source||'')} • ${t.date||''}</div>
      <div style="margin-top:10px">${
        String(t.status||'').toLowerCase()==='done'
          ? `<span style="color:green;font-weight:700">Completed ✔</span>`
          : `<button class="smallBtn" data-src="${t.source}" data-id="${t.taskId}">Mark Done</button>`
      }</div>
    `;
    el.appendChild(wrap);
    const btn = wrap.querySelector('button');
    if(btn){
      btn.onclick = ()=>{
        btn.disabled = true; btn.textContent = 'Updating…';
        fetch(API_BASE + `?action=markDone&source=${encodeURIComponent(btn.dataset.src)}&taskId=${encodeURIComponent(btn.dataset.id)}&userName=${encodeURIComponent(S.email)}`)
          .then(r=>r.json()).then(()=> loadTasks());
      };
    }
  });
}
function fmtKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function esc(s){ return String(s||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

/* ====== QUIET MODE ====== */
function initQuietMode(){
  fetch(API_BASE + `?action=isQuiet&email=${encodeURIComponent(S.email)}`)
    .then(r=>r.json())
    .then(res=>{
      S.quiet = !!(res && res.quiet);
      $('quietToggle').checked = S.quiet;
    })
    .catch(console.error);

  $('quietToggle').addEventListener('change', ()=>{
    S.quiet = $('quietToggle').checked;
    fetch(API_BASE + `?action=setQuiet&email=${encodeURIComponent(S.email)}&enabled=${S.quiet?1:0}`).catch(console.error);
  });
}

/* ====== NOTIFICATIONS (backend filtered) ====== */
let notifTimer=null;
const ding = ()=>{ if(S.quiet) return; const a=$('notifSound'); if(!a) return; a.currentTime=0; a.play().catch(()=>{}); };

function startNotificationPolling(){
  checkNotifications();
  notifTimer = setInterval(checkNotifications, 10000); // 10s
}

function checkNotifications(){
  // backend returns only NEW updates for this user (filtered = Option A)
  fetch(API_BASE + `?action=checkUpdates&email=${encodeURIComponent(S.email)}`)
    .then(r=>r.json())
    .then(list=>{
      if(!Array.isArray(list)) list = [];
      if(list.length>0){
        S.notifs = (S.notifs||[]).concat(list).slice(-50);
        updateBadge(list.length);
        if(!S.quiet) ding();
      }
    })
    .catch(console.error);
}

function updateBadge(n){
  if(n>0){ $('notifBadge').style.display='flex'; $('notifBadge').textContent = Math.min(99,n); }
  else{ $('notifBadge').style.display='none'; }
}

/* Drawer */
$('notifBtn').onclick = openNotifications;
function openNotifications(){
  const p = $('notifPanel'); p.innerHTML = '';
  if(!S.notifs || S.notifs.length===0){
    p.innerHTML = `<div class="muted">No notifications</div>`;
  } else {
    S.notifs.slice().reverse().forEach(n=>{
      const row = document.createElement('div');
      row.className='notifItem';
      row.innerHTML = `<div class="notifTitle">${esc(n.title||'')}</div><div class="notifBody">${esc(n.body||'')}</div>`;
      p.appendChild(row);
    });
  }
  $('notifBadge').style.display='none';
  p.style.top = '0';
  setTimeout(()=> document.addEventListener('click', closeOnce), 100);
}
function closeOnce(){ closePanel(); document.removeEventListener('click', closeOnce); }
function closePanel(){ $('notifPanel').style.top = '-100%'; }
