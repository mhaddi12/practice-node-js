const API_BASE = '/api';

const els = {
  authSection: document.getElementById('authSection'),
  dashboardSection: document.getElementById('dashboardSection'),
  logoutBtn: document.getElementById('logoutBtn'),
  showLoginTab: document.getElementById('showLoginTab'),
  showRegisterTab: document.getElementById('showRegisterTab'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginMessage: document.getElementById('loginMessage'),
  registerMessage: document.getElementById('registerMessage'),
  profileCard: document.getElementById('profileCard'),
  profileInfo: document.getElementById('profileInfo'),
  adminCard: document.getElementById('adminCard'),
  usersTableBody: document.getElementById('usersTableBody'),
  adminMessage: document.getElementById('adminMessage')
};

function getTokens() {
  return {
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken')
  };
}

function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

function setMessage(el, text, isError) {
  el.textContent = text || '';
  el.className = 'message' + (text ? (isError ? ' error' : ' success') : '');
}

async function refreshAccessToken() {
  const { refreshToken } = getTokens();
  if (!refreshToken) return false;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) return false;

  const data = await res.json();
  setTokens(data);
  return true;
}

// Wraps fetch with the access token and retries once after a silent refresh on 401.
async function apiFetch(path, options = {}) {
  const { accessToken } = getTokens();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && (await refreshAccessToken())) {
    const retryHeaders = { ...headers, Authorization: `Bearer ${getTokens().accessToken}` };
    res = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
  }

  return res;
}

function showAuthView() {
  els.authSection.classList.remove('hidden');
  els.dashboardSection.classList.add('hidden');
  els.logoutBtn.classList.add('hidden');
}

function showDashboardView() {
  els.authSection.classList.add('hidden');
  els.dashboardSection.classList.remove('hidden');
  els.logoutBtn.classList.remove('hidden');
}

function renderProfile(user) {
  const isAdmin = user.role === 'admin';

  els.profileCard.classList.toggle('hidden', isAdmin);
  if (!isAdmin) {
    els.profileInfo.innerHTML = `
      <dt>Username</dt><dd>${user.username}</dd>
      <dt>Email</dt><dd>${user.email}</dd>
      <dt>Role</dt><dd>${user.role}</dd>
      <dt>Email verified</dt><dd>${user.isEmailVerified ? 'Yes' : 'No'}</dd>
    `;
  }

  els.adminCard.classList.toggle('hidden', !isAdmin);
}

async function loadUsers() {
  const res = await apiFetch('/users');
  if (!res.ok) {
    setMessage(els.adminMessage, 'Could not load users.', true);
    return;
  }
  const { users } = await res.json();

  els.usersTableBody.innerHTML = users
    .map(
      (u) => `
      <tr data-id="${u.id}">
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.isEmailVerified ? 'Yes' : 'No'}</td>
        <td class="actions">
          <button class="secondary" data-action="toggle-role">${u.role === 'admin' ? 'Make user' : 'Make admin'}</button>
          <button class="danger" data-action="delete">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

els.usersTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const row = button.closest('tr');
  const id = row.dataset.id;
  setMessage(els.adminMessage, '', false);

  if (button.dataset.action === 'delete') {
    const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(els.adminMessage, data.error || 'Delete failed', true);
      return;
    }
  }

  if (button.dataset.action === 'toggle-role') {
    const currentRole = row.children[2].textContent;
    const role = currentRole === 'admin' ? 'user' : 'admin';
    const res = await apiFetch(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(els.adminMessage, data.error || 'Role update failed', true);
      return;
    }
  }

  await loadUsers();
});

async function loadDashboard() {
  const res = await apiFetch('/users/me');
  if (!res.ok) {
    clearTokens();
    showAuthView();
    return;
  }

  const { user } = await res.json();
  renderProfile(user);
  showDashboardView();

  if (user.role === 'admin') {
    await loadUsers();
  }
}

els.showLoginTab.addEventListener('click', () => {
  els.showLoginTab.classList.add('active');
  els.showRegisterTab.classList.remove('active');
  els.loginForm.classList.remove('hidden');
  els.registerForm.classList.add('hidden');
});

els.showRegisterTab.addEventListener('click', () => {
  els.showRegisterTab.classList.add('active');
  els.showLoginTab.classList.remove('active');
  els.registerForm.classList.remove('hidden');
  els.loginForm.classList.add('hidden');
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(els.loginMessage, '', false);

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (!res.ok) {
    setMessage(els.loginMessage, data.error || 'Login failed', true);
    return;
  }

  setTokens(data);
  els.loginForm.reset();
  await loadDashboard();
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(els.registerMessage, '', false);

  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();

  if (!res.ok) {
    setMessage(els.registerMessage, data.error || 'Registration failed', true);
    return;
  }

  setMessage(els.registerMessage, 'Registered! Check your email to verify, then log in.', false);
  els.registerForm.reset();
  els.showLoginTab.click();
});

els.logoutBtn.addEventListener('click', async () => {
  const { refreshToken } = getTokens();
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  }).catch(() => {});
  clearTokens();
  showAuthView();
});

if (getTokens().accessToken) {
  loadDashboard();
} else {
  showAuthView();
}
