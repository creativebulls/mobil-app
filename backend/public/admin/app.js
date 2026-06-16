const API_BASE = `${window.location.origin}/api/v1/admin`;
const TOKEN_KEY = 'whereabout_admin_token';

const $ = (id) => document.getElementById(id);

let state = {
  page: 1,
  limit: 20,
  search: '',
  users: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  activeUser: null,
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.success) {
    const message = payload.error?.message ?? 'Request failed';
    if (response.status === 401 && path !== '/login') {
      logout();
    }
    throw new Error(message);
  }

  return payload.data;
}

function toast(message, type = 'success') {
  const host = $('toast-host');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showLogin() {
  $('login-view').classList.remove('hidden');
  $('dashboard-view').classList.add('hidden');
}

function showDashboard() {
  $('login-view').classList.add('hidden');
  $('dashboard-view').classList.remove('hidden');
}

function logout() {
  setToken(null);
  showLogin();
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function statusBadge(user) {
  if (user.emailVerified) {
    return '<span class="badge badge-success">Verified</span>';
  }
  return '<span class="badge badge-warning">Unverified</span>';
}

function registrationBadge(status) {
  const labels = {
    pending_email: 'Pending email',
    pending_profile: 'Pending profile',
    completed: 'Completed',
  };
  const cls = status === 'completed' ? 'badge-success' : 'badge-muted';
  return `<span class="badge ${cls}">${labels[status] ?? status}</span>`;
}

function renderUsers() {
  const tbody = $('users-body');
  const { users, pagination } = state;

  if (!users.length) {
    tbody.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">No users found.</div></td></tr>';
  } else {
    tbody.innerHTML = users
      .map(
        (user) => `
      <tr>
        <td>
          <div class="user-cell">
            <span class="user-name">${escapeHtml(user.displayName)}</span>
            <span class="user-email">${escapeHtml(user.email)}</span>
          </div>
        </td>
        <td>${statusBadge(user)}</td>
        <td>${registrationBadge(user.registrationStatus)}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>
          <div class="actions">
            ${
              user.emailVerified
                ? ''
                : `<button class="btn btn-secondary btn-sm" data-action="verify" data-id="${user.id}">Verify</button>`
            }
            <button class="btn btn-secondary btn-sm" data-action="reset" data-id="${user.id}" data-name="${escapeAttr(
              user.displayName,
            )}">Reset password</button>
            <button class="btn btn-destructive btn-sm" data-action="delete" data-id="${user.id}" data-name="${escapeAttr(
              user.displayName,
            )}">Delete</button>
          </div>
        </td>
      </tr>`,
      )
      .join('');
  }

  $('page-info').textContent = `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} users`;
  $('stat-total').textContent = String(pagination.total);
  $('stat-verified').textContent = String(users.filter((u) => u.emailVerified).length);
  $('stat-unverified').textContent = String(users.filter((u) => !u.emailVerified).length);

  $('prev-page').disabled = pagination.page <= 1;
  $('next-page').disabled = pagination.page >= pagination.totalPages;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

async function loadUsers() {
  $('load-indicator').classList.remove('hidden');
  try {
    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
    });
    if (state.search) {
      params.set('search', state.search);
    }

    const data = await api(`/users?${params.toString()}`);
    state.users = data.users;
    state.pagination = data.pagination;
    renderUsers();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('load-indicator').classList.add('hidden');
  }
}

function renderPushStatus(config) {
  const badge = $('push-status-badge');
  const detail = $('push-status-detail');

  if (config.configured) {
    badge.className = 'badge badge-success';
    badge.textContent = 'Configured';
    const parts = [];
    if (config.projectId) parts.push(`project: ${config.projectId}`);
    if (config.updatedAt) parts.push(`updated ${formatDate(config.updatedAt)}`);
    detail.textContent = parts.join(' · ');
  } else {
    badge.className = 'badge badge-warning';
    badge.textContent = 'Not configured';
    detail.textContent = 'Push notifications are disabled until a credential is saved.';
  }
}

async function loadPushConfig() {
  try {
    const config = await api('/push-config');
    renderPushStatus(config);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function savePushConfig() {
  const errorEl = $('push-config-error');
  errorEl.textContent = '';
  const serviceAccount = $('push-service-account').value.trim();

  if (!serviceAccount) {
    errorEl.textContent = 'Paste your service account JSON first.';
    return;
  }

  $('push-save-btn').disabled = true;
  try {
    const config = await api('/push-config', {
      method: 'PUT',
      body: JSON.stringify({ serviceAccount }),
    });
    renderPushStatus({ ...config, updatedAt: new Date().toISOString() });
    $('push-service-account').value = '';
    toast('Firebase credential saved');
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    $('push-save-btn').disabled = false;
  }
}

async function clearPushConfig() {
  $('push-clear-btn').disabled = true;
  try {
    const config = await api('/push-config', { method: 'DELETE' });
    renderPushStatus(config);
    toast('Firebase credential removed');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('push-clear-btn').disabled = false;
  }
}

async function sendTestPush() {
  const email = $('push-test-email').value.trim();
  if (!email) {
    toast('Enter a user email to test', 'error');
    return;
  }

  $('push-test-btn').disabled = true;
  try {
    const result = await api('/push-config/test', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    toast(`Test sent to ${result.deviceCount} device(s)`);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('push-test-btn').disabled = false;
  }
}

function openModal(id) {
  $(id).classList.remove('hidden');
}

function closeModal(id) {
  $(id).classList.add('hidden');
}

async function handleLogin(event) {
  event.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const errorEl = $('login-error');
  errorEl.textContent = '';
  $('login-submit').disabled = true;

  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    showDashboard();
    await loadUsers();
    await loadPushConfig();
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    $('login-submit').disabled = false;
  }
}

async function verifyUser(userId) {
  try {
    await api(`/users/${userId}/verify`, { method: 'POST', body: '{}' });
    toast('User verified successfully');
    await loadUsers();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function resetPassword(userId, password) {
  await api(`/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  toast('Password reset successfully');
  closeModal('reset-modal');
  $('reset-password').value = '';
}

async function deleteUser(userId) {
  await api(`/users/${userId}`, { method: 'DELETE' });
  toast('User deleted');
  closeModal('delete-modal');
  await loadUsers();
}

function bindEvents() {
  $('login-form').addEventListener('submit', handleLogin);
  $('logout-btn').addEventListener('click', logout);

  $('push-save-btn').addEventListener('click', () => void savePushConfig());
  $('push-clear-btn').addEventListener('click', () => void clearPushConfig());
  $('push-test-btn').addEventListener('click', () => void sendTestPush());

  $('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.search = $('search-input').value.trim();
    state.page = 1;
    void loadUsers();
  });

  $('prev-page').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      void loadUsers();
    }
  });

  $('next-page').addEventListener('click', () => {
    if (state.page < state.pagination.totalPages) {
      state.page += 1;
      void loadUsers();
    }
  });

  $('users-body').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { action, id, name } = button.dataset;
    state.activeUser = { id, name };

    if (action === 'verify') {
      void verifyUser(id);
      return;
    }

    if (action === 'reset') {
      $('reset-user-name').textContent = name;
      $('reset-password').value = '';
      $('reset-error').textContent = '';
      openModal('reset-modal');
      return;
    }

    if (action === 'delete') {
      $('delete-user-name').textContent = name;
      openModal('delete-modal');
    }
  });

  $('reset-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('reset-password').value;
    const errorEl = $('reset-error');
    errorEl.textContent = '';

    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters';
      return;
    }

    $('reset-submit').disabled = true;
    try {
      await resetPassword(state.activeUser.id, password);
    } catch (error) {
      errorEl.textContent = error.message;
    } finally {
      $('reset-submit').disabled = false;
    }
  });

  $('delete-confirm').addEventListener('click', async () => {
    $('delete-confirm').disabled = true;
    try {
      await deleteUser(state.activeUser.id);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      $('delete-confirm').disabled = false;
    }
  });

  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.dataset.close));
  });
}

async function init() {
  bindEvents();

  if (getToken()) {
    showDashboard();
    try {
      await loadUsers();
      await loadPushConfig();
    } catch {
      logout();
    }
  } else {
    showLogin();
  }
}

void init();
