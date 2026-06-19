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
  reports: {
    page: 1,
    limit: 20,
    status: 'open',
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  },
  appeals: {
    page: 1,
    limit: 20,
    status: 'pending',
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  },
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

const PAGE_TITLES = {
  overview: 'Overview',
  users: 'Users',
  reports: 'Reports & abuse',
  appeals: 'Suspension appeals',
  content: 'App content & constants',
  settings: 'Settings',
};

function setActiveView(view) {
  if (!PAGE_TITLES[view]) {
    return;
  }
  document.querySelectorAll('[data-view-section]').forEach((el) => {
    el.classList.toggle('hidden', el.dataset.viewSection !== view);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const title = $('page-title');
  if (title) {
    title.textContent = PAGE_TITLES[view];
  }
  closeSidebar();
}

function openSidebar() {
  document.querySelector('.sidebar')?.classList.add('open');
  $('sidebar-scrim')?.classList.remove('hidden');
}

function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  $('sidebar-scrim')?.classList.add('hidden');
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
  setActiveView('overview');
}

function logout() {
  try {
    stopLive(true);
  } catch {
    // ignore
  }
  if (live.socket) {
    live.socket.disconnect();
    live.socket = null;
  }
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
        <td>${statusBadge(user)}${
          user.suspended ? ' <span class="badge badge-warning">Suspended</span>' : ''
        }${user.liveAudioEnabled ? ' <span class="badge badge-info">Live audio</span>' : ''}</td>
        <td>${registrationBadge(user.registrationStatus)}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" data-action="view" data-id="${user.id}" data-name="${escapeAttr(
              user.displayName,
            )}">View</button>
            ${
              user.emailVerified
                ? ''
                : `<button class="btn btn-secondary btn-sm" data-action="verify" data-id="${user.id}">Verify</button>`
            }
            ${
              user.suspended
                ? `<button class="btn btn-secondary btn-sm" data-action="unsuspend" data-id="${user.id}" data-name="${escapeAttr(
                    user.displayName,
                  )}">Reinstate</button>`
                : `<button class="btn btn-secondary btn-sm" data-action="suspend" data-id="${user.id}" data-name="${escapeAttr(
                    user.displayName,
                  )}">Suspend</button>`
            }
            <button class="btn btn-secondary btn-sm" data-action="live-toggle" data-id="${user.id}" data-enabled="${
              user.liveAudioEnabled ? '1' : '0'
            }" data-name="${escapeAttr(user.displayName)}">${
              user.liveAudioEnabled ? 'Disable live' : 'Enable live'
            }</button>
            ${
              user.liveAudioEnabled
                ? `<button class="btn btn-secondary btn-sm" data-action="live" data-id="${user.id}" data-name="${escapeAttr(
                    user.displayName,
                  )}">Listen live</button>`
                : ''
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

function setStat(id, value) {
  const el = $(id);
  if (el) el.textContent = String(value ?? 0);
}

async function loadStats() {
  try {
    const data = await api('/stats');
    setStat('stat-online', data.onlineUsers);
    setStat('stat-total', data.totalUsers);
    setStat('stat-posts', data.totalPosts);
    setStat('stat-verified', data.verifiedUsers);
    setStat('stat-new', data.newUsers7d);
    setStat('stat-comments', data.totalComments);
    setStat('stat-conversations', data.totalConversations);
    setStat('stat-reports', data.openReports);
    setStat('stat-appeals', data.pendingAppeals);
    setStat('stat-suspended', data.suspendedUsers);

    const reportsNav = $('reports-nav-count');
    if (reportsNav) {
      reportsNav.textContent = String(data.openReports);
      reportsNav.classList.toggle('hidden', data.openReports === 0);
    }
    const appealsNav = $('appeals-nav-count');
    if (appealsNav) {
      appealsNav.textContent = String(data.pendingAppeals);
      appealsNav.classList.toggle('hidden', data.pendingAppeals === 0);
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------- User detail overview ---------- */
function detailStatItem(label, value) {
  return `
    <div class="detail-stat">
      <div class="detail-stat-value">${value}</div>
      <div class="detail-stat-label">${escapeHtml(label)}</div>
    </div>`;
}

async function openUserDetail(userId, name) {
  openModal('user-modal');
  $('user-modal-sub').textContent = name ? `Overview for ${name}` : 'Profile and activity summary.';
  $('user-modal-body').innerHTML = '<div class="empty-state">Loading…</div>';

  try {
    const data = await api(`/users/${userId}`);
    const u = data.user;
    const s = data.stats;

    const badges = [
      u.online
        ? '<span class="badge badge-success">Online</span>'
        : '<span class="badge badge-muted">Offline</span>',
      u.emailVerified
        ? '<span class="badge badge-success">Verified</span>'
        : '<span class="badge badge-warning">Unverified</span>',
      u.suspended ? '<span class="badge badge-warning">Suspended</span>' : '',
      u.liveAudioEnabled ? '<span class="badge badge-info">Live audio</span>' : '',
    ]
      .filter(Boolean)
      .join(' ');

    $('user-modal-body').innerHTML = `
      <div class="detail-head">
        <div class="detail-identity">
          <div class="detail-name">${escapeHtml(u.displayName)}</div>
          <div class="user-email">${escapeHtml(u.email)}</div>
        </div>
        <div class="detail-badges">${badges}</div>
      </div>
      <div class="detail-grid">
        ${detailStatItem('Friends', s.friends)}
        ${detailStatItem('Pending in', s.pendingIncoming)}
        ${detailStatItem('Pending out', s.pendingOutgoing)}
        ${detailStatItem('Blocked', s.blocked)}
        ${detailStatItem('Blocked by', s.blockedBy)}
        ${detailStatItem('Restricted', s.restricted)}
        ${detailStatItem('Posts', s.posts)}
        ${detailStatItem('Comments', s.comments)}
        ${detailStatItem('Places visited', s.placeVisits)}
        ${detailStatItem('Conversations', s.conversations)}
      </div>
      <div class="detail-meta">
        <div><span class="detail-meta-label">Joined</span> ${formatDate(u.createdAt)}</div>
        <div><span class="detail-meta-label">Registration</span> ${escapeHtml(u.registrationStatus ?? '—')}</div>
        ${u.suspended && u.suspensionReason ? `<div><span class="detail-meta-label">Suspension reason</span> ${escapeHtml(u.suspensionReason)}</div>` : ''}
      </div>`;
  } catch (error) {
    $('user-modal-body').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

/* ---------- App content / constants ---------- */
let configEntries = [];

function renderConfigList() {
  const list = $('config-list');
  if (!configEntries.length) {
    list.innerHTML = '<div class="empty-state">No fields yet. Add one to get started.</div>';
    return;
  }
  list.innerHTML = configEntries
    .map(
      (entry, index) => `
      <div class="config-row" data-index="${index}">
        <input class="input config-key" type="text" placeholder="key" value="${escapeAttr(entry.key)}" data-index="${index}" />
        <textarea class="input config-value" rows="1" placeholder="value" data-index="${index}">${escapeHtml(entry.value)}</textarea>
        <button type="button" class="btn btn-destructive btn-sm config-remove" data-index="${index}" aria-label="Remove">✕</button>
      </div>`,
    )
    .join('');
}

async function loadAppConfig() {
  $('config-load').classList.remove('hidden');
  $('config-error').textContent = '';
  try {
    const data = await api('/app-config');
    configEntries = Object.entries(data.config ?? {}).map(([key, value]) => ({ key, value }));
    configEntries.sort((a, b) => a.key.localeCompare(b.key));
    renderConfigList();
    $('config-updated').textContent = data.updatedAt ? `Updated ${formatDate(data.updatedAt)}` : '';
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('config-load').classList.add('hidden');
  }
}

function syncConfigFromInputs() {
  document.querySelectorAll('#config-list .config-row').forEach((row) => {
    const index = Number(row.dataset.index);
    const keyEl = row.querySelector('.config-key');
    const valueEl = row.querySelector('.config-value');
    if (configEntries[index]) {
      configEntries[index].key = keyEl.value;
      configEntries[index].value = valueEl.value;
    }
  });
}

async function saveAppConfig() {
  syncConfigFromInputs();
  $('config-error').textContent = '';

  const config = {};
  for (const entry of configEntries) {
    const key = entry.key.trim();
    if (!key) continue;
    if (config[key] !== undefined) {
      $('config-error').textContent = `Duplicate key: ${key}`;
      return;
    }
    config[key] = entry.value;
  }

  $('config-save').disabled = true;
  try {
    const data = await api('/app-config', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
    configEntries = Object.entries(data.config ?? {}).map(([key, value]) => ({ key, value }));
    configEntries.sort((a, b) => a.key.localeCompare(b.key));
    renderConfigList();
    $('config-updated').textContent = data.updatedAt ? `Updated ${formatDate(data.updatedAt)}` : '';
    toast('App content saved');
  } catch (error) {
    $('config-error').textContent = error.message;
  } finally {
    $('config-save').disabled = false;
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

function renderPlacesStatus(config) {
  const badge = $('places-status-badge');
  const detail = $('places-status-detail');

  const proToggle = $('places-pro-fields');
  if (proToggle && typeof config.proFields === 'boolean') {
    proToggle.checked = config.proFields;
  }

  const providerSelect = $('places-provider-select');
  if (providerSelect && config.selectedProvider) {
    providerSelect.value = config.selectedProvider;
  }

  // Top status reflects the active provider.
  const active = config.provider || config.selectedProvider || 'sample';
  badge.className = active === 'sample' ? 'badge badge-warning' : 'badge badge-success';
  badge.textContent = `Active: ${active}`;
  detail.textContent =
    active === 'sample'
      ? 'No usable key for the selected provider — using sample data.'
      : `Serving places via ${active}.`;

  // Foursquare card detail (legacy top-level fields).
  const fsqBadge = $('places-fsq-badge');
  const fsqDetail = $('places-fsq-detail');
  if (fsqBadge && fsqDetail) {
    if (config.configured) {
      fsqBadge.className = 'badge badge-success';
      fsqBadge.textContent = 'Key saved';
      const parts = [];
      if (config.maskedKey) parts.push(`key: ${config.maskedKey}`);
      if (config.source) parts.push(`source: ${config.source}`);
      parts.push(config.proFields ? 'photos/ratings on' : 'photos/ratings off (free tier)');
      if (config.updatedAt) parts.push(`updated ${formatDate(config.updatedAt)}`);
      fsqDetail.textContent = parts.join(' · ');
    } else {
      fsqBadge.className = 'badge badge-muted';
      fsqBadge.textContent = 'No key';
      fsqDetail.textContent = 'Add a Foursquare service key to use this provider.';
    }
  }

  // Google card detail.
  const google = config.google || {};
  const gBadge = $('google-status-badge');
  const gDetail = $('google-status-detail');
  if (gBadge && gDetail) {
    if (google.configured) {
      gBadge.className = 'badge badge-success';
      gBadge.textContent = 'Key saved';
      const parts = [];
      if (google.maskedKey) parts.push(`key: ${google.maskedKey}`);
      if (google.source) parts.push(`source: ${google.source}`);
      if (google.updatedAt) parts.push(`updated ${formatDate(google.updatedAt)}`);
      gDetail.textContent = parts.join(' · ');
    } else {
      gBadge.className = 'badge badge-muted';
      gBadge.textContent = 'No key';
      gDetail.textContent = 'Add a Google Places API key to use this provider.';
    }
  }
}

async function setPlacesProvider(provider) {
  const select = $('places-provider-select');
  if (select) select.disabled = true;
  try {
    const config = await api('/places-config/provider', {
      method: 'PUT',
      body: JSON.stringify({ provider }),
    });
    renderPlacesStatus(config);
    toast(`Provider set to ${provider}`);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (select) select.disabled = false;
  }
}

async function saveGooglePlacesConfig() {
  const errorEl = $('google-config-error');
  errorEl.textContent = '';
  const apiKey = $('google-api-key').value.trim();

  if (!apiKey) {
    errorEl.textContent = 'Paste your Google Places API key first.';
    return;
  }

  $('google-save-btn').disabled = true;
  try {
    const config = await api('/places-config/google', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
    renderPlacesStatus(config);
    $('google-api-key').value = '';
    toast('Google Places key saved');
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    $('google-save-btn').disabled = false;
  }
}

async function clearGooglePlacesConfig() {
  $('google-clear-btn').disabled = true;
  try {
    const config = await api('/places-config/google', { method: 'DELETE' });
    renderPlacesStatus(config);
    toast('Google Places key removed');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('google-clear-btn').disabled = false;
  }
}

async function loadPlacesConfig() {
  try {
    const config = await api('/places-config');
    renderPlacesStatus(config);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function savePlacesConfig() {
  const errorEl = $('places-config-error');
  errorEl.textContent = '';
  const apiKey = $('places-api-key').value.trim();

  if (!apiKey) {
    errorEl.textContent = 'Paste your Foursquare API key first.';
    return;
  }

  $('places-save-btn').disabled = true;
  try {
    const config = await api('/places-config', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
    renderPlacesStatus(config);
    $('places-api-key').value = '';
    toast('Foursquare key saved');
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    $('places-save-btn').disabled = false;
  }
}

async function clearPlacesConfig() {
  $('places-clear-btn').disabled = true;
  try {
    const config = await api('/places-config', { method: 'DELETE' });
    renderPlacesStatus(config);
    toast('Foursquare key removed');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('places-clear-btn').disabled = false;
  }
}

async function setPlacesProFields(enabled) {
  const toggle = $('places-pro-fields');
  if (toggle) toggle.disabled = true;
  try {
    const config = await api('/places-config/pro-fields', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    renderPlacesStatus(config);
    toast(enabled ? 'Photos & ratings enabled' : 'Photos & ratings disabled');
  } catch (error) {
    if (toggle) toggle.checked = !enabled;
    toast(error.message, 'error');
  } finally {
    if (toggle) toggle.disabled = false;
  }
}

function reportStatusBadge(status) {
  const cls =
    status === 'open' ? 'badge-warning' : status === 'reviewed' ? 'badge-success' : 'badge-muted';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function appealStatusBadge(status) {
  const cls =
    status === 'pending' ? 'badge-warning' : status === 'approved' ? 'badge-success' : 'badge-muted';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function renderReports() {
  const tbody = $('reports-body');
  const { items, pagination } = state.reports;

  if (!items.length) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">No reports found.</div></td></tr>';
  } else {
    tbody.innerHTML = items
      .map((report) => {
        const reported = report.reportedUser;
        const reporter = report.reporter;
        const reportedName = reported ? `${escapeHtml(reported.name)}<br /><span class="user-email">${escapeHtml(reported.email)}</span>` : '—';
        const reporterName = reporter ? `${escapeHtml(reporter.name)}<br /><span class="user-email">${escapeHtml(reporter.email)}</span>` : '—';
        const suspendBtn =
          reported && !reported.suspended
            ? `<button class="btn btn-destructive btn-sm" data-report-action="suspend" data-id="${reported.id}" data-name="${escapeAttr(reported.name)}">Suspend user</button>`
            : reported && reported.suspended
              ? '<span class="badge badge-warning">User suspended</span>'
              : '';
        return `
      <tr>
        <td><div class="user-cell">${reportedName}</div></td>
        <td><div class="user-cell">${reporterName}</div></td>
        <td>${escapeHtml(report.reason)}</td>
        <td>${reportStatusBadge(report.status)}</td>
        <td>${formatDate(report.createdAt)}</td>
        <td>
          <div class="actions">
            ${suspendBtn}
            ${report.status !== 'reviewed' ? `<button class="btn btn-secondary btn-sm" data-report-action="reviewed" data-id="${report.id}">Mark reviewed</button>` : ''}
            ${report.status !== 'dismissed' ? `<button class="btn btn-secondary btn-sm" data-report-action="dismissed" data-id="${report.id}">Dismiss</button>` : ''}
          </div>
        </td>
      </tr>`;
      })
      .join('');
  }

  $('reports-page-info').textContent = `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} reports`;
  $('reports-prev').disabled = pagination.page <= 1;
  $('reports-next').disabled = pagination.page >= pagination.totalPages;

  // The "open" filter total is the actionable backlog shown in the sidebar.
  if (state.reports.status === 'open') {
    const count = pagination.total;
    const statEl = $('stat-reports');
    if (statEl) statEl.textContent = String(count);
    const navEl = $('reports-nav-count');
    if (navEl) {
      navEl.textContent = String(count);
      navEl.classList.toggle('hidden', count === 0);
    }
  }
}

async function loadReports() {
  $('reports-load').classList.remove('hidden');
  try {
    const params = new URLSearchParams({
      page: String(state.reports.page),
      limit: String(state.reports.limit),
      status: state.reports.status,
    });
    const data = await api(`/reports?${params.toString()}`);
    state.reports.items = data.reports;
    state.reports.pagination = data.pagination;
    renderReports();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('reports-load').classList.add('hidden');
  }
}

async function updateReportStatus(reportId, status) {
  try {
    await api(`/reports/${reportId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    toast(`Report marked ${status}`);
    await loadReports();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderAppeals() {
  const tbody = $('appeals-body');
  const { items, pagination } = state.appeals;

  if (!items.length) {
    tbody.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">No appeals found.</div></td></tr>';
  } else {
    tbody.innerHTML = items
      .map((appeal) => {
        const user = appeal.user;
        const userName = user ? `${escapeHtml(user.name)}<br /><span class="user-email">${escapeHtml(user.email)}</span>` : '—';
        const actions =
          appeal.status === 'pending'
            ? `<button class="btn btn-secondary btn-sm" data-appeal-action="approve" data-id="${appeal.id}">Approve &amp; reinstate</button>
               <button class="btn btn-destructive btn-sm" data-appeal-action="reject" data-id="${appeal.id}">Reject</button>`
            : '';
        return `
      <tr>
        <td><div class="user-cell">${userName}</div></td>
        <td>${escapeHtml(appeal.message)}</td>
        <td>${appealStatusBadge(appeal.status)}</td>
        <td>${formatDate(appeal.createdAt)}</td>
        <td><div class="actions">${actions}</div></td>
      </tr>`;
      })
      .join('');
  }

  $('appeals-page-info').textContent = `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} appeals`;
  $('appeals-prev').disabled = pagination.page <= 1;
  $('appeals-next').disabled = pagination.page >= pagination.totalPages;

  if (state.appeals.status === 'pending') {
    const count = pagination.total;
    const statEl = $('stat-appeals');
    if (statEl) statEl.textContent = String(count);
    const navEl = $('appeals-nav-count');
    if (navEl) {
      navEl.textContent = String(count);
      navEl.classList.toggle('hidden', count === 0);
    }
  }
}

async function loadAppeals() {
  $('appeals-load').classList.remove('hidden');
  try {
    const params = new URLSearchParams({
      page: String(state.appeals.page),
      limit: String(state.appeals.limit),
      status: state.appeals.status,
    });
    const data = await api(`/appeals?${params.toString()}`);
    state.appeals.items = data.appeals;
    state.appeals.pagination = data.pagination;
    renderAppeals();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    $('appeals-load').classList.add('hidden');
  }
}

async function reviewAppeal(appealId, decision) {
  try {
    await api(`/appeals/${appealId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    toast(decision === 'approve' ? 'Appeal approved, user reinstated' : 'Appeal rejected');
    await Promise.all([loadAppeals(), loadUsers()]);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function suspendUser(userId, reason) {
  await api(`/users/${userId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  toast('User suspended');
  closeModal('suspend-modal');
  $('suspend-reason').value = '';
  await Promise.all([loadUsers(), loadReports(), loadStats()]);
}

async function unsuspendUser(userId) {
  try {
    await api(`/users/${userId}/unsuspend`, { method: 'POST', body: '{}' });
    toast('User reinstated');
    await Promise.all([loadUsers(), loadStats()]);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function toggleLiveAudio(userId, enable) {
  try {
    await api(`/users/${userId}/live-audio`, {
      method: 'POST',
      body: JSON.stringify({ enabled: enable }),
    });
    toast(enable ? 'Live audio enabled for user' : 'Live audio disabled for user');
    await loadUsers();
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------- Live audio (consent-based) ---------- */
const live = {
  socket: null,
  pc: null,
  sessionId: null,
  userId: null,
  pendingCandidates: [],
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  bound: false,
};

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function setLiveStatus(text) {
  const el = $('live-status');
  if (el) el.textContent = text;
}

async function loadIceServers() {
  try {
    const data = await api('/ice-servers');
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      live.iceServers = data.iceServers;
    }
  } catch {
    // fall back to the default STUN server
  }
}

function ensureLiveSocket() {
  if (live.socket && live.socket.connected) {
    return live.socket;
  }
  if (typeof io === 'undefined') {
    toast('Realtime library failed to load', 'error');
    return null;
  }
  if (!live.socket) {
    live.socket = io({ path: '/socket.io', auth: { token: getToken() }, transports: ['websocket'] });
    bindLiveSocket(live.socket);
  } else {
    live.socket.auth = { token: getToken() };
    live.socket.connect();
  }
  return live.socket;
}

function bindLiveSocket(socket) {
  socket.on('live:accepted', (payload) => {
    if (payload.sessionId === live.sessionId) {
      setLiveStatus('Accepted · connecting…');
    }
  });

  socket.on('live:rejected', (payload) => {
    if (payload.sessionId === live.sessionId) {
      toast(
        payload.reason === 'not_enabled'
          ? 'Live audio is not enabled for this user'
          : 'User declined the live audio request',
        'error',
      );
      stopLive(false);
    }
  });

  socket.on('live:ended', (payload) => {
    if (!payload.sessionId || payload.sessionId === live.sessionId) {
      stopLive(false);
    }
  });

  socket.on('webrtc:offer', async (payload) => {
    if (payload.callId !== live.sessionId || !payload.sdp) {
      return;
    }
    try {
      const pc = new RTCPeerConnection({ iceServers: live.iceServers });
      live.pc = pc;

      pc.ontrack = (event) => {
        const audio = $('live-audio');
        if (audio && event.streams && event.streams[0]) {
          audio.srcObject = event.streams[0];
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          live.socket.emit('webrtc:ice-candidate', {
            toUserId: live.userId,
            callId: live.sessionId,
            candidate: event.candidate,
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setLiveStatus('Live · listening');
          $('live-meter-fill')?.classList.add('active');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          stopLive(false);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      for (const candidate of live.pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // ignore
        }
      }
      live.pendingCandidates = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      live.socket.emit('webrtc:answer', {
        toUserId: live.userId,
        callId: live.sessionId,
        sdp: answer,
      });
    } catch {
      toast('Failed to establish live audio', 'error');
      stopLive(true);
    }
  });

  socket.on('webrtc:ice-candidate', async (payload) => {
    if (payload.callId !== live.sessionId || !payload.candidate) {
      return;
    }
    if (live.pc && live.pc.remoteDescription) {
      try {
        await live.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // ignore
      }
    } else {
      live.pendingCandidates.push(payload.candidate);
    }
  });
}

async function startLive(userId, name) {
  if (live.sessionId) {
    toast('Already in a live session', 'error');
    return;
  }
  const socket = ensureLiveSocket();
  if (!socket) {
    return;
  }
  await loadIceServers();

  live.sessionId = randomId();
  live.userId = userId;
  live.pendingCandidates = [];

  $('live-user').textContent = name;
  setLiveStatus('Requesting consent…');
  $('live-meter-fill')?.classList.remove('active');
  $('live-panel').classList.remove('hidden');

  const sendRequest = () =>
    socket.emit('live:request', { toUserId: userId, sessionId: live.sessionId, admin: { panel: true } });

  if (socket.connected) {
    sendRequest();
  } else {
    socket.once('connect', sendRequest);
  }
}

function stopLive(notifyUser = true) {
  if (notifyUser && live.socket && live.sessionId && live.userId) {
    live.socket.emit('live:end', { toUserId: live.userId, sessionId: live.sessionId });
  }
  if (live.pc) {
    try {
      live.pc.close();
    } catch {
      // ignore
    }
    live.pc = null;
  }
  const audio = $('live-audio');
  if (audio) {
    audio.srcObject = null;
  }
  live.sessionId = null;
  live.userId = null;
  live.pendingCandidates = [];
  $('live-panel').classList.add('hidden');
  $('live-meter-fill')?.classList.remove('active');
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
    await loadStats();
    await loadUsers();
    await loadPushConfig();
    await loadPlacesConfig();
    await loadReports();
    await loadAppeals();
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
  await Promise.all([loadUsers(), loadStats()]);
}

function bindEvents() {
  $('login-form').addEventListener('submit', handleLogin);
  $('logout-btn').addEventListener('click', logout);

  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', () => {
      const view = el.dataset.view;
      setActiveView(view);
      if (view === 'overview') {
        void loadStats();
      } else if (view === 'content') {
        void loadAppConfig();
      }
    });
  });

  $('sidebar-toggle')?.addEventListener('click', openSidebar);
  $('sidebar-scrim')?.addEventListener('click', closeSidebar);
  $('live-close')?.addEventListener('click', () => stopLive(true));

  $('push-save-btn').addEventListener('click', () => void savePushConfig());
  $('push-clear-btn').addEventListener('click', () => void clearPushConfig());
  $('push-test-btn').addEventListener('click', () => void sendTestPush());

  $('places-save-btn')?.addEventListener('click', () => void savePlacesConfig());
  $('places-clear-btn')?.addEventListener('click', () => void clearPlacesConfig());
  $('places-pro-fields')?.addEventListener('change', (event) =>
    void setPlacesProFields(event.target.checked),
  );
  $('places-provider-select')?.addEventListener('change', (event) =>
    void setPlacesProvider(event.target.value),
  );
  $('google-save-btn')?.addEventListener('click', () => void saveGooglePlacesConfig());
  $('google-clear-btn')?.addEventListener('click', () => void clearGooglePlacesConfig());

  $('config-add')?.addEventListener('click', () => {
    syncConfigFromInputs();
    configEntries.push({ key: '', value: '' });
    renderConfigList();
  });
  $('config-save')?.addEventListener('click', () => void saveAppConfig());
  $('config-reload')?.addEventListener('click', () => void loadAppConfig());
  $('config-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('button.config-remove');
    if (!button) return;
    syncConfigFromInputs();
    configEntries.splice(Number(button.dataset.index), 1);
    renderConfigList();
  });

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

    if (action === 'view') {
      void openUserDetail(id, name);
      return;
    }

    if (action === 'verify') {
      void verifyUser(id);
      return;
    }

    if (action === 'suspend') {
      $('suspend-user-name').textContent = name;
      $('suspend-reason').value = '';
      $('suspend-error').textContent = '';
      openModal('suspend-modal');
      return;
    }

    if (action === 'unsuspend') {
      void unsuspendUser(id);
      return;
    }

    if (action === 'live-toggle') {
      const enable = button.dataset.enabled !== '1';
      void toggleLiveAudio(id, enable);
      return;
    }

    if (action === 'live') {
      void startLive(id, name);
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

  $('reports-filter').addEventListener('change', () => {
    state.reports.status = $('reports-filter').value;
    state.reports.page = 1;
    void loadReports();
  });

  $('reports-prev').addEventListener('click', () => {
    if (state.reports.page > 1) {
      state.reports.page -= 1;
      void loadReports();
    }
  });

  $('reports-next').addEventListener('click', () => {
    if (state.reports.page < state.reports.pagination.totalPages) {
      state.reports.page += 1;
      void loadReports();
    }
  });

  $('reports-body').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-report-action]');
    if (!button) return;
    const { reportAction, id, name } = button.dataset;

    if (reportAction === 'suspend') {
      state.activeUser = { id, name };
      $('suspend-user-name').textContent = name;
      $('suspend-reason').value = '';
      $('suspend-error').textContent = '';
      openModal('suspend-modal');
      return;
    }

    void updateReportStatus(id, reportAction);
  });

  $('appeals-filter').addEventListener('change', () => {
    state.appeals.status = $('appeals-filter').value;
    state.appeals.page = 1;
    void loadAppeals();
  });

  $('appeals-prev').addEventListener('click', () => {
    if (state.appeals.page > 1) {
      state.appeals.page -= 1;
      void loadAppeals();
    }
  });

  $('appeals-next').addEventListener('click', () => {
    if (state.appeals.page < state.appeals.pagination.totalPages) {
      state.appeals.page += 1;
      void loadAppeals();
    }
  });

  $('appeals-body').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-appeal-action]');
    if (!button) return;
    const { appealAction, id } = button.dataset;
    void reviewAppeal(id, appealAction);
  });

  $('suspend-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const reason = $('suspend-reason').value.trim();
    $('suspend-error').textContent = '';
    $('suspend-submit').disabled = true;
    try {
      await suspendUser(state.activeUser.id, reason);
    } catch (error) {
      $('suspend-error').textContent = error.message;
    } finally {
      $('suspend-submit').disabled = false;
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
      await loadStats();
      await loadUsers();
      await loadPushConfig();
      await loadPlacesConfig();
      await loadReports();
      await loadAppeals();
    } catch {
      logout();
    }
  } else {
    showLogin();
  }
}

void init();
