/* =========================================================
   Family Trip Coordinator — app.js
   Single-page app. No build step. Firebase compat SDK.
   ========================================================= */

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

let primaryApp, secondaryApp, auth, secondaryAuth, db;
let currentUser = null;      // { uid, role, name, coordinatorId }
let unsubCoordinators = null;
let unsubPassengers = null;
let allCoordinators = [];
let allPassengers = [];
let adminActiveTab = 'dashboard';
let coordSearchTerm = '';
let adminSearchTerm = '';

const CHECK_FIELDS = [
  { key: 'aadhaar',  label: 'Aadhaar verified' },
  { key: 'ticket',   label: 'Ticket checked' },
  { key: 'station',  label: 'Reached station' },
  { key: 'boarded',  label: 'Train boarded' },
  { key: 'food',     label: 'Food confirmed' },
];

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ================= Firebase init ================= */
function initFirebase() {
  if (firebaseConfig.apiKey.startsWith('PASTE_')) {
    renderSetupNeeded();
    return false;
  }
  primaryApp = firebase.initializeApp(firebaseConfig);
  secondaryApp = firebase.initializeApp(firebaseConfig, 'secondary');
  auth = primaryApp.auth();
  secondaryAuth = secondaryApp.auth();
  db = primaryApp.firestore();
  return true;
}

function renderSetupNeeded() {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="ticket" style="max-width:460px;">
        <div class="ticket-strip"><span>SETUP REQUIRED</span><span>STEP 1</span></div>
        <div class="ticket-body">
          <h2>Connect Firebase first</h2>
          <p class="sub">This app needs your own Firebase project's keys before it can run.</p>
          <div class="setup-note">
            Open <strong>js/firebase-config.js</strong> in your GitHub repo and paste in your
            Firebase project's config values. See the README for the full step-by-step guide.
          </div>
        </div>
      </div>
    </div>`;
}

/* ================= Auth state ================= */
function watchAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      currentUser = null;
      teardownListeners();
      try {
        await checkBootstrapAndRenderLogin();
      } catch (e) {
        console.error(e);
        renderFatalError(e);
      }
      return;
    }
    try {
      const profileSnap = await db.collection('users').doc(user.uid).get();
      if (!profileSnap.exists) {
        toast('No profile found for this login. Contact the admin.');
        auth.signOut();
        return;
      }
      const profile = profileSnap.data();
      currentUser = { uid: user.uid, role: profile.role, name: profile.name, coordinatorId: profile.coordinatorId || null };
      if (currentUser.role === 'admin') {
        startAdminApp();
      } else {
        startCoordinatorApp();
      }
    } catch (e) {
      console.error(e);
      toast('Could not load your profile: ' + e.message);
    }
  });
}

function renderFatalError(e) {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="ticket" style="max-width:460px;">
        <div class="ticket-strip"><span>ERROR</span><span>DEBUG</span></div>
        <div class="ticket-body">
          <h2>Something went wrong</h2>
          <p class="sub">The app couldn't reach Firestore. Screenshot this and send it back:</p>
          <div class="setup-note" style="word-break:break-word;">
            <strong>${esc(e.code || 'unknown')}</strong><br>${esc(e.message || String(e))}
          </div>
        </div>
      </div>
    </div>`;
}

async function checkBootstrapAndRenderLogin() {
  const setupDoc = await db.collection('config').doc('setup').get();
  const adminExists = setupDoc.exists && setupDoc.data().adminCreated === true;
  renderLogin(!adminExists);
}

/* ================= Login / Bootstrap screen ================= */
function renderLogin(needsBootstrap) {
  let role = 'coordinator';

  app.innerHTML = `
    <div class="login-wrap">
      <div class="ticket">
        <div class="ticket-strip"><span>FAMILY TRIP · 2026</span><span id="ticketRight">BOARDING PASS</span></div>
        <div class="ticket-body">
          <h2>Family Trip Coordinator</h2>
          <p class="sub">${needsBootstrap ? 'First time setup — create the Admin account.' : 'Sign in to continue.'}</p>

          ${needsBootstrap ? renderBootstrapForm() : renderLoginForm()}
        </div>
      </div>
    </div>`;

  if (needsBootstrap) {
    document.getElementById('bootstrapForm').addEventListener('submit', handleBootstrap);
    return;
  }

  const toggle = document.getElementById('roleToggle');
  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    role = btn.dataset.role;
    [...toggle.children].forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('userLabel').textContent = role === 'admin' ? 'Admin Username' : 'Coordinator Username';
    document.getElementById('passLabel').textContent = role === 'admin' ? 'Password' : 'PIN';
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errBox = document.getElementById('errBox');
    errBox.classList.remove('show');
    if (!username || !pass) return;

    const email = username.toLowerCase() + '@trip.local';
    const password = role === 'admin' ? pass : pass + PIN_SALT;
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      errBox.textContent = 'Login failed — check your username and ' + (role === 'admin' ? 'password' : 'PIN') + '.';
      errBox.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });
}

function renderLoginForm() {
  return `
    <div class="role-toggle" id="roleToggle">
      <button type="button" data-role="coordinator" class="active">Coordinator</button>
      <button type="button" data-role="admin">Admin</button>
    </div>
    <div class="error-msg" id="errBox"></div>
    <form id="loginForm">
      <div class="field">
        <label id="userLabel">Coordinator Username</label>
        <input id="username" type="text" autocomplete="username" required>
      </div>
      <div class="field">
        <label id="passLabel">PIN</label>
        <input id="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="btn-primary" type="submit">Log In</button>
    </form>`;
}

function renderBootstrapForm() {
  return `
    <div class="error-msg" id="errBox"></div>
    <form id="bootstrapForm">
      <div class="field"><label>Your Name</label><input id="bsName" type="text" required></div>
      <div class="field"><label>Admin Username</label><input id="bsUser" type="text" required></div>
      <div class="field"><label>Password (min 6 characters)</label><input id="bsPass" type="password" minlength="6" required></div>
      <button class="btn-primary" type="submit">Create Admin Account</button>
    </form>`;
}

async function handleBootstrap(e) {
  e.preventDefault();
  const name = document.getElementById('bsName').value.trim();
  const username = document.getElementById('bsUser').value.trim();
  const pass = document.getElementById('bsPass').value;
  const errBox = document.getElementById('errBox');
  errBox.classList.remove('show');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating…';

  try {
    const email = username.toLowerCase() + '@trip.local';
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection('users').doc(cred.user.uid).set({ role: 'admin', name });
    await db.collection('config').doc('setup').set({ adminCreated: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('Admin account created. Welcome!');
    // onAuthStateChanged will pick this up and route to the admin app.
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.add('show');
    btn.disabled = false; btn.textContent = 'Create Admin Account';
  }
}

/* ================= Shared shell ================= */
function shellHeader(title, subtitle) {
  return `
    <div class="board-header">
      <div>
        <div class="brand">Family Trip</div>
        <h1>${esc(title)}</h1>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="who"><strong>${esc(currentUser.name || '')}</strong>${esc(subtitle || '')}</div>
        <button class="icon-btn" id="logoutBtn">Log Out</button>
      </div>
    </div>`;
}

function attachLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());
}

function teardownListeners() {
  if (unsubCoordinators) { unsubCoordinators(); unsubCoordinators = null; }
  if (unsubPassengers) { unsubPassengers(); unsubPassengers = null; }
  allCoordinators = []; allPassengers = [];
}

/* ================= Status helpers ================= */
function passengerStatus(p) {
  if (p.attendance === 'absent') return 'red';
  const checksDone = CHECK_FIELDS.every(f => p.checks?.[f.key]);
  if (checksDone && p.attendance === 'present') return 'green';
  if (p.attendance === 'present' || Object.values(p.checks || {}).some(Boolean)) return 'yellow';
  return 'grey';
}

function coordinatorProgress(coordId) {
  const members = allPassengers.filter(p => p.coordinatorId === coordId);
  const completed = members.filter(p => passengerStatus(p) === 'green').length;
  return { total: members.length, completed, pending: members.length - completed };
}

/* =========================================================
   ADMIN APP
   ========================================================= */
function startAdminApp() {
  teardownListeners();
  unsubCoordinators = db.collection('coordinators').orderBy('name').onSnapshot(snap => {
    allCoordinators = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdmin();
  });
  unsubPassengers = db.collection('passengers').orderBy('name').onSnapshot(snap => {
    allPassengers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdmin();
  });
  renderAdmin();
}

function renderAdmin() {
  const total = allPassengers.length;
  const completed = allPassengers.filter(p => passengerStatus(p) === 'green').length;
  const missing = allPassengers.filter(p => passengerStatus(p) === 'red').length;
  const pending = total - completed - missing;

  app.innerHTML = `
    ${shellHeader('Admin Dashboard')}
    <div class="tabbar">
      <button data-tab="dashboard" class="${adminActiveTab==='dashboard'?'active':''}">Dashboard</button>
      <button data-tab="coordinators" class="${adminActiveTab==='coordinators'?'active':''}">Coordinators</button>
      <button data-tab="passengers" class="${adminActiveTab==='passengers'?'active':''}">Passengers</button>
      <button data-tab="status" class="${adminActiveTab==='status'?'active':''}">Status</button>
    </div>
    <div class="content" id="adminContent"></div>
  `;
  attachLogout();
  [...document.querySelectorAll('.tabbar button')].forEach(b => {
    b.addEventListener('click', () => { adminActiveTab = b.dataset.tab; renderAdmin(); });
  });

  const el = document.getElementById('adminContent');
  if (adminActiveTab === 'dashboard') el.innerHTML = adminDashboardHtml(total, completed, pending, missing);
  else if (adminActiveTab === 'coordinators') { el.innerHTML = adminCoordinatorsHtml(); wireCoordinatorsTab(); }
  else if (adminActiveTab === 'passengers') { el.innerHTML = adminPassengersHtml(); wirePassengersTab(); }
  else if (adminActiveTab === 'status') el.innerHTML = adminStatusHtml();

  if (adminActiveTab === 'dashboard') {
    document.getElementById('goAddCoord')?.addEventListener('click', () => { adminActiveTab='coordinators'; renderAdmin(); openCoordinatorModal(); });
    document.getElementById('goAddPax')?.addEventListener('click', () => { adminActiveTab='passengers'; renderAdmin(); openPassengerModal(); });
  }
}

function adminDashboardHtml(total, completed, pending, missing) {
  const rows = allCoordinators.map(c => {
    const { total: t, completed: comp, pending: pen } = coordinatorProgress(c.id);
    let signal = 'green', label = 'Complete';
    if (t === 0) { signal = 'grey'.replace('grey','yellow'); label='No members'; }
    else if (pen > 0 && comp > 0) { signal = 'yellow'; label = `${pen} pending`; }
    else if (comp === 0 && t > 0) { signal = 'red'; label = 'Attention'; }
    return `<div class="coord-row">
      <div><span class="signal ${signal}"></span><span class="name">${esc(c.name)}</span></div>
      <div class="meta">${comp}/${t} · ${label}</div>
    </div>`;
  }).join('') || `<div class="empty-state"><div class="glyph">🚉</div>No coordinators yet.</div>`;

  return `
    <div class="stat-row">
      <div class="stat-block"><div class="num">${total}</div><div class="lbl">Members</div></div>
      <div class="stat-block"><div class="num">${allCoordinators.length}</div><div class="lbl">Coordinators</div></div>
      <div class="stat-block amber"><div class="num">${completed}</div><div class="lbl">Completed</div></div>
      <div class="stat-block"><div class="num">${pending}</div><div class="lbl">Pending</div></div>
      <div class="stat-block"><div class="num">${missing}</div><div class="lbl">Missing</div></div>
    </div>
    <div class="card">
      <h3>Coordinator Status</h3>
      ${rows}
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn-primary" id="goAddCoord" style="flex:1;">+ Add Coordinator</button>
      <button class="btn-primary" id="goAddPax" style="flex:1; background:var(--platform-amber); color:var(--rail-navy);">+ Add Passenger</button>
    </div>`;
}

/* -------- Coordinators tab -------- */
function adminCoordinatorsHtml() {
  const filtered = allCoordinators.filter(c => c.name.toLowerCase().includes(coordSearchTerm.toLowerCase()));
  const rows = filtered.map(c => {
    const { total, completed } = coordinatorProgress(c.id);
    return `<tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.username)}</td>
      <td>${esc(c.family || '—')}</td>
      <td>${total}</td>
      <td><span class="pill ${c.status==='Active'?'green':'grey'}">${esc(c.status)}</span></td>
      <td><button class="link-btn" data-edit-coord="${c.id}">Edit</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft); padding:20px;">No coordinators found.</td></tr>`;

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0;">Coordinators (${allCoordinators.length})</h3>
        <button class="btn-primary" style="width:auto; padding:10px 16px;" id="addCoordBtn">+ Add</button>
      </div>
      <div class="search-box"><input id="coordSearch" placeholder="Search coordinators…" value="${esc(coordSearchTerm)}"></div>
      <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Username</th><th>Family</th><th>Members</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
    </div>`;
}

function wireCoordinatorsTab() {
  document.getElementById('addCoordBtn').addEventListener('click', () => openCoordinatorModal());
  document.getElementById('coordSearch').addEventListener('input', (e) => { coordSearchTerm = e.target.value; renderAdmin(); });
  [...document.querySelectorAll('[data-edit-coord]')].forEach(b => {
    b.addEventListener('click', () => openCoordinatorModal(allCoordinators.find(c => c.id === b.dataset.editCoord)));
  });
}

function openCoordinatorModal(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Coordinator</h3>
    <form id="coordForm">
      <div class="field"><label>Coordinator Name *</label><input id="cName" required value="${esc(existing?.name||'')}"></div>
      <div class="form-grid">
        <div class="field"><label>Username *</label><input id="cUser" required ${isEdit?'disabled':''} value="${esc(existing?.username||'')}"></div>
        <div class="field"><label>${isEdit ? 'New PIN (leave blank to keep)' : 'PIN * (4+ digits)'}</label><input id="cPin" ${isEdit?'':'required'} minlength="4"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Mobile Number</label><input id="cMobile" value="${esc(existing?.mobile||'')}"></div>
        <div class="field"><label>Family / Group Name</label><input id="cFamily" value="${esc(existing?.family||'')}"></div>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="cStatus">
          <option value="Active" ${existing?.status==='Active'?'selected':''}>Active</option>
          <option value="Inactive" ${existing?.status==='Inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="error-msg" id="coordErr"></div>
      <button class="btn-primary" type="submit">${isEdit ? 'Save Changes' : 'Create Coordinator'}</button>
      ${isEdit ? `<div style="height:8px;"></div><button type="button" class="btn-secondary" id="delCoordBtn">Delete Coordinator</button>` : ''}
    </form>
  `);

  document.getElementById('coordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('coordErr');
    errBox.classList.remove('show');
    const name = document.getElementById('cName').value.trim();
    const username = document.getElementById('cUser').value.trim();
    const pin = document.getElementById('cPin').value.trim();
    const mobile = document.getElementById('cMobile').value.trim();
    const family = document.getElementById('cFamily').value.trim();
    const status = document.getElementById('cStatus').value;
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';

    try {
      if (!isEdit) {
        // Create the Firebase Auth account on the SECONDARY app instance so
        // the admin's own session (on the primary app) is not disturbed.
        const email = username.toLowerCase() + '@trip.local';
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pin + PIN_SALT);
        const uid = cred.user.uid;
        await secondaryAuth.signOut();

        const coordRef = await db.collection('coordinators').add({
          name, username, family, mobile, status, authUid: uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection('users').doc(uid).set({ role: 'coordinator', name, coordinatorId: coordRef.id });
        toast('Coordinator created.');
      } else {
        await db.collection('coordinators').doc(existing.id).update({ name, mobile, family, status });
        if (pin) {
          // PIN changes require the coordinator's own re-auth in Firebase's
          // client SDK; simplest reliable path is deleting & recreating the
          // login via the secondary app is not directly possible for
          // existing users without their current password. So: PIN resets
          // must be done from the Firebase Console (Authentication tab) —
          // noted in the README.
          toast('Saved. Note: PIN changes must be done in the Firebase Console → Authentication.'        <div class="ticket-body">
          <h2>Family Trip Coordinator</h2>
          <p class="sub">${needsBootstrap ? 'First time setup — create the Admin account.' : 'Sign in to continue.'}</p>

          ${needsBootstrap ? renderBootstrapForm() : renderLoginForm()}
        </div>
      </div>
    </div>`;

  if (needsBootstrap) {
    document.getElementById('bootstrapForm').addEventListener('submit', handleBootstrap);
    return;
  }

  const toggle = document.getElementById('roleToggle');
  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    role = btn.dataset.role;
    [...toggle.children].forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('userLabel').textContent = role === 'admin' ? 'Admin Username' : 'Coordinator Username';
    document.getElementById('passLabel').textContent = role === 'admin' ? 'Password' : 'PIN';
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errBox = document.getElementById('errBox');
    errBox.classList.remove('show');
    if (!username || !pass) return;

    const email = username.toLowerCase() + '@trip.local';
    const password = role === 'admin' ? pass : pass + PIN_SALT;
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      errBox.textContent = 'Login failed — check your username and ' + (role === 'admin' ? 'password' : 'PIN') + '.';
      errBox.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });
}

function renderLoginForm() {
  return `
    <div class="role-toggle" id="roleToggle">
      <button type="button" data-role="coordinator" class="active">Coordinator</button>
      <button type="button" data-role="admin">Admin</button>
    </div>
    <div class="error-msg" id="errBox"></div>
    <form id="loginForm">
      <div class="field">
        <label id="userLabel">Coordinator Username</label>
        <input id="username" type="text" autocomplete="username" required>
      </div>
      <div class="field">
        <label id="passLabel">PIN</label>
        <input id="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="btn-primary" type="submit">Log In</button>
    </form>`;
}

function renderBootstrapForm() {
  return `
    <div class="error-msg" id="errBox"></div>
    <form id="bootstrapForm">
      <div class="field"><label>Your Name</label><input id="bsName" type="text" required></div>
      <div class="field"><label>Admin Username</label><input id="bsUser" type="text" required></div>
      <div class="field"><label>Password (min 6 characters)</label><input id="bsPass" type="password" minlength="6" required></div>
      <button class="btn-primary" type="submit">Create Admin Account</button>
    </form>`;
}

async function handleBootstrap(e) {
  e.preventDefault();
  const name = document.getElementById('bsName').value.trim();
  const username = document.getElementById('bsUser').value.trim();
  const pass = document.getElementById('bsPass').value;
  const errBox = document.getElementById('errBox');
  errBox.classList.remove('show');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating…';

  try {
    const email = username.toLowerCase() + '@trip.local';
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection('users').doc(cred.user.uid).set({ role: 'admin', name });
    await db.collection('config').doc('setup').set({ adminCreated: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('Admin account created. Welcome!');
    // onAuthStateChanged will pick this up and route to the admin app.
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.add('show');
    btn.disabled = false; btn.textContent = 'Create Admin Account';
  }
}

/* ================= Shared shell ================= */
function shellHeader(title, subtitle) {
  return `
    <div class="board-header">
      <div>
        <div class="brand">Family Trip</div>
        <h1>${esc(title)}</h1>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="who"><strong>${esc(currentUser.name || '')}</strong>${esc(subtitle || '')}</div>
        <button class="icon-btn" id="logoutBtn">Log Out</button>
      </div>
    </div>`;
}

function attachLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());
}

function teardownListeners() {
  if (unsubCoordinators) { unsubCoordinators(); unsubCoordinators = null; }
  if (unsubPassengers) { unsubPassengers(); unsubPassengers = null; }
  allCoordinators = []; allPassengers = [];
}

/* ================= Status helpers ================= */
function passengerStatus(p) {
  if (p.attendance === 'absent') return 'red';
  const checksDone = CHECK_FIELDS.every(f => p.checks?.[f.key]);
  if (checksDone && p.attendance === 'present') return 'green';
  if (p.attendance === 'present' || Object.values(p.checks || {}).some(Boolean)) return 'yellow';
  return 'grey';
}

function coordinatorProgress(coordId) {
  const members = allPassengers.filter(p => p.coordinatorId === coordId);
  const completed = members.filter(p => passengerStatus(p) === 'green').length;
  return { total: members.length, completed, pending: members.length - completed };
}

/* =========================================================
   ADMIN APP
   ========================================================= */
function startAdminApp() {
  teardownListeners();
  unsubCoordinators = db.collection('coordinators').orderBy('name').onSnapshot(snap => {
    allCoordinators = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdmin();
  });
  unsubPassengers = db.collection('passengers').orderBy('name').onSnapshot(snap => {
    allPassengers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdmin();
  });
  renderAdmin();
}

function renderAdmin() {
  const total = allPassengers.length;
  const completed = allPassengers.filter(p => passengerStatus(p) === 'green').length;
  const missing = allPassengers.filter(p => passengerStatus(p) === 'red').length;
  const pending = total - completed - missing;

  app.innerHTML = `
    ${shellHeader('Admin Dashboard')}
    <div class="tabbar">
      <button data-tab="dashboard" class="${adminActiveTab==='dashboard'?'active':''}">Dashboard</button>
      <button data-tab="coordinators" class="${adminActiveTab==='coordinators'?'active':''}">Coordinators</button>
      <button data-tab="passengers" class="${adminActiveTab==='passengers'?'active':''}">Passengers</button>
      <button data-tab="status" class="${adminActiveTab==='status'?'active':''}">Status</button>
    </div>
    <div class="content" id="adminContent"></div>
  `;
  attachLogout();
  [...document.querySelectorAll('.tabbar button')].forEach(b => {
    b.addEventListener('click', () => { adminActiveTab = b.dataset.tab; renderAdmin(); });
  });

  const el = document.getElementById('adminContent');
  if (adminActiveTab === 'dashboard') el.innerHTML = adminDashboardHtml(total, completed, pending, missing);
  else if (adminActiveTab === 'coordinators') { el.innerHTML = adminCoordinatorsHtml(); wireCoordinatorsTab(); }
  else if (adminActiveTab === 'passengers') { el.innerHTML = adminPassengersHtml(); wirePassengersTab(); }
  else if (adminActiveTab === 'status') el.innerHTML = adminStatusHtml();

  if (adminActiveTab === 'dashboard') {
    document.getElementById('goAddCoord')?.addEventListener('click', () => { adminActiveTab='coordinators'; renderAdmin(); openCoordinatorModal(); });
    document.getElementById('goAddPax')?.addEventListener('click', () => { adminActiveTab='passengers'; renderAdmin(); openPassengerModal(); });
  }
}

function adminDashboardHtml(total, completed, pending, missing) {
  const rows = allCoordinators.map(c => {
    const { total: t, completed: comp, pending: pen } = coordinatorProgress(c.id);
    let signal = 'green', label = 'Complete';
    if (t === 0) { signal = 'grey'.replace('grey','yellow'); label='No members'; }
    else if (pen > 0 && comp > 0) { signal = 'yellow'; label = `${pen} pending`; }
    else if (comp === 0 && t > 0) { signal = 'red'; label = 'Attention'; }
    return `<div class="coord-row">
      <div><span class="signal ${signal}"></span><span class="name">${esc(c.name)}</span></div>
      <div class="meta">${comp}/${t} · ${label}</div>
    </div>`;
  }).join('') || `<div class="empty-state"><div class="glyph">🚉</div>No coordinators yet.</div>`;

  return `
    <div class="stat-row">
      <div class="stat-block"><div class="num">${total}</div><div class="lbl">Members</div></div>
      <div class="stat-block"><div class="num">${allCoordinators.length}</div><div class="lbl">Coordinators</div></div>
      <div class="stat-block amber"><div class="num">${completed}</div><div class="lbl">Completed</div></div>
      <div class="stat-block"><div class="num">${pending}</div><div class="lbl">Pending</div></div>
      <div class="stat-block"><div class="num">${missing}</div><div class="lbl">Missing</div></div>
    </div>
    <div class="card">
      <h3>Coordinator Status</h3>
      ${rows}
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn-primary" id="goAddCoord" style="flex:1;">+ Add Coordinator</button>
      <button class="btn-primary" id="goAddPax" style="flex:1; background:var(--platform-amber); color:var(--rail-navy);">+ Add Passenger</button>
    </div>`;
}

/* -------- Coordinators tab -------- */
function adminCoordinatorsHtml() {
  const filtered = allCoordinators.filter(c => c.name.toLowerCase().includes(coordSearchTerm.toLowerCase()));
  const rows = filtered.map(c => {
    const { total, completed } = coordinatorProgress(c.id);
    return `<tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.username)}</td>
      <td>${esc(c.family || '—')}</td>
      <td>${total}</td>
      <td><span class="pill ${c.status==='Active'?'green':'grey'}">${esc(c.status)}</span></td>
      <td><button class="link-btn" data-edit-coord="${c.id}">Edit</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft); padding:20px;">No coordinators found.</td></tr>`;

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0;">Coordinators (${allCoordinators.length})</h3>
        <button class="btn-primary" style="width:auto; padding:10px 16px;" id="addCoordBtn">+ Add</button>
      </div>
      <div class="search-box"><input id="coordSearch" placeholder="Search coordinators…" value="${esc(coordSearchTerm)}"></div>
      <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Username</th><th>Family</th><th>Members</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
    </div>`;
}

function wireCoordinatorsTab() {
  document.getElementById('addCoordBtn').addEventListener('click', () => openCoordinatorModal());
  document.getElementById('coordSearch').addEventListener('input', (e) => { coordSearchTerm = e.target.value; renderAdmin(); });
  [...document.querySelectorAll('[data-edit-coord]')].forEach(b => {
    b.addEventListener('click', () => openCoordinatorModal(allCoordinators.find(c => c.id === b.dataset.editCoord)));
  });
}

function openCoordinatorModal(existing) {
  const isEdit = !!existing;
  showModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Coordinator</h3>
    <form id="coordForm">
      <div class="field"><label>Coordinator Name *</label><input id="cName" required value="${esc(existing?.name||'')}"></div>
      <div class="form-grid">
        <div class="field"><label>Username *</label><input id="cUser" required ${isEdit?'disabled':''} value="${esc(existing?.username||'')}"></div>
        <div class="field"><label>${isEdit ? 'New PIN (leave blank to keep)' : 'PIN * (4+ digits)'}</label><input id="cPin" ${isEdit?'':'required'} minlength="4"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Mobile Number</label><input id="cMobile" value="${esc(existing?.mobile||'')}"></div>
        <div class="field"><label>Family / Group Name</label><input id="cFamily" value="${esc(existing?.family||'')}"></div>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="cStatus">
          <option value="Active" ${existing?.status==='Active'?'selected':''}>Active</option>
          <option value="Inactive" ${existing?.status==='Inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="error-msg" id="coordErr"></div>
      <button class="btn-primary" type="submit">${isEdit ? 'Save Changes' : 'Create Coordinator'}</button>
      ${isEdit ? `<div style="height:8px;"></div><button type="button" class="btn-secondary" id="delCoordBtn">Delete Coordinator</button>` : ''}
    </form>
  `);

  document.getElementById('coordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('coordErr');
    errBox.classList.remove('show');
    const name = document.getElementById('cName').value.trim();
    const username = document.getElementById('cUser').value.trim();
    const pin = document.getElementById('cPin').value.trim();
    const mobile = document.getElementById('cMobile').value.trim();
    const family = document.getElementById('cFamily').value.trim();
    const status = document.getElementById('cStatus').value;
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';

    try {
      if (!isEdit) {
        // Create the Firebase Auth account on the SECONDARY app instance so
        // the admin's own session (on the primary app) is not disturbed.
        const email = username.toLowerCase() + '@trip.local';
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pin + PIN_SALT);
        const uid = cred.user.uid;
        await secondaryAuth.signOut();

        const coordRef = await db.collection('coordinators').add({
          name, username, family, mobile, status, authUid: uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection('users').doc(uid).set({ role: 'coordinator', name, coordinatorId: coordRef.id });
        toast('Coordinator created.');
      } else {
        await db.collection('coordinators').doc(existing.id).update({ name, mobile, family, status });
        if (pin) {
          // PIN changes require the coordinator's own re-auth in Firebase's
          // client SDK; simplest reliable path is deleting & recreating the
          // login via the secondary app is not directly possible for
          // existing users without their current password. So: PIN resets
          // must be done from the Firebase Console (Authentication tab) —
          // noted in the README.
          toast('Saved. Note: PIN changes must be done in the Firebase Console → Authentication.');
        } else {
          toast('Coordinator updated.');
        }
      }
      closeModal();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.add('show');
      submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Coordinator';
    }
  });

  if (isEdit) {
    document.getElementById('delCoordBtn').addEventListener('click', async () => {
      const assigned = allPassengers.filter(p => p.coordinatorId === existing.id).length;
      if (assigned > 0) { toast(`Can't delete — ${assigned} passenger(s) still assigned. Reassign them first.`); return; }
      if (!confirm(`Delete coordinator "${existing.name}"? This canno
