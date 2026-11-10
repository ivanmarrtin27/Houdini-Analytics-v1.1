const API_BASE = 'https://houdini-bet.ivanmarrtin2703.workers.dev';
const SECRET_KEY = 'hb_admin_sync_secret';

const gateEl = document.getElementById('gate');
const entryEl = document.getElementById('entry');
const appEl = document.getElementById('app');
const gateForm = document.getElementById('gate-form');
const pinInput = document.getElementById('pin');
const gateSubmit = document.getElementById('gate-submit');
const gateError = document.getElementById('gate-error');
const usagePanel = document.getElementById('usage-panel');
const hitsPanel = document.getElementById('hits-panel');
const hitsMeta = document.getElementById('hits-meta');
const hitsFullPanel = document.getElementById('hits-full-panel');
const hitsFullCount = document.getElementById('hits-full-count');
const hitsSearch = document.getElementById('hits-search');
const statsPanel = document.getElementById('stats-panel');
const statsMeta = document.getElementById('stats-meta');
const usersBody = document.getElementById('users-body');
const usersCards = document.getElementById('users-cards');
const usersCount = document.getElementById('users-count');
const usersSearch = document.getElementById('users-search');
const toastEl = document.getElementById('toast');
const mainEl = document.getElementById('main');
const screenHome = document.getElementById('screen-home');
const screenHits = document.getElementById('screen-hits');
const screenStats = document.getElementById('screen-stats');
const deleteModal = document.getElementById('delete-modal');
const deleteModalBody = document.getElementById('delete-modal-body');
const deleteConfirmBtn = document.getElementById('delete-confirm');
const revokePremModal = document.getElementById('revoke-premium-modal');
const revokePremBody = document.getElementById('revoke-premium-body');
const revokePremSanction = document.getElementById('revoke-premium-sanction');
const revokePremConfirmBtn = document.getElementById('revoke-premium-confirm');
const promoForm = document.getElementById('promo-form');
const promoList = document.getElementById('promo-list');
const promoMeta = document.getElementById('promo-meta');

/** @type {Array<Record<string, unknown>>} */
let allUsers = [];
let usersQuery = '';
/** @type {Array<Record<string, unknown>>} */
let allHits = [];
let hitsQuery = '';
let hitsUniqueToday = 0;
/** @type {{ id: string, label: string } | null} */
let pendingDelete = null;
/** @type {{ id: string, label: string } | null} */
let pendingRevokePremium = null;

const HITS_PREVIEW = 3;
const HITS_HISTORY_LIMIT = 500;

function getSecret() {
  try {
    return sessionStorage.getItem(SECRET_KEY) || '';
  } catch {
    return '';
  }
}

function setSecret(secret) {
  try {
    if (secret) sessionStorage.setItem(SECRET_KEY, secret);
    else sessionStorage.removeItem(SECRET_KEY);
  } catch {
    /* ignore */
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const raw = String(iso).trim();
  if (!raw) return '—';
  const parsed = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return raw.length >= 16 ? raw.slice(0, 16).replace('T', ' ') : raw;
  }
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(parsed)
      .replace(',', '');
  } catch (_) {
    return raw.length >= 16 ? raw.slice(0, 16).replace('T', ' ') : raw;
  }
}

function preferReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showGateError(msg) {
  gateError.hidden = false;
  gateError.classList.add('field-helper--error');
  gateError.textContent = msg;
}

function clearGateError() {
  gateError.hidden = true;
  gateError.textContent = '';
}

function showToast(message, kind = 'ok') {
  toastEl.hidden = false;
  toastEl.className = `toast toast--${kind}`;
  toastEl.textContent = message;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 3200);
}

async function adminFetch(path, { method = 'GET', secret, body } = {}) {
  const key = secret != null ? secret : getSecret();
  if (!key) throw new Error('Sin PIN');
  const headers = { 'x-sync-secret': key };
  if (body != null) headers['content-type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? body : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function validatePin(pin) {
  await adminFetch('/api/v1/admin/users', { secret: pin });
}

function usageVisitsBlock(visits) {
  if (!visits || visits.configured === false) {
    return `
      <div class="usage-card usage-card--visits">
        <p class="usage-card__label">Visitas</p>
        <p class="usage-card__note"><strong>No configuradas</strong></p>
        <p class="usage-card__meta">Web Analytics / site tag pendiente.</p>
      </div>`;
  }
  if (visits.error) {
    return `
      <div class="usage-card usage-card--visits">
        <p class="usage-card__label">Visitas</p>
        <p class="usage-card__note"><strong>Error</strong></p>
        <p class="usage-card__meta">${escapeHtml(visits.error)}</p>
      </div>`;
  }
  const v = Number(visits.visits) || 0;
  const pv = Number(visits.pageViews) || 0;
  return `
    <div class="usage-card usage-card--visits">
      <p class="usage-card__label">Visitas</p>
      <p class="usage-card__metric">${v.toLocaleString('es-ES')}</p>
      <p class="usage-card__meta">page views ${pv.toLocaleString('es-ES')} · hoy UTC ${escapeHtml(visits.day || '')}</p>
    </div>`;
}

function usageLoginsBlock(data) {
  const logins = Number(data?.loginsToday) || 0;
  const day = escapeHtml(data?.day || '');
  return `
    <div class="usage-card usage-card--logins">
      <p class="usage-card__label">Inicios de sesión</p>
      <p class="usage-card__metric">${logins.toLocaleString('es-ES')}</p>
      <p class="usage-card__meta">hoy UTC${day ? ` · ${day}` : ''}</p>
    </div>`;
}

function usageWorkerBlock(data) {
  if (!data || data.configured === false) {
    return `
      <div class="usage-card">
        <p class="usage-card__label">Consultas Worker</p>
        <p class="usage-card__note"><strong>Métricas CF no configuradas</strong></p>
      </div>`;
  }
  if (data.error) {
    return `
      <div class="usage-card">
        <p class="usage-card__label">Consultas Worker</p>
        <p class="usage-card__note"><strong>Error</strong></p>
        <p class="usage-card__meta">${escapeHtml(data.error)}</p>
      </div>`;
  }
  const n = Number(data.requests) || 0;
  const errors = Number(data.errors) || 0;
  return `
    <div class="usage-card">
      <p class="usage-card__label">Consultas Worker</p>
      <p class="usage-card__metric">${n.toLocaleString('es-ES')}</p>
      <p class="usage-card__meta"><code>${escapeHtml(data.scriptName || 'houdini-bet')}</code> · hoy UTC ${escapeHtml(data.day || '')}</p>
      <p class="usage-card__meta">Errores: ${errors.toLocaleString('es-ES')}</p>
    </div>`;
}

function renderUsage(data, visits) {
  usagePanel.innerHTML = `
    <div class="usage-grid">
      ${usageVisitsBlock(visits)}
      ${usageLoginsBlock(data || {})}
      ${usageWorkerBlock(data)}
    </div>`;
}

function hitDeviceLabel(h) {
  const device = String(h.device || '').trim();
  if (device) return device;
  const ua = String(h.ua || '');
  if (!ua) return 'Desconocido';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'Mac';
  return 'Otro';
}

function hitSearchBlob(h) {
  return [h.ip, h.path, h.country, hitDeviceLabel(h), h.ua, h.host, formatDate(h.created_at)]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
}

function filteredHits() {
  const q = String(hitsQuery || '')
    .trim()
    .toLowerCase();
  if (!q) return allHits;
  return allHits.filter((h) => hitSearchBlob(h).includes(q));
}

function hitRowHtml(h) {
  const ts = escapeHtml(formatDate(h.created_at));
  const ip = escapeHtml(h.ip || '—');
  const country = escapeHtml(h.country || '—');
  const path = escapeHtml(h.path || '/');
  const device = escapeHtml(hitDeviceLabel(h));
  return `<tr>
    <td>${ts}</td>
    <td><code>${ip}</code></td>
    <td>${country}</td>
    <td class="hits-path"><code>${path}</code></td>
    <td>${device}</td>
  </tr>`;
}

function hitCardHtml(h) {
  const ts = escapeHtml(formatDate(h.created_at));
  const ip = escapeHtml(h.ip || '—');
  const country = escapeHtml(h.country || '—');
  const path = escapeHtml(h.path || '/');
  const device = escapeHtml(hitDeviceLabel(h));
  return `<article class="hit-card">
    <header class="hit-card__head">
      <code>${ip}</code>
      <span class="badge badge--ok">${country}</span>
    </header>
    <p class="hit-card__path"><code>${path}</code></p>
    <p class="hit-card__meta muted">${device} · ${ts}</p>
  </article>`;
}

function hitsTableBlock(hits) {
  const rows = hits.map(hitRowHtml).join('');
  const cards = hits.map(hitCardHtml).join('');
  return `
    <div class="table-wrap hits-desktop">
      <table class="hits-table">
        <thead>
          <tr>
            <th>Hora UTC</th>
            <th>IP</th>
            <th>País</th>
            <th>Path</th>
            <th>Dispositivo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="hits-cards">${cards}</div>`;
}

function renderHitsPreview() {
  if (!hitsPanel) return;
  if (hitsMeta) {
    hitsMeta.textContent = `${hitsUniqueToday.toLocaleString('es-ES')} IP única${
      hitsUniqueToday === 1 ? '' : 's'
    } hoy UTC`;
  }
  const preview = allHits.slice(0, HITS_PREVIEW);
  if (!preview.length) {
    hitsPanel.innerHTML = '<p class="muted">Sin hits aún.</p>';
    return;
  }
  hitsPanel.innerHTML = hitsTableBlock(preview);
}

function renderHitsFull() {
  if (!hitsFullPanel) return;
  const list = filteredHits();
  const total = allHits.length;
  if (hitsFullCount) {
    if (!total) hitsFullCount.textContent = '';
    else if (hitsQuery.trim()) hitsFullCount.textContent = `${list.length} / ${total}`;
    else hitsFullCount.textContent = `${total} hit${total === 1 ? '' : 's'}`;
  }
  if (!total) {
    hitsFullPanel.innerHTML = '<p class="muted">Sin hits aún.</p>';
    return;
  }
  if (!list.length) {
    hitsFullPanel.innerHTML = '<p class="muted">Ninguna coincidencia</p>';
    return;
  }
  hitsFullPanel.innerHTML = hitsTableBlock(list);
}

function setAdminScreen(name) {
  const screen = name === 'hits' || name === 'stats' ? name : 'home';
  if (mainEl) mainEl.dataset.screen = screen;
  if (screenHome) screenHome.hidden = screen !== 'home';
  if (screenHits) screenHits.hidden = screen !== 'hits';
  if (screenStats) screenStats.hidden = screen !== 'stats';

  if (screen === 'hits') {
    if (location.hash !== '#hits') history.replaceState(null, '', '#hits');
    renderHitsFull();
  } else if (screen === 'stats') {
    if (location.hash !== '#stats') history.replaceState(null, '', '#stats');
    loadStats().catch(() => {});
  } else if (location.hash === '#hits' || location.hash === '#stats') {
    history.replaceState(null, '', '#');
  }
}

function openDeleteModal({ id, label }) {
  pendingDelete = { id, label };
  if (deleteModalBody) {
    deleteModalBody.textContent = `¿Eliminar permanentemente la cuenta «${label}»? No se puede deshacer.`;
  }
  if (deleteModal) {
    deleteModal.hidden = false;
    try {
      deleteConfirmBtn?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }
}

function closeDeleteModal() {
  pendingDelete = null;
  if (deleteModal) deleteModal.hidden = true;
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const { id } = pendingDelete;
  deleteConfirmBtn.disabled = true;
  try {
    await adminFetch(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    closeDeleteModal();
    showToast('Cuenta eliminada', 'ok');
    await loadDashboard();
  } catch (err) {
    showToast(err.message || 'Error al eliminar', 'error');
  } finally {
    deleteConfirmBtn.disabled = false;
  }
}

async function loadStats() {
  if (typeof window.AdminPublicStats?.load === 'function') {
    await window.AdminPublicStats.load();
  }
}

function userActionButtons(u) {
  const id = escapeHtml(u.id);
  const confirmToken = escapeHtml(u.username || u.id);
  const disabled = Boolean(u.disabled);
  const isPrem = u.plan === 'premium' || u.premium;
  const toggle = disabled
    ? `<button type="button" class="btn btn--secondary btn--action" data-enable="${id}">Reactivar</button>`
    : `<button type="button" class="btn btn--ghost btn--action" data-revoke="${id}">Cerrar acceso</button>`;
  const premiumBtn = isPrem
    ? `<button type="button" class="btn btn--ghost btn--action" data-premium-revoke="${id}" data-label="${confirmToken}">Quitar Premium</button>`
    : `<button type="button" class="btn btn--secondary btn--action" data-premium-grant="${id}">Activar Premium</button>`;
  return `${premiumBtn}
    ${toggle}
    <button type="button" class="btn btn--destructive btn--action" data-delete="${id}" data-confirm="${confirmToken}">Eliminar</button>`;
}

function openRevokePremiumModal({ id, label }) {
  pendingRevokePremium = { id, label };
  if (revokePremBody) {
    revokePremBody.textContent = `¿Quitar Premium a «${label}»? El acceso a la cuenta sigue activo.`;
  }
  if (revokePremSanction) revokePremSanction.checked = false;
  if (revokePremModal) {
    revokePremModal.hidden = false;
    try {
      revokePremConfirmBtn?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }
}

function closeRevokePremiumModal() {
  pendingRevokePremium = null;
  if (revokePremModal) revokePremModal.hidden = true;
  if (revokePremSanction) revokePremSanction.checked = false;
}

async function confirmRevokePremium() {
  if (!pendingRevokePremium) return;
  const { id } = pendingRevokePremium;
  const sanction = Boolean(revokePremSanction?.checked);
  revokePremConfirmBtn.disabled = true;
  try {
    await adminFetch('/api/v1/admin/premium/revoke', {
      method: 'POST',
      body: JSON.stringify({ userId: id, sanction }),
    });
    closeRevokePremiumModal();
    showToast(sanction ? 'Premium quitado · sanción marcada' : 'Premium quitado', 'ok');
    await loadDashboard();
  } catch (err) {
    showToast(err.message || 'Error al quitar Premium', 'error');
  } finally {
    revokePremConfirmBtn.disabled = false;
  }
}

async function grantPremiumForUser(userId) {
  await adminFetch('/api/v1/admin/premium/grant', {
    method: 'POST',
    body: JSON.stringify({ userId, days: 30 }),
  });
}

function premiumPlanLabel(u) {
  return u.plan === 'premium' || u.premium ? 'Premium' : 'Gratuito';
}

function premiumMetaHtml(u) {
  const isPrem = u.plan === 'premium' || u.premium;
  if (!isPrem) return '<span class="muted">—</span>';
  const started = u.premiumStartedAt ? formatDate(u.premiumStartedAt) : '—';
  const until = u.premiumUntil ? formatDate(u.premiumUntil) : '—';
  const days =
    u.premiumDaysLeft != null && Number.isFinite(Number(u.premiumDaysLeft))
      ? `${Number(u.premiumDaysLeft)} d`
      : '—';
  return `<div class="premium-meta">
    <span>Alta ${escapeHtml(started)}</span>
    <span>Hasta ${escapeHtml(until)}</span>
    <span>${escapeHtml(days)}</span>
  </div>`;
}

function premiumBadge(u) {
  const isPrem = u.plan === 'premium' || u.premium;
  return isPrem
    ? '<span class="badge badge--premium">Premium</span>'
    : '<span class="badge badge--free">Gratuito</span>';
}

function userSearchBlob(u) {
  const disabled = Boolean(u.disabled);
  return [
    u.username,
    u.name,
    u.email,
    u.phone,
    disabled ? 'deshabilitado' : 'activo',
    premiumPlanLabel(u),
    formatDate(u.created_at),
    u.id,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
}

function filteredUsers() {
  const q = String(usersQuery || '')
    .trim()
    .toLowerCase();
  if (!q) return allUsers;
  return allUsers.filter((u) => userSearchBlob(u).includes(q));
}

function renderUsers() {
  const list = filteredUsers();
  const total = allUsers.length;
  if (usersCount) {
    if (!total) usersCount.textContent = '';
    else if (usersQuery.trim()) usersCount.textContent = `${list.length} / ${total}`;
    else usersCount.textContent = `${total} cuenta${total === 1 ? '' : 's'}`;
  }
  if (!total) {
    usersBody.innerHTML = '<tr><td colspan="9" class="muted">Sin cuentas</td></tr>';
    if (usersCards) usersCards.innerHTML = '<p class="muted users-cards__empty">Sin cuentas</p>';
    return;
  }
  if (!list.length) {
    usersBody.innerHTML = '<tr><td colspan="9" class="muted">Ninguna coincidencia</td></tr>';
    if (usersCards) usersCards.innerHTML = '<p class="muted users-cards__empty">Ninguna coincidencia</p>';
    return;
  }
  usersBody.innerHTML = list
    .map((u) => {
      const handle = escapeHtml(u.username || '—');
      const disabled = Boolean(u.disabled);
      const status = disabled
        ? '<span class="badge badge--off">Deshabilitado</span>'
        : '<span class="badge badge--ok">Activo</span>';
      return `<tr>
        <td><code>${handle}</code></td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone || '—')}</td>
        <td>${escapeHtml(formatDate(u.created_at))}</td>
        <td>${premiumBadge(u)}</td>
        <td>${premiumMetaHtml(u)}</td>
        <td>${status}</td>
        <td><div class="users-actions">${userActionButtons(u)}</div></td>
      </tr>`;
    })
    .join('');

  if (usersCards) {
    usersCards.innerHTML = list
      .map((u) => {
        const handle = escapeHtml(u.username || '—');
        const disabled = Boolean(u.disabled);
        const status = disabled
          ? '<span class="badge badge--off">Deshabilitado</span>'
          : '<span class="badge badge--ok">Activo</span>';
        const lastLogin = u.lastLoginAt ? formatDate(u.lastLoginAt) : '—';
        const lastIp = u.lastIp ? String(u.lastIp) : '—';
        const isPrem = u.plan === 'premium' || u.premium;
        return `<article class="user-card">
          <header class="user-card__head">
            <p class="user-card__handle"><code>${handle}</code></p>
            <div class="user-card__badges">${premiumBadge(u)}${status}</div>
          </header>
          <dl class="user-card__fields">
            <div><dt>Nombre</dt><dd>${escapeHtml(u.name)}</dd></div>
            <div><dt>Email</dt><dd>${escapeHtml(u.email)}</dd></div>
            <div><dt>Tel.</dt><dd>${escapeHtml(u.phone || '—')}</dd></div>
            <div><dt>Alta</dt><dd>${escapeHtml(formatDate(u.created_at))}</dd></div>
            <div><dt>Plan</dt><dd>${escapeHtml(premiumPlanLabel(u))}</dd></div>
            <div><dt>Premium desde</dt><dd>${escapeHtml(isPrem && u.premiumStartedAt ? formatDate(u.premiumStartedAt) : '—')}</dd></div>
            <div><dt>Hasta</dt><dd>${escapeHtml(isPrem && u.premiumUntil ? formatDate(u.premiumUntil) : '—')}</dd></div>
            <div><dt>Restante</dt><dd>${escapeHtml(
              isPrem && u.premiumDaysLeft != null ? `${Number(u.premiumDaysLeft)} días` : '—'
            )}</dd></div>
            <div><dt>Último acceso</dt><dd>${escapeHtml(lastLogin)}</dd></div>
            <div><dt>Última IP</dt><dd><code>${escapeHtml(lastIp)}</code></dd></div>
          </dl>
          <div class="users-actions users-actions--stack">${userActionButtons(u)}</div>
        </article>`;
      })
      .join('');
  }
}

function promoTypeLabel(type) {
  switch (String(type || '')) {
    case 'discount_20':
      return '−20%';
    case 'discount_40':
      return '−40%';
    case 'free_month':
      return '1 mes';
    case 'free_days':
      return 'Días';
    default:
      return String(type || '—');
  }
}

function promoBenefitMeta(c) {
  const type = String(c.type || 'free_days');
  if (type === 'discount_20') return '<span>Descuento <strong>20%</strong></span>';
  if (type === 'discount_40') return '<span>Descuento <strong>40%</strong></span>';
  if (type === 'free_month') return '<span><strong>1 mes</strong> Premium</span>';
  return `<span><strong>${Number(c.days) || 0}</strong> días</span>`;
}

function renderPromoCodes(codes) {
  if (promoMeta) {
    promoMeta.textContent = codes.length ? `${codes.length} código${codes.length === 1 ? '' : 's'}` : '';
  }
  if (!promoList) return;
  if (!codes.length) {
    promoList.innerHTML = '<p class="promo-list__empty">Sin códigos</p>';
    return;
  }
  promoList.innerHTML = `<ul class="promo-list__ul">${codes
    .map((c) => {
      const redeemed = Number(c.redeemedCount || 0);
      const maxRaw = c.maxRedemptions;
      const hasMax = maxRaw != null && Number.isFinite(Number(maxRaw));
      const redeemMeta = hasMax
        ? `<span><strong>${redeemed}</strong> / ${escapeHtml(String(maxRaw))} canjes</span>`
        : `<span><strong>${redeemed}</strong> canjes</span>`;
      const isActive = Number(c.active) === 1;
      const statusClass = isActive ? 'badge badge--ok' : 'badge badge--off';
      const statusLabel = isActive ? 'Activo' : 'Off';
      const type = String(c.type || 'free_days');
      const delBtn = isActive
        ? `<button type="button" class="btn btn--ghost btn--promo-del" data-promo-delete="${escapeHtml(c.code)}" aria-label="Eliminar ${escapeHtml(c.code)}">Eliminar</button>`
        : '';
      return `<li class="promo-row">
        <div class="promo-row__main">
          <p class="promo-row__code">
            ${escapeHtml(c.code)}
            <span class="promo-row__type badge">${escapeHtml(promoTypeLabel(type))}</span>
          </p>
          <p class="promo-row__meta">
            ${promoBenefitMeta(c)}
            ${redeemMeta}
          </p>
        </div>
        <div class="promo-row__aside">
          <span class="promo-row__status ${statusClass}">${statusLabel}</span>
          ${delBtn}
        </div>
      </li>`;
    })
    .join('')}</ul>`;
}

function syncPromoDaysVisibility() {
  const typeEl = document.getElementById('promo-type');
  const wrap = document.getElementById('promo-days-wrap');
  const daysEl = document.getElementById('promo-days');
  if (!typeEl || !wrap) return;
  const showDays = String(typeEl.value || '') === 'free_days';
  wrap.hidden = !showDays;
  if (daysEl) {
    daysEl.required = showDays;
    if (showDays && !daysEl.value) daysEl.value = '7';
  }
}

async function loadPromoCodes() {
  if (promoList) promoList.innerHTML = '<p class="promo-list__empty">Cargando…</p>';
  try {
    const res = await adminFetch('/api/v1/admin/promo');
    renderPromoCodes(Array.isArray(res.codes) ? res.codes : []);
  } catch (err) {
    if (promoList) {
      promoList.innerHTML = `<p class="promo-list__empty">${escapeHtml(err.message || 'Error')}</p>`;
    }
  }
}

async function loadDashboard() {
  usagePanel.innerHTML = '<p class="muted">Cargando…</p>';
  if (hitsPanel) hitsPanel.innerHTML = '<p class="muted">Cargando…</p>';
  if (hitsFullPanel) hitsFullPanel.innerHTML = '<p class="muted">Cargando…</p>';
  usersBody.innerHTML = '<tr><td colspan="9" class="muted">Cargando…</td></tr>';
  if (usersCards) usersCards.innerHTML = '<p class="muted users-cards__empty">Cargando…</p>';
  try {
    const [usage, visits, hits, usersRes] = await Promise.all([
      adminFetch('/api/v1/admin/usage/today'),
      adminFetch('/api/v1/admin/usage/visits').catch(() => ({ configured: false })),
      adminFetch(`/api/v1/admin/visits/recent?limit=${HITS_HISTORY_LIMIT}`).catch(() => ({
        uniqueIpsToday: 0,
        hits: [],
      })),
      adminFetch('/api/v1/admin/users'),
    ]);
    renderUsage(usage, visits);
    hitsUniqueToday = Number(hits?.uniqueIpsToday) || 0;
    allHits = Array.isArray(hits?.hits) ? hits.hits : [];
    renderHitsPreview();
    if (mainEl?.dataset.screen === 'hits') renderHitsFull();
    allUsers = Array.isArray(usersRes.users) ? usersRes.users : [];
    renderUsers();
    await loadStats();
    await loadPromoCodes();
  } catch (err) {
    const msg = err.message || 'Error al cargar';
    usagePanel.innerHTML = `<p class="muted">${escapeHtml(msg)}</p>`;
    if (err.status === 401) {
      lockSession();
      showGateError('PIN incorrecto. Inténtalo de nuevo.');
      return;
    }
    showToast(msg, 'error');
  }
}

function playEntryThenReveal() {
  return new Promise((resolve) => {
    gateEl.hidden = true;
    appEl.hidden = false;
    appEl.classList.remove('is-revealed');
    appEl.classList.add('is-entering');

    if (preferReducedMotion()) {
      entryEl.hidden = true;
      appEl.classList.remove('is-entering');
      appEl.classList.add('is-revealed');
      resolve();
      return;
    }

    entryEl.hidden = false;
    entryEl.setAttribute('aria-hidden', 'false');
    entryEl.classList.remove('is-playing');
    void entryEl.offsetWidth;
    entryEl.classList.add('is-playing');

    const done = () => {
      entryEl.classList.remove('is-playing');
      entryEl.hidden = true;
      entryEl.setAttribute('aria-hidden', 'true');
      appEl.classList.remove('is-entering');
      appEl.classList.add('is-revealed');
      resolve();
    };

    window.setTimeout(done, 1300);
  });
}

function showGate() {
  appEl.hidden = true;
  appEl.classList.remove('is-revealed', 'is-entering');
  entryEl.hidden = true;
  entryEl.classList.remove('is-playing');
  entryEl.setAttribute('aria-hidden', 'true');
  gateEl.hidden = false;
  pinInput.value = '';
  clearGateError();
  try {
    pinInput.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
}

function lockSession() {
  setSecret('');
  showGate();
}

async function enterWithPin(pin) {
  clearGateError();
  gateSubmit.disabled = true;
  try {
    await validatePin(pin);
    setSecret(pin);
    await playEntryThenReveal();
    await loadDashboard();
    if (location.hash === '#hits') setAdminScreen('hits');
    else if (location.hash === '#stats') setAdminScreen('stats');
  } catch (err) {
    setSecret('');
    pinInput.value = '';
    pinInput.focus();
    showGateError('PIN incorrecto. Inténtalo de nuevo.');
  } finally {
    gateSubmit.disabled = false;
  }
}

gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const pin = String(pinInput.value || '').trim();
  if (!pin) {
    showGateError('Introduce el PIN.');
    return;
  }
  if (!/^\d+$/.test(pin)) {
    showGateError('El PIN debe ser numérico.');
    return;
  }
  enterWithPin(pin);
});

document.getElementById('btn-refresh')?.addEventListener('click', () => {
  loadDashboard();
});

document.getElementById('btn-lock')?.addEventListener('click', () => {
  lockSession();
});

async function onUserActionClick(e) {
  const el = e.target instanceof Element ? e.target : null;
  const t = el?.closest?.(
    '[data-delete],[data-revoke],[data-enable],[data-premium-grant],[data-premium-revoke]'
  );
  if (!(t instanceof HTMLElement)) return;
  const revoke = t.getAttribute('data-revoke');
  const enable = t.getAttribute('data-enable');
  const del = t.getAttribute('data-delete');
  const premGrant = t.getAttribute('data-premium-grant');
  const premRevoke = t.getAttribute('data-premium-revoke');
  try {
    if (premGrant) {
      if (!confirm('¿Activar Premium 30 días para esta cuenta?')) return;
      t.disabled = true;
      await grantPremiumForUser(premGrant);
      showToast('Premium activado (30 días)', 'ok');
      await loadDashboard();
    } else if (premRevoke) {
      const label = t.getAttribute('data-label') || premRevoke;
      openRevokePremiumModal({ id: premRevoke, label });
    } else if (revoke) {
      if (!confirm('¿Cerrar acceso a esta cuenta? Se invalidarán sus sesiones.')) return;
      t.disabled = true;
      await adminFetch(`/api/v1/admin/users/${encodeURIComponent(revoke)}/revoke`, { method: 'POST' });
      showToast('Acceso cerrado', 'ok');
      await loadDashboard();
    } else if (enable) {
      if (!confirm('¿Reactivar esta cuenta?')) return;
      t.disabled = true;
      await adminFetch(`/api/v1/admin/users/${encodeURIComponent(enable)}/enable`, { method: 'POST' });
      showToast('Cuenta reactivada', 'ok');
      await loadDashboard();
    } else if (del) {
      const label = t.getAttribute('data-confirm') || del;
      openDeleteModal({ id: del, label });
    }
  } catch (err) {
    t.disabled = false;
    showToast(err.message || 'Error', 'error');
  }
}

usersBody.addEventListener('click', onUserActionClick);
usersCards?.addEventListener('click', onUserActionClick);

usersSearch?.addEventListener('input', () => {
  usersQuery = String(usersSearch.value || '');
  renderUsers();
});

document.getElementById('promo-type')?.addEventListener('change', () => {
  syncPromoDaysVisibility();
});
syncPromoDaysVisibility();

promoForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = String(document.getElementById('promo-code')?.value || '').trim();
  const type = String(document.getElementById('promo-type')?.value || 'discount_20');
  const days = Number(document.getElementById('promo-days')?.value) || 0;
  const maxRaw = String(document.getElementById('promo-max')?.value || '').trim();
  const maxRedemptions = maxRaw ? Number(maxRaw) : null;
  const submit = document.getElementById('promo-submit');
  if (submit) submit.disabled = true;
  try {
    const body = { code, type, maxRedemptions };
    if (type === 'free_days') body.days = days;
    await adminFetch('/api/v1/admin/promo', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    showToast(`Código ${code.toUpperCase()} creado`, 'ok');
    promoForm.reset();
    const typeEl = document.getElementById('promo-type');
    if (typeEl) typeEl.value = 'discount_20';
    const daysEl = document.getElementById('promo-days');
    if (daysEl) daysEl.value = '7';
    syncPromoDaysVisibility();
    await loadPromoCodes();
  } catch (err) {
    showToast(err.message || 'Error al crear código', 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
});

promoList?.addEventListener('click', async (e) => {
  const t = e.target instanceof Element ? e.target.closest('[data-promo-delete]') : null;
  if (!(t instanceof HTMLElement)) return;
  const code = t.getAttribute('data-promo-delete');
  if (!code) return;
  if (!confirm(`¿Desactivar el código «${code}»? Los canjes ya hechos se conservan.`)) return;
  t.disabled = true;
  try {
    await adminFetch(`/api/v1/admin/promo/${encodeURIComponent(code)}`, { method: 'DELETE' });
    showToast(`Código ${code} desactivado`, 'ok');
    await loadPromoCodes();
  } catch (err) {
    t.disabled = false;
    showToast(err.message || 'Error al eliminar', 'error');
  }
});

hitsSearch?.addEventListener('input', () => {
  hitsQuery = String(hitsSearch.value || '');
  renderHitsFull();
});

document.getElementById('btn-hits-history')?.addEventListener('click', () => {
  setAdminScreen('hits');
});
document.getElementById('btn-hits-close')?.addEventListener('click', () => {
  setAdminScreen('home');
});
document.getElementById('btn-stats-all')?.addEventListener('click', () => {
  setAdminScreen('stats');
});
document.getElementById('btn-stats-close')?.addEventListener('click', () => {
  setAdminScreen('home');
});

hitsPanel?.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target.closest('tr, .hit-card') : null;
  if (!t) return;
  setAdminScreen('hits');
});

statsPanel?.addEventListener('click', () => {
  setAdminScreen('stats');
});

deleteModal?.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest?.('[data-delete-dismiss]')) closeDeleteModal();
});
deleteConfirmBtn?.addEventListener('click', () => {
  confirmDelete();
});
revokePremModal?.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest?.('[data-revoke-prem-dismiss]')) closeRevokePremiumModal();
});
revokePremConfirmBtn?.addEventListener('click', () => {
  confirmRevokePremium();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && deleteModal && !deleteModal.hidden) {
    e.preventDefault();
    closeDeleteModal();
  }
  if (e.key === 'Escape' && revokePremModal && !revokePremModal.hidden) {
    e.preventDefault();
    closeRevokePremiumModal();
  }
});

window.addEventListener('hashchange', () => {
  if (appEl?.hidden) return;
  if (location.hash === '#hits') setAdminScreen('hits');
  else if (location.hash === '#stats') setAdminScreen('stats');
  else if (mainEl?.dataset.screen === 'hits' || mainEl?.dataset.screen === 'stats') {
    setAdminScreen('home');
  }
});

(async function boot() {
  try {
    const cached = getSecret();
    if (!cached) {
      showGate();
      return;
    }
    await validatePin(cached);
    gateEl.hidden = true;
    appEl.hidden = false;
    appEl.classList.remove('is-entering');
    appEl.classList.add('is-revealed');
    await loadDashboard();
    if (location.hash === '#hits') setAdminScreen('hits');
    else if (location.hash === '#stats') setAdminScreen('stats');
  } catch {
    setSecret('');
    showGate();
  }
})();
