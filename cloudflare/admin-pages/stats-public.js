/** Public houdini-analytics Stats experience inside admin (#stats). */
(function () {
  const API_BASE = 'https://houdini-bet.ivanmarrtin2703.workers.dev';

  const COUNTRY_ES = {
    Spain: 'España',
    England: 'Inglaterra',
    Italy: 'Italia',
    Germany: 'Alemania',
    France: 'Francia',
    Portugal: 'Portugal',
    Netherlands: 'Países Bajos',
    Belgium: 'Bélgica',
    Brazil: 'Brasil',
    Argentina: 'Argentina',
    Mexico: 'México',
    USA: 'EE. UU.',
    'United States': 'EE. UU.',
    World: 'Internacional',
    International: 'Internacional',
    Europe: 'Europa',
  };

  const COUNTRY_ISO = {
    Spain: 'ES',
    England: 'EN',
    Italy: 'IT',
    Germany: 'DE',
    France: 'FR',
    Portugal: 'PT',
    Netherlands: 'NL',
    Belgium: 'BE',
    Brazil: 'BR',
    Argentina: 'AR',
    Mexico: 'MX',
    USA: 'US',
    'United States': 'US',
    World: 'INT',
    International: 'INT',
    Europe: 'EU',
  };

  const LEAGUE_ES_BY_API = {
    140: 'LaLiga',
    141: 'LaLiga Hypermotion',
    39: 'Premier League',
    135: 'Serie A',
    78: 'Bundesliga',
    61: 'Ligue 1',
    5: 'Liga de Naciones',
    2: 'Champions League',
    3: 'Europa League',
  };

  const MARKET_LABELS = {
    OVER_05: 'Total de goles: +0.5',
    UNDER_05: 'Total de goles: −0.5',
    OVER_15: 'Total de goles: +1.5',
    UNDER_15: 'Total de goles: −1.5',
    OVER_25: 'Total de goles: +2.5',
    UNDER_25: 'Total de goles: −2.5',
    OVER_35: 'Total de goles: +3.5',
    UNDER_35: 'Total de goles: −3.5',
    OVER_45: 'Total de goles: +4.5',
    UNDER_45: 'Total de goles: −4.5',
    OVER_55: 'Total de goles: +5.5',
    UNDER_55: 'Total de goles: −5.5',
    BTTS_YES: 'Ambos equipos marcan: SI',
    BTTS_NO: 'Ambos equipos marcan: NO',
    HOME_WIN: '1',
    DRAW: 'X',
    AWAY_WIN: '2',
    AVG_YELLOW: 'Media de tarjetas amarillas por partido',
    AVG_RED: 'Media de tarjetas rojas por partido',
    AVG_CORNERS: 'Media de córners por partido',
  };

  const METRIC_LABELS = {
    goals: 'goles',
    shots: 'tiros',
    sot: 'tiros a puerta',
    corners: 'córners',
    cards: 'tarjetas',
  };

  const LEAGUE_STATS_MARKET_CODES = [
    ...[0.5, 1.5, 2.5, 3.5, 4.5, 5.5].flatMap((line) => {
      const key = String(line).replace('.', '');
      return [`OVER_${key[0]}5`, `UNDER_${key[0]}5`];
    }),
    'BTTS_YES',
    'BTTS_NO',
    'HOME_WIN',
    'DRAW',
    'AWAY_WIN',
    'AVG_YELLOW',
    'AVG_RED',
    'AVG_CORNERS',
  ];

  let matchStatsMetric = 'goals';
  let matchStatsSort = 'high';
  let matchStatsDate = todayYmd();
  let matchStatsBound = false;
  let matchStatsLoadSeq = 0;
  let leagueStatsMarket = 'OVER_25';
  let leagueStatsActiveOnly = false;
  let leagueStatsBound = false;
  let leagueStatsLeagueId = null;
  let leagueStatsLeagueName = '';
  let leagueStatsTeamId = null;
  let leagueStatsTeamCache = [];

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayYmd() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function ymdAddDays(ymd, delta) {
    const [y, m, d] = String(ymd).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(delta || 0));
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  function formatStatsDate(ymd) {
    const [year, month, day] = String(ymd).split('-').map(Number);
    if (!year || !month || !day) return ymd;
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(year, month - 1, day));
  }

  function matchStatsValue(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  function countryLabel(country) {
    const c = String(country || '').trim();
    if (!c) return '—';
    if (COUNTRY_ES[c]) return COUNTRY_ES[c];
    const hit = Object.keys(COUNTRY_ES).find((k) => k.toLowerCase() === c.toLowerCase());
    return hit ? COUNTRY_ES[hit] : c;
  }

  function countryIsoBadge(country, className = 'hb-iso') {
    const c = String(country || '').trim();
    const code =
      COUNTRY_ISO[c] ||
      COUNTRY_ISO[Object.keys(COUNTRY_ISO).find((k) => k.toLowerCase() === c.toLowerCase()) || ''] ||
      '';
    if (!code) return '';
    return `<span class="${className}" aria-hidden="true">${escapeHtml(code)}</span>`;
  }

  function leagueLabelEs(name, apiId = null) {
    const aid = Number(apiId);
    if (Number.isFinite(aid) && LEAGUE_ES_BY_API[aid]) return LEAGUE_ES_BY_API[aid];
    const n = String(name || '').trim();
    if (!n) return 'Liga';
    if (/champions/i.test(n)) return 'Champions League';
    if (/europa\s*league/i.test(n)) return 'Europa League';
    if (/nations\s*league|liga de naciones/i.test(n)) return 'Liga de Naciones';
    if (/premier/i.test(n)) return 'Premier League';
    if (/serie\s*a/i.test(n)) return 'Serie A';
    if (/bundesliga/i.test(n)) return 'Bundesliga';
    if (/ligue\s*1/i.test(n)) return 'Ligue 1';
    if (/hypermotion|laliga\s*2|segunda/i.test(n)) return 'LaLiga Hypermotion';
    if (/la\s*liga|laliga/i.test(n)) return 'LaLiga';
    return n;
  }

  function formatLeagueLine(country, name, apiId = null) {
    const c = countryLabel(country);
    const l = leagueLabelEs(name, apiId);
    return [c !== '—' ? c : '', l].filter(Boolean).join(' · ') || 'Liga';
  }

  function leagueLogoHtml(url, cls = 'match-stats-row__league-logo') {
    if (!url) return '';
    return `<img class="${cls}" src="${escapeHtml(url)}" width="22" height="22" alt="" aria-hidden="true" decoding="async" onerror="this.hidden=true" />`;
  }

  function teamInitials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  function crestHtml(name, logo) {
    const alt = escapeHtml(name || 'Equipo');
    const initials = escapeHtml(teamInitials(name));
    const src = String(logo || '').trim();
    if (src) {
      return `<span class="crest-wrap crest-wrap--sm">
        <img class="crest crest--sm" src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'" />
        <span class="crest crest--fallback crest--sm" style="display:none" aria-hidden="true">${initials}</span>
      </span>`;
    }
    return `<span class="crest crest--fallback crest--sm" aria-hidden="true">${initials}</span>`;
  }

  async function publicFetch(path) {
    const res = await fetch(`${API_BASE}${path}`);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `Error ${res.status}`);
    }
    return data;
  }

  function leagueStatsMarkets() {
    return LEAGUE_STATS_MARKET_CODES.map((code) => ({
      code,
      label: MARKET_LABELS[code] || code,
    }));
  }

  function leagueStatsMarketMeta(code) {
    const markets = leagueStatsMarkets();
    return markets.find((m) => m.code === code) || markets[4];
  }

  function renderMatchStatsRows(rows) {
    const list = document.getElementById('match-stats-list');
    if (!list) return;
    if (!rows?.length) {
      list.innerHTML = `<div class="empty-board muted">No hay partidos con datos para esta fecha.</div>`;
      return;
    }
    list.innerHTML = rows
      .map((row, index) => {
        const home = row.homeTeam || {};
        const away = row.awayTeam || {};
        const leagueLine = formatLeagueLine(
          row.leagueCountry || row.country || '',
          row.leagueName || row.league || '',
          row.leagueApiId ?? row.apiId
        );
        const leagueLogo = leagueLogoHtml(row.leagueLogo, 'match-stats-row__league-logo');
        return `<div class="match-stats-row" role="listitem">
          <span class="match-stats-row__rank" aria-label="Posición ${index + 1}">${index + 1}</span>
          <span class="match-stats-row__crests" aria-hidden="true">
            ${crestHtml(home.name, home.logo)}
            ${crestHtml(away.name, away.logo)}
          </span>
          <span class="match-stats-row__body">
            <span class="match-stats-row__match">${escapeHtml(home.name || 'Local')} <span>vs</span> ${escapeHtml(
              away.name || 'Visitante'
            )}</span>
            <span class="match-stats-row__league">
              ${countryIsoBadge(row.leagueCountry, 'match-stats-row__iso hb-iso')}${leagueLogo}<span>${escapeHtml(
                leagueLine
              )}</span>
            </span>
          </span>
          <span class="match-stats-row__value" aria-label="${escapeHtml(
            `${METRIC_LABELS[matchStatsMetric] || matchStatsMetric}: ${matchStatsValue(row.matchAvg)}`
          )}">${escapeHtml(matchStatsValue(row.matchAvg))}</span>
        </div>`;
      })
      .join('');
  }

  function syncMatchStatsControls() {
    const dateEl = document.getElementById('match-stats-date');
    if (dateEl) {
      dateEl.textContent = formatStatsDate(matchStatsDate);
      dateEl.setAttribute('datetime', matchStatsDate);
    }
    document.querySelectorAll('[data-stats-sort]').forEach((button) => {
      const active = button.dataset.statsSort === matchStatsSort;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-stats-metric]').forEach((button) => {
      const active = button.dataset.statsMetric === matchStatsMetric;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setMatchStatsDate(delta) {
    matchStatsDate = ymdAddDays(matchStatsDate, delta);
    loadMatchStatsView().catch(() => {});
  }

  function bindMatchStatsControls() {
    if (matchStatsBound) return;
    matchStatsBound = true;
    document.getElementById('match-stats-prev')?.addEventListener('click', () => setMatchStatsDate(-1));
    document.getElementById('match-stats-next')?.addEventListener('click', () => setMatchStatsDate(1));
    document.querySelectorAll('[data-stats-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        matchStatsSort = button.dataset.statsSort === 'low' ? 'low' : 'high';
        loadMatchStatsView().catch(() => {});
      });
    });
    document.querySelectorAll('[data-stats-metric]').forEach((button) => {
      button.addEventListener('click', () => {
        matchStatsMetric = button.dataset.statsMetric || 'goals';
        loadMatchStatsView().catch(() => {});
      });
    });
  }

  async function loadMatchStatsView() {
    bindMatchStatsControls();
    syncMatchStatsControls();
    const seq = ++matchStatsLoadSeq;
    const list = document.getElementById('match-stats-list');
    const meta = document.getElementById('match-stats-meta');
    if (list) list.innerHTML = `<div class="empty-board muted">Cargando estadísticas…</div>`;
    if (meta) meta.textContent = '';
    const query = new URLSearchParams({
      date: matchStatsDate,
      metric: matchStatsMetric,
      sort: matchStatsSort,
      n: '10',
    });
    try {
      const data = await publicFetch(`/api/v1/stats/match-averages?${query}`);
      if (seq !== matchStatsLoadSeq) return;
      if (meta) {
        meta.textContent = `${Number(data.meta?.withData) || 0} de ${
          Number(data.meta?.total) || 0
        } partidos con datos · ${formatStatsDate(matchStatsDate)}`;
      }
      renderMatchStatsRows(data.matches || []);
    } catch (err) {
      if (seq !== matchStatsLoadSeq) return;
      if (list) {
        list.innerHTML = `<div class="empty-board">${escapeHtml(
          err.message || 'No se pudieron cargar las estadísticas.'
        )}</div>`;
      }
    }
  }

  function renderLeagueStatsMenu() {
    const menu = document.getElementById('league-stats-market-menu');
    if (!menu) return;
    menu.innerHTML = leagueStatsMarkets()
      .map(
        (m) =>
          `<button type="button" class="league-stats__option${
            m.code === leagueStatsMarket ? ' is-active' : ''
          }" role="option" data-market="${escapeHtml(m.code)}" aria-selected="${
            m.code === leagueStatsMarket ? 'true' : 'false'
          }">${escapeHtml(m.label)}</button>`
      )
      .join('');
  }

  function setLeagueStatsMarketOpen(open) {
    const btn = document.getElementById('league-stats-market-btn');
    const menu = document.getElementById('league-stats-market-menu');
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
  }

  function syncLeagueStatsScopeChrome() {
    const scope = document.getElementById('league-stats-scope');
    const head = document.getElementById('league-stats-head');
    const nameEl = document.getElementById('league-stats-scope-name');
    const inTeams = leagueStatsLeagueId != null;
    if (scope) scope.hidden = !inTeams;
    if (nameEl) nameEl.textContent = inTeams ? leagueStatsLeagueName || 'Liga' : '';
    if (head) {
      head.innerHTML = inTeams
        ? `<span>Equipo</span><span>Partidos</span><span>Jugados</span><span>Score</span>`
        : `<span>Liga</span><span>Partidos totales</span><span>Partidos jugados</span><span>Score</span>`;
    }
  }

  function fillLeagueStatsTeamSelect(teams) {
    const sel = document.getElementById('league-stats-team-select');
    if (!sel) return;
    const opts = [`<option value="">Todos los equipos</option>`].concat(
      (teams || []).map(
        (t) =>
          `<option value="${Number(t.teamId)}"${
            Number(leagueStatsTeamId) === Number(t.teamId) ? ' selected' : ''
          }>${escapeHtml(t.teamName || '')}</option>`
      )
    );
    sel.innerHTML = opts.join('');
  }

  function bindLeagueStatsControls() {
    if (leagueStatsBound) return;
    leagueStatsBound = true;
    const btn = document.getElementById('league-stats-market-btn');
    const menu = document.getElementById('league-stats-market-menu');
    const toggle = document.getElementById('league-stats-active-only');
    btn?.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      setLeagueStatsMarketOpen(!open);
    });
    menu?.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-market]');
      if (!opt) return;
      leagueStatsMarket = opt.getAttribute('data-market') || 'OVER_25';
      const label = document.getElementById('league-stats-market-label');
      if (label) label.textContent = leagueStatsMarketMeta(leagueStatsMarket).label;
      renderLeagueStatsMenu();
      setLeagueStatsMarketOpen(false);
      loadLeagueStatsView().catch(() => {});
    });
    toggle?.addEventListener('change', () => {
      leagueStatsActiveOnly = !!toggle.checked;
      loadLeagueStatsView().catch(() => {});
    });
    document.getElementById('league-stats-back')?.addEventListener('click', () => {
      leagueStatsLeagueId = null;
      leagueStatsLeagueName = '';
      leagueStatsTeamId = null;
      leagueStatsTeamCache = [];
      loadLeagueStatsView().catch(() => {});
    });
    document.getElementById('league-stats-team-select')?.addEventListener('change', (e) => {
      const v = e.target.value;
      leagueStatsTeamId = v ? Number(v) : null;
      loadLeagueStatsView().catch(() => {});
    });
    document.getElementById('league-stats-list')?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-stats-league-id]');
      if (!row) return;
      const id = Number(row.getAttribute('data-stats-league-id'));
      if (!Number.isFinite(id) || id <= 0) return;
      leagueStatsLeagueId = id;
      leagueStatsLeagueName = row.getAttribute('data-stats-league-name') || '';
      leagueStatsTeamId = null;
      loadLeagueStatsView().catch(() => {});
    });
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('league-stats-market-wrap');
      if (wrap && !wrap.contains(e.target)) setLeagueStatsMarketOpen(false);
    });
  }

  function formatLeagueStatsScore(row) {
    if (row?.score == null || !Number.isFinite(Number(row.score))) return '—';
    if (row.scoreKind === 'avg') return Number(row.score).toFixed(2);
    return `${Math.trunc(Number(row.score) * 100)}%`;
  }

  function renderLeagueStatsList(rows) {
    const el = document.getElementById('league-stats-list');
    if (!el) return;
    if (!rows?.length) {
      el.innerHTML = `<div class="empty-board muted">Sin datos para este mercado</div>`;
      return;
    }
    el.innerHTML = rows
      .map((row) => {
        const logo = leagueLogoHtml(row.leagueLogo, 'league-stats__logo');
        const flag = countryIsoBadge(row.country, 'league-stats__flag hb-iso');
        const countryBit = row.country
          ? `<span class="league-stats__country">${escapeHtml(countryLabel(row.country))}</span>`
          : '';
        const lid = Number(row.leagueId);
        return `<article class="league-stats__row is-clickable" role="button" tabindex="0"
          data-stats-league-id="${lid}"
          data-stats-league-name="${escapeHtml(row.leagueName || '')}">
          <div class="league-stats__league">
            ${logo || flag}
            <div class="league-stats__league-text">
              ${countryBit}
              <span class="league-stats__name">${escapeHtml(row.leagueName || '')}</span>
            </div>
          </div>
          <span class="league-stats__num">${Number(row.totalMatches) || 0}</span>
          <span class="league-stats__num">${Number(row.played) || 0}</span>
          <span class="league-stats__score">${escapeHtml(formatLeagueStatsScore(row))}</span>
        </article>`;
      })
      .join('');
  }

  function renderTeamStatsList(rows) {
    const el = document.getElementById('league-stats-list');
    if (!el) return;
    if (!rows?.length) {
      el.innerHTML = `<div class="empty-board muted">Sin datos para este mercado</div>`;
      return;
    }
    el.innerHTML = rows
      .map((row) => {
        const crest = crestHtml(row.teamName, row.teamLogo);
        const selected =
          leagueStatsTeamId != null && Number(leagueStatsTeamId) === Number(row.teamId)
            ? ' is-selected'
            : '';
        return `<article class="league-stats__row${selected}" role="listitem">
          <div class="league-stats__league">
            ${crest}
            <div class="league-stats__league-text">
              <span class="league-stats__name">${escapeHtml(row.teamName || '')}</span>
            </div>
          </div>
          <span class="league-stats__num">${Number(row.totalMatches) || 0}</span>
          <span class="league-stats__num">${Number(row.played) || 0}</span>
          <span class="league-stats__score">${escapeHtml(formatLeagueStatsScore(row))}</span>
        </article>`;
      })
      .join('');
  }

  async function loadLeagueStatsView() {
    await loadMatchStatsView();
    bindLeagueStatsControls();
    renderLeagueStatsMenu();
    syncLeagueStatsScopeChrome();
    const label = document.getElementById('league-stats-market-label');
    if (label) label.textContent = leagueStatsMarketMeta(leagueStatsMarket).label;
    const toggle = document.getElementById('league-stats-active-only');
    if (toggle) toggle.checked = leagueStatsActiveOnly;
    const el = document.getElementById('league-stats-list');
    if (el) el.innerHTML = `<div class="empty-board muted">Cargando estadísticas…</div>`;
    try {
      if (leagueStatsLeagueId != null) {
        const q = new URLSearchParams({
          market: leagueStatsMarket,
          leagueId: String(leagueStatsLeagueId),
          activeOnly: leagueStatsActiveOnly ? '1' : '0',
        });
        if (leagueStatsTeamId != null) q.set('teamId', String(leagueStatsTeamId));
        const data = await publicFetch(`/api/v1/stats/teams?${q}`);
        const teams = data.teams || [];
        if (!leagueStatsTeamId) {
          leagueStatsTeamCache = teams;
          fillLeagueStatsTeamSelect(teams);
        } else if (!leagueStatsTeamCache.length) {
          const allQ = new URLSearchParams({
            market: leagueStatsMarket,
            leagueId: String(leagueStatsLeagueId),
            activeOnly: leagueStatsActiveOnly ? '1' : '0',
          });
          const allData = await publicFetch(`/api/v1/stats/teams?${allQ}`);
          leagueStatsTeamCache = allData.teams || [];
          fillLeagueStatsTeamSelect(leagueStatsTeamCache);
        } else {
          fillLeagueStatsTeamSelect(leagueStatsTeamCache);
        }
        renderTeamStatsList(teams);
        return;
      }
      const q = new URLSearchParams({
        market: leagueStatsMarket,
        activeOnly: leagueStatsActiveOnly ? '1' : '0',
      });
      const data = await publicFetch(`/api/v1/stats/leagues?${q}`);
      renderLeagueStatsList(data.leagues || []);
    } catch (err) {
      if (el) {
        el.innerHTML = `<div class="empty-board">${escapeHtml(err.message || 'error')}</div>`;
      }
    }
  }

  window.AdminPublicStats = {
    load() {
      return loadLeagueStatsView();
    },
  };
})();
