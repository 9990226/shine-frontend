// SHINE 出眾 — Full SSOT Compliant Frontend
// Static-friendly for Hostinger /shine (2c-ai.com/shine)
// Key guarantees:
// - User provides up to 1/2/3 source search page URLs (by plan level)
// - Tool automatically processes those sources to find application contacts (user never has to browse repeatedly or hunt emails manually)
// - Universal Cover Letter sent 100% EXACT (no modification whatsoever)
// - 2C-AI covers the AI processing costs for paid tiers; users never input or see any AI API key
// - Backend address completely hidden from UI
// - Human pacing: 1st email immediate, then 60s between sends; success-only quota, exact preview, dedup
// - One account = one sender via user's own Gmail App Password
// - Minimal persisted data (localStorage)

const SHINE_VERSION = 'v2.2.0';
const HOURS_SAVED_PER_SEND = 1;
const TIER_DISPLAY = {
  lv1: { name: 'Scout', price: '$100', urls: 1, quota: 60 },
  lv2: { name: 'Sprint', price: '$500', urls: 2, quota: 500 },
  lv3: { name: 'Superman', price: '$768', urls: 3, quota: null }
};
const SHINE_USER_ID_KEY = 'shine_user_id';
let sessionSkipCount = 0;
const SEND_DELAY_MS = 60000; // 60s between emails (after 1st immediate send)
const APP_PW_SESSION_KEY = 'shine_app_pw_session';
const ACCESS_TOKEN_KEY = 'shine_access_token';
const ACCESS_EXPIRES_KEY = 'shine_access_expires';
const ACCESS_TIER_KEY = 'shine_access_tier';
const STORAGE_KEY_PREFIX = 'shine_ssot_v2_';
const MAX_KEYWORDS = 3;
const MAX_LETTER_WORDS = 2000;

// Hardcoded backend for production beta. Never shown to users.
// 2C-AI covers DeepSeek costs for paid tiers; users never provide or see any DeepSeek key.
const EXTRACT_BACKEND_URL = 'https://shine-backend-byii.onrender.com';
// Gmail SMTP blocked on Render — send via VPS /shine-api (same-origin HTTPS on 2c-ai.com)
function getSendBackendUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    return window.location.origin.replace(/\/$/, '') + '/shine-api';
  }
  return 'https://2c-ai.com/shine-api';
}

// Account login + tier must use VPS (has access-passwords.txt); Render scan API may lack SHINE_ACCESS_PASSWORDS.
function getAccessBackendUrl() {
  return getSendBackendUrl();
}

function getLiveMailCreds() {
  return {
    gmailUser: getGmailUser(),
    appPassword: normalizeAppPassword(getInputVal('appPassword'))
  };
}

function buildBetaCreds(gmailUser, appPassword) {
  return {
    backendUrl: BACKEND_URL,
    sendBackendUrl: getSendBackendUrl(),
    gmailUser,
    appPassword,
    cvUrl: state.cvUrl
  };
}

async function probeSendBackend(timeoutMs = 10000) {
  const url = getSendBackendUrl();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${url}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    });
    if (!res.ok) return { ok: false, url, error: 'HTTP ' + res.status };
    return { ok: true, url };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return { ok: false, url, error: msg };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const BACKEND_URL = EXTRACT_BACKEND_URL;

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

function isAccessSessionValid() {
  const token = getAccessToken();
  const exp = parseInt(localStorage.getItem(ACCESS_EXPIRES_KEY) || '0', 10);
  return !!(token && exp && Date.now() < exp);
}

function decodeAccessToken(token) {
  if (!token) return null;
  try {
    const b64 = String(token).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const decoded = atob(b64 + pad);
    const parts = decoded.split('|');
    if (parts.length < 3) return null;
    const tier = String(parts[1] || '').toLowerCase();
    if (!['lv1', 'lv2', 'lv3'].includes(tier)) return null;
    return {
      userId: String(parts[0] || '').toLowerCase(),
      tier,
      expiresAt: parseInt(parts[2], 10) || 0
    };
  } catch (_) {
    return null;
  }
}

function getStoredAccessTier() {
  const stored = localStorage.getItem(ACCESS_TIER_KEY);
  if (stored && ['lv1', 'lv2', 'lv3'].includes(stored)) return stored;
  const decoded = decodeAccessToken(getAccessToken());
  return decoded && decoded.tier ? decoded.tier : null;
}

function saveAccessSession(session) {
  if (!session || !session.token) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, session.token);
  localStorage.setItem(ACCESS_EXPIRES_KEY, String(session.expiresAt || 0));
  const tier = session.tier || (decodeAccessToken(session.token) || {}).tier;
  if (tier && ['lv1', 'lv2', 'lv3'].includes(tier)) {
    localStorage.setItem(ACCESS_TIER_KEY, tier);
  }
}

function clearAccessSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_EXPIRES_KEY);
  localStorage.removeItem(ACCESS_TIER_KEY);
}

function getAccessHeaders(extra) {
  const headers = { ...(extra || {}) };
  const token = getAccessToken();
  if (token) headers['X-Shine-Access'] = token;
  return headers;
}

function updateAccessLoginUI() {
  const field = document.getElementById('loginAccessPasswordField');
  const pw = document.getElementById('loginAccessPassword');
  if (field) field.style.display = 'block';
  if (pw) pw.setAttribute('required', 'required');
}

async function fetchAccessStatus() {
  try {
    const res = await fetch(`${getAccessBackendUrl()}/api/access-status`, {
      method: 'GET',
      headers: getAccessHeaders(),
      cache: 'no-store'
    });
    const data = await res.json().catch(() => ({}));
    accessRequired = !!data.accessRequired;
  } catch (_) {
    accessRequired = true;
  }
  updateAccessLoginUI();
}

async function verifyShineAccess(userId, password) {
  const res = await fetch(`${getAccessBackendUrl()}/api/verify-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || '登入驗證失敗');
  }
  saveAccessSession(data);
  applyAccountTier(data.tier || 'lv2');
  return data;
}

function applyAccountTier(tier) {
  const t = (tier || 'lv2').toLowerCase();
  state.tier = ['lv1', 'lv2', 'lv3'].includes(t) ? t : 'lv2';
  lockTierUI();
  updateSourceInputs();
  updateQuotaUI();
}

function lockTierUI() {
  const tierSel = document.getElementById('tierSelect');
  const planDisplay = document.getElementById('planDisplay');
  const limits = {
    lv1: 'Scout · 1 個來源 · 60 封/月',
    lv2: 'Sprint · 2 個來源 · 500 封/月',
    lv3: 'Superman · 3 個來源 · 無限寄送'
  };
  if (tierSel) {
    tierSel.value = state.tier;
    tierSel.disabled = true;
    tierSel.title = '等級由帳號決定，無法自行變更';
  }
  if (planDisplay) {
    planDisplay.textContent = limits[state.tier] || limits.lv2;
  }
}

function updatePlanChip() {
  const chip = document.getElementById('planChip');
  if (!chip || !accountUserId) return;
  const td = TIER_DISPLAY[state.tier] || TIER_DISPLAY.lv2;
  chip.textContent = `${td.name} · ${accountUserId}`;
}

function ensureAccessOrPrompt() {
  if (isAccessSessionValid()) return true;
  clearAccessSession();
  const loginCard = document.getElementById('shineLogin');
  const portal = document.getElementById('portal');
  const site = document.getElementById('site');
  if (portal) portal.style.display = 'none';
  if (site) site.style.display = 'block';
  if (loginCard) loginCard.style.display = 'block';
  const beta = document.getElementById('beta-access');
  if (beta) beta.style.display = 'none';
  alert('SHINE 登入已過期或尚未驗證。請重新輸入帳號 ID 與密碼。');
  return false;
}

let accessRequired = true;

let accountUserId = '';
let state = {
  tier: 'lv2',                    // lv1=60/1url, lv2=500/2url, lv3=unlimited/3url (SSOT level-based)
  applicantName: '',
  universalLetter: '',
  keywords: '',
  blacklist: '',
  searchUrls: '',                 // joined \n from the three independent URL boxes
  cvUrl: '',
  scanOnLogin: false,
  dailyAutoEnabled: false,
  isAdmin: false,
  successfulThisMonth: 0,
  hoursSavedThisYear: 0,
  logs: []
};

function storageKey() {
  const key = (accountUserId || 'guest').toLowerCase().trim();
  return STORAGE_KEY_PREFIX + key.replace(/[^a-z0-9@._-]/g, '_');
}

function sentHistoryKey() {
  return 'shine_sent_history_' + (accountUserId || 'guest').toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '_');
}

function countWords(text) {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = text.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).length;
  return cjk + latin;
}

function parseKeywordsList(str) {
  return (str || '').split(/[,，]/).map(k => k.trim()).filter(Boolean).slice(0, MAX_KEYWORDS);
}

function loadState() {
  const saved = localStorage.getItem(storageKey());
  if (saved) {
    const parsed = JSON.parse(saved);
    delete parsed.tier;
    // Legacy client-side 09:00 tab scheduler (replaced by server daily_auto)
    if (parsed.autoScan0900 !== undefined) delete parsed.autoScan0900;
    state = { ...state, ...parsed };
  }
  localStorage.removeItem('autoScan0900');
  if (state.tier === 'lv1' && state.successfulThisMonth > 60) state.successfulThisMonth = 60;
  if (state.tier === 'lv2' && state.successfulThisMonth > 500) state.successfulThisMonth = 500;
  if (typeof state.hoursSavedThisYear !== 'number') state.hoursSavedThisYear = 0;
  if (state.hoursSavedThisYear < state.successfulThisMonth * HOURS_SAVED_PER_SEND) {
    state.hoursSavedThisYear = Math.max(state.hoursSavedThisYear, state.successfulThisMonth * HOURS_SAVED_PER_SEND);
  }
}

function saveState() {
  if (!accountUserId) return;
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function getQuotaLimit() {
  if (state.tier === 'lv1') return 60;
  if (state.tier === 'lv2') return 500;
  return 999999; // unlimited
}

function getMaxSearchUrls() {
  if (state.tier === 'lv1') return 1;
  if (state.tier === 'lv2') return 2;
  return 3;
}

let sentHistory = [];

function loadSentHistory() {
  try {
    sentHistory = JSON.parse(localStorage.getItem(sentHistoryKey()) || '[]');
  } catch (e) {
    sentHistory = [];
  }
}

function saveSentHistory() {
  if (!accountUserId) return;
  localStorage.setItem(sentHistoryKey(), JSON.stringify(sentHistory));
}

function parseJobDate(str) {
  if (!str) return 0;
  const m = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{2})/i);
  if (m) {
    const mon = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const mnum = mon[m[2].toLowerCase().slice(0,3)] || 0;
    const year = 2000 + parseInt(m[3], 10);
    return new Date(year, mnum, parseInt(m[1],10)).getTime();
  }
  return 0;
}

function downloadSentLog() {
  if (!sentHistory.length) {
    alert('無發送記錄可下載。');
    return;
  }
  let txt = 'SHINE 出眾 發送記錄 LOG\n生成時間: ' + new Date().toLocaleString() + '\n\n';
  txt += '發送時間 | 職缺 | 公司 | Email | 職缺日期 | 來源\n';
  sentHistory.forEach(s => {
    txt += `${s.sentAt} | ${s.title || ''} | ${s.company || ''} | ${s.email || ''} | ${s.date || ''} | ${s.sourceUrl || ''}\n`;
  });
  const blob = new Blob([txt], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shine_sent_log_' + new Date().toISOString().slice(0,10) + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function updateQuotaUI() {
  const limit = getQuotaLimit();
  const used = state.successfulThisMonth;
  const remaining = Math.max(0, limit - used);
  const pct = limit === 999999 ? Math.min(used * 2, 100) : Math.min(100, (used / limit) * 100);
  const limitLabel = limit === 999999 ? '∞' : limit;

  const el = document.getElementById('quotaDisplay');
  if (el) el.innerHTML = `<strong>${used}</strong> / ${limitLabel} 已用 · 剩餘 <span style="color:#16a34a">${limit === 999999 ? '無限' : remaining}</span> 封`;

  const bar = document.getElementById('quotaBar');
  if (bar) bar.style.width = pct + '%';

  const usageTxt = document.getElementById('usageTxt');
  if (usageTxt) usageTxt.textContent = `${used} / ${limitLabel}`;

  const usageBar = document.getElementById('usageBar');
  if (usageBar) usageBar.style.width = Math.max(4, pct) + '%';

  const stSent = document.getElementById('stSent');
  if (stSent) stSent.textContent = String(used);

  updateTimeSavingsUI();
}

function animateCount(el, target, duration) {
  if (!el) return;
  const start = parseInt(el.dataset.val || el.textContent || '0', 10) || 0;
  const diff = target - start;
  if (!diff) { el.textContent = String(target); el.dataset.val = String(target); return; }
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - t0) / (duration || 900));
    const v = Math.round(start + diff * (1 - Math.pow(1 - p, 3)));
    el.textContent = String(v);
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = String(target); el.dataset.val = String(target); }
  }
  requestAnimationFrame(tick);
}

function updateTimeSavingsUI() {
  const monthH = (state.successfulThisMonth || 0) * HOURS_SAVED_PER_SEND;
  const yearH = state.hoursSavedThisYear || 0;
  animateCount(document.getElementById('timeSavedMonth'), monthH);
  animateCount(document.getElementById('timeSavedYear'), yearH);
  animateCount(document.getElementById('stHoursMonth'), monthH);
  animateCount(document.getElementById('stHoursSide'), monthH);
  const bar = document.getElementById('timeSavedBar');
  if (bar) bar.style.width = Math.min(100, monthH) + '%';
  const heroMonth = document.getElementById('heroTimeMonth');
  if (heroMonth && !accountUserId) heroMonth.textContent = '47';
}

function celebrateTimeSaved() {
  const host = document.getElementById('timeCelebrate');
  if (!host) return;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('span');
    p.className = 't-particle';
    p.style.left = (20 + Math.random() * 60) + '%';
    p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    p.style.setProperty('--dy', (-40 - Math.random() * 120) + 'px');
    p.style.background = ['var(--gold)', 'var(--green)', 'var(--peri)'][i % 3];
    host.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }
  if (typeof gsap !== 'undefined') {
    gsap.fromTo('#timePanel', { scale: 1 }, { scale: 1.02, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
  }
}

function setMissionLive(status, color) {
  const el = document.getElementById('logLive');
  if (!el) return;
  el.textContent = status;
  el.style.color = color || (status === 'RUNNING' ? 'var(--green)' : status === 'ERROR' ? 'var(--red)' : 'var(--muted2)');
}

function updateSetupChecklist() {
  const el = document.getElementById('setupChecklist');
  if (!el) return;
  const checks = [
    { key: '姓名', ok: !!getInputVal('applicantName') },
    { key: '萬用信', ok: !!getInputVal('universalLetter') },
    { key: '關鍵字', ok: !!parseKeywordsList(getInputVal('keywords')).length },
    { key: '來源 URL', ok: !!(getInputVal('searchUrl1') || getInputVal('searchUrl2') || getInputVal('searchUrl3')) },
    { key: 'Gmail', ok: !!getGmailUser() },
    { key: 'App PW', ok: !!getInputVal('appPassword') }
  ];
  el.innerHTML = checks.map(c =>
    `<span class="setup-pill ${c.ok ? 'done' : 'miss'}">${c.ok ? '✓' : '○'} ${c.key}</span>`
  ).join('');
}

async function testGmailConnection() {
  const { gmailUser, appPassword } = getLiveMailCreds();
  const resultEl = document.getElementById('gmailTestResult');
  if (!gmailUser || !appPassword) {
    if (resultEl) resultEl.textContent = '請先登入並填寫 App Password';
    return;
  }
  if (resultEl) resultEl.textContent = '驗證中...';
  setMissionLive('VERIFY', 'var(--peri)');
  try {
    const probe = await probeSendBackend();
    if (!probe.ok) throw new Error(probe.error);
    const res = await fetch(`${getSendBackendUrl()}/api/verify-smtp`, {
      method: 'POST',
      headers: getAccessHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ gmailUser, appPassword: normalizeAppPassword(appPassword) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = [data.error, data.details].filter(Boolean).join(' — ') || '驗證失敗';
      if (resultEl) resultEl.textContent = '✗ ' + err.slice(0, 80);
      setMissionLive('ERROR', 'var(--red)');
      appendLiveLog('Gmail 驗證失敗: ' + err, 'err');
      return;
    }
    if (resultEl) resultEl.textContent = '✓ Gmail 連線成功';
    setMissionLive('IDLE');
    appendLiveLog('Gmail App Password 驗證成功（SMTP port ' + (data.port || 465) + '）', 'ok');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (resultEl) resultEl.textContent = '✗ ' + msg.slice(0, 60);
    setMissionLive('ERROR', 'var(--red)');
    appendLiveLog('Gmail 測試失敗: ' + msg, 'err');
  }
}

function updateTierFromPortal(_newTier) {
  lockTierUI();
}

// Safe DOM read — prevents "Cannot read properties of null (reading 'value')"
function getInputVal(id, fallback = '') {
  const el = document.getElementById(id);
  return el && typeof el.value === 'string' ? el.value.trim() : fallback;
}

function isAdminAccount() {
  return accountUserId === 'admin' || !!state.isAdmin;
}

function isEmailAccountId(id) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(id || ''));
}

function getGmailUser() {
  if (!isAdminAccount() && isEmailAccountId(accountUserId)) {
    return accountUserId.toLowerCase().trim();
  }
  return getInputVal('gmailUser').toLowerCase().trim();
}

let automationRunInFlight = false;

async function automationFetch(path, options = {}) {
  const url = `${getAccessBackendUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: getAccessHeaders({
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }),
    cache: 'no-store'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('HTTP ' + res.status));
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function syncAutomationSettingsToServer(form) {
  if (!ensureAccessOrPrompt()) return null;
  const payload = {
    resume_url: form.cvUrl || state.cvUrl,
    cover_letter: form.universalLetter || state.universalLetter,
    keywords: form.keywords || state.keywords,
    source_urls: form.searchUrls || [],
    blacklist: form.blacklist || state.blacklist,
    applicant_name: form.applicantName || state.applicantName,
    gmail_email: form.gmailUser || getGmailUser()
  };
  if (form.appPassword) payload.app_password = form.appPassword;
  return automationFetch('/api/automation/settings', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function loadAutomationStatus() {
  const section = document.getElementById('automationSection');
  if (!section || !accountUserId) {
    if (section) section.style.display = 'none';
    return;
  }
  if (state.tier === 'lv1' || isAdminAccount()) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  try {
    const data = await automationFetch('/api/automation/status');
    state.dailyAutoEnabled = !!data.daily_auto_enabled;
    const cb = document.getElementById('dailyAutoEnabled');
    if (cb) cb.checked = state.dailyAutoEnabled;
    const nextEl = document.getElementById('automationNextRun');
    if (nextEl) {
      nextEl.textContent = state.dailyAutoEnabled
        ? ('下次自動執行時間：' + (data.next_run_label || '明天 09:00'))
        : '每日自動運行：已關閉';
      nextEl.style.color = state.dailyAutoEnabled ? 'var(--green)' : 'var(--muted2)';
    }
    await loadAutomationHistory();
  } catch (e) {
    console.warn('[SHINE automation] status load failed', e);
    const nextEl = document.getElementById('automationNextRun');
    if (nextEl) nextEl.textContent = '無法載入自動化狀態（請確認後端已啟動）';
  }
}

async function loadAutomationHistory() {
  const body = document.getElementById('automationHistoryBody');
  if (!body) return;
  try {
    const data = await automationFetch('/api/automation/history');
    const runs = data.runs || [];
    if (!runs.length) {
      body.innerHTML = '<tr><td colspan="6" class="automation-empty">尚無紀錄</td></tr>';
      return;
    }
    const triggerLabel = { scheduled: '排程', manual: '手動' };
    const statusLabel = { success: '成功', partial: '部分', failed: '失敗' };
    const statusClass = { success: 'status-ok', partial: 'status-partial', failed: 'status-fail' };
    body.innerHTML = runs.map(r => {
      const t = r.executed_at ? new Date(r.executed_at).toLocaleString('zh-HK') : '-';
      const sc = statusClass[r.status] || '';
      const sl = statusLabel[r.status] || r.status;
      return `<tr>
        <td>${t}</td>
        <td>${triggerLabel[r.trigger_type] || r.trigger_type}</td>
        <td>${r.jobs_scanned}</td>
        <td>${r.applications_sent}</td>
        <td>${r.skipped_blank}</td>
        <td class="${sc}">${sl}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = '<tr><td colspan="6" class="automation-empty status-fail">載入失敗</td></tr>';
  }
}

async function toggleDailyAuto(enabled) {
  const data = await automationFetch('/api/automation/daily-auto', {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  });
  state.dailyAutoEnabled = !!data.daily_auto_enabled;
  const nextEl = document.getElementById('automationNextRun');
  if (nextEl) {
    nextEl.textContent = state.dailyAutoEnabled
      ? ('下次自動執行時間：' + (data.next_run_label || '明天 09:00'))
      : '每日自動運行：已關閉';
  }
}

async function runAutomationNow() {
  if (automationRunInFlight) return;
  const btn = document.getElementById('automationRunNow');
  const statusEl = document.getElementById('automationRunStatus');
  automationRunInFlight = true;
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = '執行中…';
  try {
    const form = readFormSettings();
    await syncAutomationSettingsToServer(form);
    const result = await automationFetch('/api/automation/run-now', { method: 'POST', body: '{}' });
    const msg = result.dry_run
      ? `Dry-run：掃描 ${result.jobs_scanned}，將寄 ${result.would_send || 0}`
      : `完成：掃描 ${result.jobs_scanned || 0}，寄出 ${result.applications_sent || 0}`;
    if (statusEl) statusEl.textContent = msg;
    appendLiveLog('[自動化] ' + msg, result.status === 'failed' ? 'err' : 'ok');
    await loadAutomationHistory();
  } catch (e) {
    const msg = e.message || String(e);
    if (statusEl) statusEl.textContent = '✗ ' + msg.slice(0, 80);
    appendLiveLog('[自動化] 執行失敗: ' + msg, 'err');
  } finally {
    automationRunInFlight = false;
    if (btn) btn.disabled = false;
  }
}

function bindAutomationUI() {
  const cb = document.getElementById('dailyAutoEnabled');
  if (cb && !cb._shineBound) {
    cb._shineBound = true;
    cb.addEventListener('change', async () => {
      try {
        const form = readFormSettings();
        await syncAutomationSettingsToServer(form);
        await toggleDailyAuto(cb.checked);
      } catch (e) {
        cb.checked = !cb.checked;
        alert((e && e.message) || '無法更新每日自動運行設定');
      }
    });
  }
  const runBtn = document.getElementById('automationRunNow');
  if (runBtn && !runBtn._shineBound) {
    runBtn._shineBound = true;
    runBtn.addEventListener('click', () => runAutomationNow());
  }
}

function updateGmailSettingsUI() {
  const badge = document.getElementById('loggedInGmailBadge');
  const text = document.getElementById('loggedInGmailText');
  const adminHint = document.getElementById('gmailAdminHint');
  const gmailInput = document.getElementById('gmailUser');
  const email = getGmailUser();
  if (adminHint) {
    adminHint.style.display = isAdminAccount() ? 'block' : 'none';
  }
  if (!isAdminAccount() && isEmailAccountId(accountUserId)) {
    setInputVal('gmailUser', accountUserId);
    if (gmailInput) {
      gmailInput.readOnly = true;
      gmailInput.title = 'Gmail 已鎖定為登入帳號，不可更改';
    }
  } else if (gmailInput) {
    gmailInput.readOnly = false;
    gmailInput.title = '';
  }
  if (badge && text && email) {
    badge.style.display = 'block';
    text.textContent = email;
    setInputVal('gmailUser', email);
  } else if (badge) {
    badge.style.display = 'none';
    if (text) text.textContent = '';
    if (!isEmailAccountId(accountUserId) || isAdminAccount()) setInputVal('gmailUser', '');
  }
}

function setInputVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// Read live form values into state (scan/send always use latest user input)
function readFormSettings() {
  state.applicantName = getInputVal('applicantName');
  state.universalLetter = getInputVal('universalLetter');
  state.keywords = parseKeywordsList(getInputVal('keywords')).join(', ');
  state.blacklist = getInputVal('blacklist');
  state.cvUrl = getInputVal('cvUrl');
  state.scanOnLogin = !!(document.getElementById('scanOnLogin') && document.getElementById('scanOnLogin').checked);
  state.dailyAutoEnabled = !!(document.getElementById('dailyAutoEnabled') && document.getElementById('dailyAutoEnabled').checked);

  const collected = [];
  const maxU = getMaxSearchUrls();
  for (let i = 1; i <= 3; i++) {
    const v = getInputVal('searchUrl' + i);
    if (v) collected.push(v);
  }
  state.searchUrls = collected.slice(0, maxU).join('\n');

  return {
    applicantName: state.applicantName,
    universalLetter: state.universalLetter,
    keywords: state.keywords,
    blacklist: state.blacklist,
    cvUrl: state.cvUrl,
    searchUrls: collected.slice(0, maxU),
    gmailUser: getGmailUser(),
    appPassword: normalizeAppPassword(getInputVal('appPassword'))
  };
}

function validateScanSettings(form) {
  const errors = [];
  if (!form.applicantName) {
    errors.push('請填寫申請人姓名（NAME）');
  }
  if (!form.universalLetter) {
    errors.push('請填寫 Universal Cover Letter（必填，將 100% 原樣寄出）');
  }
  if (countWords(form.universalLetter) > MAX_LETTER_WORDS) {
    errors.push(`求職信不可超過 ${MAX_LETTER_WORDS} 字（目前約 ${countWords(form.universalLetter)} 字）`);
  }
  const kw = parseKeywordsList(form.keywords);
  if (!kw.length) {
    errors.push('請填寫至少 1 個關鍵字（最多 3 個，逗號分隔）');
  }
  if (!form.searchUrls.length) {
    errors.push('請在來源連結框至少填寫 1 個完整職位搜尋結果頁 URL（依方案最多 ' + getMaxSearchUrls() + ' 個）');
  }
  if (!form.gmailUser) {
    errors.push('請在設定區填寫 Gmail 寄信帳號');
  }
  if (!form.appPassword) {
    errors.push('請填寫 Gmail App Password（16 位應用程式密碼）');
  }
  return errors;
}

function ensurePortalVisible() {
  const portal = document.getElementById('portal');
  const beta = document.getElementById('beta-access');
  if (portal && portal.style.display === 'none') {
    portal.style.display = 'block';
    if (beta) beta.style.display = 'none';
  }
}

async function saveSettings() {
  readFormSettings();

  if (!state.universalLetter) {
    alert('Universal Cover Letter 為必填（SSOT 要求）。');
    return;
  }
  if (countWords(state.universalLetter) > MAX_LETTER_WORDS) {
    alert(`求職信不可超過 ${MAX_LETTER_WORDS} 字。`);
    return;
  }

  const form = readFormSettings();
  const appPw = form.appPassword;
  if (appPw) {
    try { sessionStorage.setItem(APP_PW_SESSION_KEY + '_' + getGmailUser(), appPw); } catch (_) {}
  }

  updateSourceInputs();
  saveState();
  updateWordCountUI();
  updateAutoScanStatusUI();
  updateSetupChecklist();

  if (!isAdminAccount() && state.tier !== 'lv1' && isAccessSessionValid()) {
    try {
      await syncAutomationSettingsToServer(form);
      appendLiveLog('伺服器自動化設定已同步（含加密 App Password）。', 'ok');
    } catch (e) {
      appendLiveLog('伺服器同步失敗: ' + (e.message || e), 'err');
    }
    await loadAutomationStatus();
  }

  const toast = document.getElementById('saveToast');
  if (toast) { toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 2600); }
  appendLiveLog('設定已儲存。求職信將 100% 原樣使用。', 'ok');
  updateQuotaUI();
}

function restoreAppPasswordFromSession() {
  if (!accountUserId) return;
  try {
    const pw = sessionStorage.getItem(APP_PW_SESSION_KEY + '_' + getGmailUser());
    if (pw) setInputVal('appPassword', pw);
  } catch (_) {}
}

function loadSettingsIntoForm() {
  setInputVal('applicantName', state.applicantName);
  setInputVal('universalLetter', state.universalLetter);
  setInputVal('keywords', state.keywords);
  setInputVal('blacklist', state.blacklist);
  setInputVal('cvUrl', state.cvUrl);
  const dailyEl = document.getElementById('dailyAutoEnabled');
  if (dailyEl) dailyEl.checked = !!state.dailyAutoEnabled;
  const loginScanEl = document.getElementById('scanOnLogin');
  if (loginScanEl) loginScanEl.checked = !!state.scanOnLogin;
  restoreAppPasswordFromSession();
  updateAutoScanStatusUI();

  const urls = (state.searchUrls || '').split('\n').map(u => u.trim()).filter(Boolean);
  for (let i = 0; i < 3; i++) {
    setInputVal('searchUrl' + (i + 1), urls[i] || '');
  }

  const tierSel = document.getElementById('tierSelect');
  if (tierSel) tierSel.value = state.tier || 'lv2';

  updateSourceInputs();
  updateQuotaUI();
}

// Secondary discovery helper (when user optionally provides extra key).
// Primary flow always uses the search source URLs the user explicitly provides.
async function realSearchAndExtract(keywords, deepseekKey, serpApiKey, backendUrl) {
  let jobs = [];

  // Optional keyword discovery (if user supplied extra key)
  if (serpApiKey) {
    try {
      const searchRes = await fetch(`${backendUrl}/api/search-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, serpApiKey })
      });
      const data = await searchRes.json();
      jobs = data.jobs || [];
    } catch (e) {
      console.warn('SerpApi failed, falling back to manual list');
    }
  }

  if (jobs.length === 0) {
    // No hard alert here; let startSafeApply outer logic + manual handle UX
    console.log('[SHINE] SerpApi returned 0 jobs or not used.');
    return [];
  }

  // Extraction for the secondary path (server handles the AI processing cost)
  const enriched = [];
  for (const job of jobs) {
    try {
      const extractRes = await fetch(`${backendUrl}/api/extract-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobText: `${job.title} ${job.company} ${job.description || job.snippet || ''}`,
          keywords,
          deepseekKey: deepseekKey || ''
        })
      });
      const extraction = await extractRes.json();
      if (extraction.apply_email && extraction.confidence >= 0.7) {
        enriched.push({
          ...job,
          apply_email: extraction.apply_email,
          confidence: extraction.confidence,
          reason: extraction.reason
        });
      }
    } catch (e) {
      console.error('Extraction failed for one job', e);
    }
  }
  return enriched;
}

let currentBatch = [];
let scanInFlight = false;
let lastScanBackendErrors = [];
let lastScanMeta = [];

async function startSafeApply() {
  if (!ensureAccessOrPrompt()) return;
  if (scanInFlight) {
    appendLiveLog('掃描進行中，請等待完成後再試（避免重複請求令職缺網站暫時封鎖）。', 'wait');
    if (typeof updateTaskProgress === 'function') updateTaskProgress('掃描進行中，請稍候完成後再按掃描…', true);
    return;
  }
  scanInFlight = true;
  lastScanBackendErrors = [];
  lastScanMeta = [];
  try {
  ensurePortalVisible();

  // Early force visible mission window + console so user is never "in the dark"
  const mwin = document.getElementById('missionProcessWindow');
  if (mwin) mwin.style.display = 'block';
  const lcon = document.getElementById('liveConsole');
  if (lcon) lcon.style.display = 'block';
  if (typeof updateTaskProgress === 'function') updateTaskProgress('開始自動掃描與準備申請... 正在收集設定');

  // Always read live form (no separate Save click required before scan)
  const form = readFormSettings();
  const validationErrors = validateScanSettings(form);
  if (validationErrors.length) {
    const msg = validationErrors.join('\n');
    if (typeof updateTaskProgress === 'function') updateTaskProgress('請先完成設定：' + validationErrors[0], true);
    alert('掃描前請先完成以下設定：\n\n' + msg);
    throw new Error(validationErrors[0]);
  }

  saveState();

  const backendUrl = BACKEND_URL;
  const gmailUser = form.gmailUser;
  const appPassword = form.appPassword;

  let results = [];
  let searchUrls = form.searchUrls.slice();
  const maxUrls = getMaxSearchUrls();

  if (searchUrls.length > maxUrls) {
    alert(`依你的方案（${state.tier.toUpperCase()}）最多允許 ${maxUrls} 個來源連結，系統將只使用前 ${maxUrls} 個。`);
    searchUrls = searchUrls.slice(0, maxUrls);
  }

  if (searchUrls.length > 0) {
    // Primary automation: use the exact search result pages the user provided (limited by their plan level).
    // SHINE automatically fetches the content and locates application contacts so user doesn't have to browse repeatedly.
    try {
      if (typeof updateTaskProgress === 'function') updateTaskProgress(`正在從你指定的 ${searchUrls.length} 個來源網站讀取內容...`);
      if (typeof appendLiveLog === 'function') appendLiveLog(`正在自動檢查你指定的 ${searchUrls.length} 個來源網站（你的方案限 ${maxUrls} 個）...`);
      appendLiveLog(`正在分頁掃描 ${searchUrls.length} 個來源（最近 3 個月，可能需 1–2 分鐘）...`, 'wait');
      const extractCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const extractTimer = extractCtrl ? setTimeout(() => extractCtrl.abort(), 180000) : null;
      const extractBody = JSON.stringify({ urls: searchUrls, keywords: state.keywords || '', blacklist: state.blacklist || '' });
      let data = null;
      for (let extractAttempt = 0; extractAttempt < 2; extractAttempt++) {
        const res = await fetch(`${backendUrl}/api/extract-from-search-urls`, {
          method: 'POST',
          headers: getAccessHeaders({ 'Content-Type': 'application/json' }),
          body: extractBody,
          signal: extractCtrl ? extractCtrl.signal : undefined
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          if (res.status === 401 || txt.includes('ACCESS_DENIED')) {
            ensureAccessOrPrompt();
            throw new Error('SHINE 登入密碼無效或已過期，請重新登入');
          }
          if (res.status === 404 || txt.includes('Cannot POST')) {
            throw new Error('掃描服務暫時無法使用。請稍後再試，或聯絡支援確認你的來源連結。');
          }
          throw new Error('掃描來源時發生問題');
        }
        data = await res.json();
        if (data && data.error) throw new Error(data.error);
        const metaErrors = (data.scan_meta || []).filter(m => m.error).map(m => m.error);
        lastScanBackendErrors = metaErrors;
        const gotJobs = (data.jobs || []).length > 0;
        if (gotJobs || !metaErrors.length || extractAttempt === 1) break;
        appendLiveLog('職缺網站暫時無法連線，5 秒後自動重試一次…', 'wait');
        if (typeof updateTaskProgress === 'function') updateTaskProgress('職缺網站連線失敗，5 秒後自動重試…');
        await sleep(5000);
      }
      if (extractTimer) clearTimeout(extractTimer);
      if (typeof updateTaskProgress === 'function') updateTaskProgress('來源已取得，正在分頁掃描（最近 3 個月職缺）並提取申請 email...');
      results = (data && data.jobs) || [];
      lastScanMeta = (data && data.scan_meta) || [];
      if (data && data.scan_meta && data.scan_meta.length) {
        const errors = lastScanBackendErrors;
        if (errors.length && !results.length) {
          const errMsg = errors[0];
          const hint = /TLS|socket disconnected|network|fetch failed|proxy|404|403|timeout/i.test(errMsg)
            ? '掃描伺服器無法連線職缺網站（已嘗試 VPS 中繼）。請等 1–2 分鐘後再按「開始自動掃描」，勿連續快速重試。'
            : errMsg;
          throw new Error(hint);
        }
        const summary = data.scan_meta.map(m => {
          if (m.error) return `來源錯誤：${m.error}`;
          return `來源：${m.pagesScanned || 1} 頁 / ${m.listJobsFound || 0} 職缺` +
            (m.listJobsAfterFilter != null ? `（關鍵字後 ${m.listJobsAfterFilter}）` : '') +
            ` / ${m.detailPagesFetched || 0} 詳情` +
            (m.cutoffDate ? ` · ${m.cutoffDate} 起` : '');
        }).join('；');
        appendLiveLog(summary, 'head');
        if (typeof updateTaskProgress === 'function') updateTaskProgress('分頁掃描完成：' + summary);
      } else if (typeof updateTaskProgress === 'function') {
        updateTaskProgress('掃描完成。整理結果、跨來源去重 + 歷史 LOG 比對...');
      }
    } catch (e) {
      console.error(e);
      if (typeof updateTaskProgress === 'function') updateTaskProgress('來源掃描遇到問題：' + (e.message || '請檢查連結'), true);
      alert('從你提供的來源連結分析職缺時遇到問題：' + (e.message || '請檢查連結是否正確有效。') + '\n\n你可以稍後再試，或使用手動加入職缺功能。');
      // Do not hard return; allow manual fallback if any
    }
  } else {
    const err = '未提供來源 URL（請在 1-3 個框填寫）';
    if (typeof updateTaskProgress === 'function') updateTaskProgress('錯誤：' + err, true);
    alert('請在上面的三個獨立來源框至少填寫一個完整職位搜尋結果頁連結（依你的方案自動限制數量）。');
    throw new Error(err);
  }

  // Merge manual jobs if user added any via the paste box (testers)
  if (window._pendingManual && window._pendingManual.length > 0) {
    results = results.concat(window._pendingManual);
    window._pendingManual = [];
  }

  // === DEDUP across sources (SSOT): JUMP + CTgoodjobs same vacancy → apply once (company + core title + email) ===
  function crossSiteDedupKey(job) {
    const company = String(job.company || '').toLowerCase().replace(/\s+/g, ' ').trim();
    let title = String(job.title || '').toLowerCase()
      .replace(/\s*[-–|]\s*.*ctgoodjobs.*$/i, '')
      .replace(/\s*[-–]\s*.+$/, '')
      .replace(/\b(aswo|swa|sswa)\s*(i{1,3}|ii|iii|iv)?\b/gi, ' ')
      .replace(/[()（）]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const email = String(job.apply_email || '').toLowerCase().trim();
    return email ? `${company}|${title}|${email}` : `${company}|${title}`;
  }
  const seen = new Set();
  let deduped = [];
  for (const j of results) {
    const key = crossSiteDedupKey(j);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(j);
  }

  // Sort by date newest first (as requested for processing order, date near to far)
  deduped.sort((a, b) => parseJobDate(b.date) - parseJobDate(a.date));

  // Cross-scan dedup against persistent sent history (LOG based)
  // Skip if same title+company already sent before (even on re-scan of same URL)
  deduped = deduped.filter(j => {
    const key = crossSiteDedupKey(j);
    return !sentHistory.some(s => crossSiteDedupKey(s) === key);
  });

  // Blacklist filter + require valid apply_email
  const bl = (state.blacklist || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  currentBatch = deduped.filter(j => {
    const company = (j.company || '').toLowerCase();
    const hasEmail = !!j.apply_email;
    const blacked = bl.some(b => company.includes(b));
    return hasEmail && !blacked;
  });

  const container = document.getElementById('previewArea');
  const list = document.getElementById('previewList');
  if (!container || !list) {
    const err = '預覽區載入失敗，請重新整理頁面後再試';
    if (typeof updateTaskProgress === 'function') updateTaskProgress(err, true);
    throw new Error(err);
  }
  list.innerHTML = '';
  showLiveConsole(true);
  setMissionLive('SCANNING');

  if (currentBatch.length === 0) {
    const histSkipped = results.length - deduped.length;
    if (typeof updateTaskProgress === 'function') updateTaskProgress(`掃描完成：找到 ${deduped.length} 個職缺，但 0 個有明確 email 可寄送。詳情見預覽。`);
    let zeroHint = '這次從你提供的來源連結沒有找到有明確申請 email 的職缺。';
    if (lastScanBackendErrors.length) {
      zeroHint = '職缺網站連線失敗（與 Gmail 無關）：' + lastScanBackendErrors[0] + '。請等 1–2 分鐘後再掃描；修改關鍵字後無需連續快速重試。';
    } else if (lastScanMeta.some(m => (m.listJobsFound || 0) > 0 && m.listJobsAfterFilter === 0)) {
      zeroHint = `已連線職缺網站，但關鍵字「${state.keywords || ''}」篩選後 0 筆符合。請調整關鍵字（例如保留「社工」）後再掃描。`;
    } else if (!results.length) {
      zeroHint = '後端掃描回傳 0 個職缺（常見：雲端伺服器暫時無法連線職缺網站，與 Gmail 帳號/App Password 無關）。請稍後再按「開始自動掃描」。';
    } else if (histSkipped > 0 && deduped.length === 0) {
      zeroHint = `後端找到 ${results.length} 個職缺，但全部已在你的發送紀錄（LOG）中寄過，故本次 0 封可寄。可換新來源或清除瀏覽器本機 LOG 後再試。`;
    }
    list.innerHTML = `
      <div style="color:#ef4444; padding:12px; border:1px solid #fecaca; background:#fef2f2; border-radius:8px;">
        ${zeroHint}<br><br>
        <strong>常見原因：</strong>職缺網站連線失敗、頁面為動態載入、已寄過去重、或職缺只提供線上申請。<br><br>
        <strong>建議：</strong>確認關鍵字與 URL 正確後重試；或使用「手動加入職缺」貼上含 email 的職缺。
      </div>
    `;
    if (deduped.length > 0) {
      list.innerHTML += `<div style="margin-top:12px; font-size:13px;"><strong>掃描找到但無法自動 email 的職缺（前幾個）：</strong></div>`;
      deduped.slice(0, 5).forEach(j => {
        const d = document.createElement('div');
        d.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;margin:4px 0;background:#fff;font-size:13px;';
        d.innerHTML = `<strong>${j.title || '職缺'}</strong> @ ${j.company || '公司'}<br><span style="color:#666">email: ${j.apply_email || '無'}</span>`;
        list.appendChild(d);
      });
    }
    container.style.display = 'block';
    appendLiveLog(`掃描完成。找到 ${deduped.length} 個職缺資訊，但 0 個有明確 email 可自動寄送。`);
    window._betaCreds = buildBetaCreds(gmailUser, appPassword);
    return;
  }

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:12px;align-items:center;margin-bottom:10px;font-size:13px;flex-wrap:wrap;';
  toolbar.innerHTML = `
    <button type="button" class="btn btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="shineSelectAllJobs(true)">全選</button>
    <button type="button" class="btn btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="shineSelectAllJobs(false)">全不選</button>
    <span id="selectedJobCount" style="color:#16a34a;font-weight:600;"></span>
  `;
  list.appendChild(toolbar);

  currentBatch.forEach((job, i) => {
    const exactBody = state.universalLetter + (state.cvUrl ? `\n\nCV 連結：${state.cvUrl}` : '');
    const div = document.createElement('div');
    div.className = 'job-preview-item';
    div.innerHTML = `
      <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;margin:0;">
        <input type="checkbox" class="job-send-check" data-job-idx="${i}" checked
          style="margin-top:4px;width:18px;height:18px;flex-shrink:0;"
          onchange="updateSelectedJobCountUI()">
        <div style="flex:1;">
          <strong>${job.title || '職缺'}</strong> @ ${job.company || '公司'} ${job.date ? '• ' + job.date : ''}<br>
          <span style="color:#16a34a;font-weight:600">申請 email: ${job.apply_email}</span><br>
          <details style="margin-top:6px"><summary style="cursor:pointer">預覽 100% 原樣信（點開）</summary>
            <div class="preview-box">${exactBody.replace(/\n/g,'<br>')}</div>
          </details>
          ${job.link ? `<div style="font-size:12px;margin-top:4px;"><a href="${job.link}" target="_blank" rel="noopener" onclick="event.stopPropagation()">查看原始職缺頁</a></div>` : ''}
        </div>
      </label>
    `;
    list.appendChild(div);
  });

  container.style.display = 'block';
  updateSelectedJobCountUI();

  // Store scan context; mail creds re-read from form at send time (fix8)
  window._betaCreds = buildBetaCreds(gmailUser, appPassword);
  window._lastSourceUrls = searchUrls || [];
  setMissionLive('PREVIEW');
  if (typeof updateTaskProgress === 'function') updateTaskProgress(`已處理好 ${currentBatch.length} 個職缺，請預覽確認`);
  appendLiveLog(`已處理好 ${currentBatch.length} 個職缺（去重完成），請預覽確認後寄出。`, 'head');
  alert(`SHINE 已自動從你提供的來源連結找出 ${currentBatch.length} 個適合的職缺並定位申請方式。\n\n請檢查預覽（每封都是你原封不動的信），確認後按「確認發送」即可用你的 Gmail 以自然節奏寄出。無需你再逐一瀏覽網站或手動抄電郵。`);
  } catch (err) {
    console.error('[SHINE] startSafeApply error:', err);
    const msg = err && err.message ? err.message : String(err);
    if (typeof updateTaskProgress === 'function') updateTaskProgress('掃描過程中遇到問題: ' + msg, true);
    throw err;
  } finally {
    scanInFlight = false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizeAppPassword(pw) {
  return String(pw || '').replace(/\s+/g, '').trim();
}

async function wakeBackend(backendUrl) {
  try {
    await fetch(`${backendUrl}/api/health`, { method: 'GET', cache: 'no-store' });
  } catch (_) {
    try { await fetch(`${backendUrl}/`, { method: 'GET', cache: 'no-store' }); } catch (_2) {}
  }
}

async function sleepWithBackendKeepalive(ms, backendUrl) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const chunk = Math.min(45000, end - Date.now());
    if (chunk <= 0) break;
    await sleep(chunk);
    if (Date.now() < end) await wakeBackend(backendUrl);
  }
}

async function postSendEmail(backendUrl, payload, retries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await wakeBackend(backendUrl);
      const sendRes = await fetch(`${backendUrl}/api/send-email`, {
        method: 'POST',
        headers: getAccessHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      let result;
      try {
        result = await sendRes.json();
      } catch (_) {
        throw new Error('伺服器回應異常 (HTTP ' + sendRes.status + ')');
      }
      if (!sendRes.ok) {
        const msg = [result.error, result.details].filter(Boolean).join(' — ');
        throw new Error(msg || ('HTTP ' + sendRes.status));
      }
      return result;
    } catch (e) {
      lastErr = e;
      const msg = e && e.message ? e.message : String(e);
      const isNetwork = /failed to fetch|network|load failed/i.test(msg);
      if (attempt < retries && isNetwork) {
        appendLiveLog(`寄送連線失敗，${attempt}/${retries} 次重試中（喚醒伺服器）...`, 'wait');
        if (typeof updateTaskProgress === 'function') {
          updateTaskProgress(`連線中斷，正在重試 (${attempt}/${retries})...`);
        }
        await sleep(5000 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Send failed');
}

function getSelectedJobsForSend() {
  const checks = document.querySelectorAll('.job-send-check');
  const selected = [];
  checks.forEach(cb => {
    if (!cb.checked) return;
    const i = parseInt(cb.getAttribute('data-job-idx'), 10);
    if (!isNaN(i) && currentBatch[i]) selected.push(currentBatch[i]);
  });
  return selected;
}

function updateSelectedJobCountUI() {
  const n = getSelectedJobsForSend().length;
  const total = currentBatch.length;
  const el = document.getElementById('selectedJobCount');
  if (el) el.textContent = `已選 ${n} / ${total} 封`;
  const btn = document.querySelector('#previewArea .btn-primary.full');
  if (btn) btn.textContent = n > 0 ? `確認發送已選 ${n} 封（自然節奏）` : '請勾選至少 1 個職缺';
}

function shineSelectAllJobs(checked) {
  document.querySelectorAll('.job-send-check').forEach(cb => { cb.checked = checked; });
  updateSelectedJobCountUI();
}

async function confirmAndSendBatch() {
  if (!ensureAccessOrPrompt()) return;
  if (!currentBatch.length || !window._betaCreds) {
    alert('沒有可寄送的職缺。請先完成掃描並在預覽中確認。');
    return;
  }

  const jobsToSend = getSelectedJobsForSend();
  if (!jobsToSend.length) {
    alert('請至少勾選 1 個要寄送的職缺。已取消勾選的職缺不會寄出。');
    return;
  }

  const mailBackend = getSendBackendUrl();
  const { gmailUser, appPassword } = getLiveMailCreds();
  const cvUrl = state.cvUrl || window._betaCreds.cvUrl || '';
  if (!gmailUser || !appPassword) {
    alert('缺少 Gmail 設定。請在下方填寫 Gmail App Password（16 位），然後再按「確認發送」。');
    if (typeof updateTaskProgress === 'function') updateTaskProgress('缺少 Gmail App Password，無法寄送', true);
    return;
  }
  if (appPassword.length < 16) {
    alert('App Password 應為 16 位（可含空格，系統會自動移除）。請重新貼上 Google 產生的應用程式密碼。');
    return;
  }

  const probe = await probeSendBackend();
  if (!probe.ok) {
    const errMsg = '無法連線寄信服務 (' + probe.url + '): ' + probe.error;
    alert(errMsg);
    if (typeof updateTaskProgress === 'function') updateTaskProgress(errMsg, true);
    return;
  }

  try {
    if (typeof updateTaskProgress === 'function') updateTaskProgress('正在驗證 Gmail App Password...');
    const verifyRes = await fetch(`${mailBackend}/api/verify-smtp`, {
      method: 'POST',
      headers: getAccessHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ gmailUser, appPassword: normalizeAppPassword(appPassword) })
    });
    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !verifyData.ok) {
      const vErr = [verifyData.error, verifyData.details].filter(Boolean).join(' — ') || 'Gmail 驗證失敗';
      alert('Gmail App Password 驗證失敗：\n\n' + vErr + '\n\n請確認：\n1. 已開啟兩步驟驗證\n2. 使用「郵件」類型的應用程式密碼（16 位）\n3. 帳號與登入 Gmail 一致');
      if (typeof updateTaskProgress === 'function') updateTaskProgress('Gmail 驗證失敗: ' + vErr, true);
      return;
    }
    appendLiveLog('Gmail App Password 驗證成功，開始批次寄送...', 'ok');
  } catch (ve) {
    const vm = ve && ve.message ? ve.message : String(ve);
    alert('無法驗證 Gmail 連線：' + vm);
    return;
  }
  const container = document.getElementById('previewArea');
  const limit = getQuotaLimit();
  let sent = 0;

  sessionSkipCount = currentBatch.length - jobsToSend.length;
  const stSkip = document.getElementById('stSkip');
  if (stSkip) stSkip.textContent = String(sessionSkipCount);

  appendLiveLog('開始批次寄送（第一封即時，之後每 60 秒）...', 'head');
  setMissionLive('RUNNING');
  if (typeof updateTaskProgress === 'function') updateTaskProgress(`準備寄送 ${jobsToSend.length} 封（已排除 ${sessionSkipCount} 封）`);

  for (const job of jobsToSend) {
    if (state.successfulThisMonth >= limit) {
      alert('已達到本月額度上限。');
      break;
    }

    const idx = jobsToSend.indexOf(job) + 1;
    if (typeof updateTaskProgress === 'function') updateTaskProgress(`Mission ${idx}/${jobsToSend.length}：準備寄送「${job.title}」@ ${job.company}`);

    appendLiveLog(`準備寄出給：${job.title} @ ${job.company}`);

    // Pacing: 1st email immediate; then fixed 60s between sends
    const delay = idx === 1 ? 0 : SEND_DELAY_MS;
    const delaySec = Math.round(delay / 1000);
    if (delay > 0) {
      if (typeof updateTaskProgress === 'function') updateTaskProgress(`等待 ${delaySec}s 後寄出下一封...`);
      appendLiveLog(`等待 ${delaySec} 秒後寄出...`, 'wait');
      await sleepWithBackendKeepalive(delay, mailBackend);
    } else {
      if (typeof updateTaskProgress === 'function') updateTaskProgress('第一封即時寄出...');
      appendLiveLog('第一封即時寄出（無等待）...', 'wait');
      await wakeBackend(mailBackend);
    }

    // SSOT: body = universal letter 100% 原樣 + CV line (user can embed CV in letter too)
    const exactBody = state.universalLetter + (cvUrl ? `\n\nCV 連結：${cvUrl}` : '');
    const subject = `Application to ${job.title}`;
    const cleanPass = normalizeAppPassword(appPassword);

    try {
      if (typeof updateTaskProgress === 'function') updateTaskProgress(`正在用 Gmail 寄出第 ${idx} 封至 ${job.apply_email} ...`);
      appendLiveLog(`正在用你的 Gmail 寄出至 ${job.apply_email} ...`);
      const result = await postSendEmail(mailBackend, {
        to: job.apply_email,
        subject,
        body: exactBody,
        gmailUser,
        appPassword: cleanPass
      });

      if (result.success) {
        state.successfulThisMonth++;
        state.hoursSavedThisYear += HOURS_SAVED_PER_SEND;
        celebrateTimeSaved();
        state.logs.unshift({
          time: new Date().toISOString(),
          title: job.title,
          company: job.company,
          email: job.apply_email,
          body: exactBody,
          delay_seconds: delaySec,
          status: 'sent (real)'
        });

        // Record to persistent sent history for cross-scan dedup + LOG.txt
        sentHistory.unshift({
          title: job.title,
          company: job.company,
          email: job.apply_email,
          date: job.date,
          sentAt: new Date().toISOString(),
          sourceUrl: (window._lastSourceUrls && window._lastSourceUrls[0]) || ''
        });
        saveSentHistory();

        if (typeof updateTaskProgress === 'function') updateTaskProgress(`成功寄出第 ${idx} 封 → ${job.apply_email}（${delaySec}s）`);
        appendLiveLog(`已成功寄出 → ${job.apply_email}（耗時 ${delaySec}s）`, 'ok');

        saveState();
        updateQuotaUI();
        sent++;
      } else {
        throw new Error(result.error || '寄送失敗');
      }
    } catch (e) {
      let hint = e && e.message ? e.message : String(e);
      if (/failed to fetch|network|load failed|aborted/i.test(hint)) {
        hint += '（寄信服務連線失敗；請確認網路並檢查 App Password）';
      } else if (/invalid login|authentication|credentials|535|534/i.test(hint)) {
        hint += '（請確認 Gmail App Password 正確，並已移除多餘空格）';
      } else if (/timeout|SMTP|連線逾時/i.test(hint)) {
        hint += '（若仍失敗，請重新產生 Google 應用程式密碼）';
      }
      if (typeof updateTaskProgress === 'function') updateTaskProgress(`第 ${idx} 封寄送失敗: ${hint}`, true);
      appendLiveLog(`寄送失敗: ${job.apply_email} - ${hint}`, 'skip');
      sessionSkipCount++;
      const sk = document.getElementById('stSkip');
      if (sk) sk.textContent = String(sessionSkipCount);
    }
  }

  container.style.display = 'none';
  currentBatch = [];
  delete window._betaCreds;
  setMissionLive('DONE');
  if (typeof updateTaskProgress === 'function') updateTaskProgress(`完成！成功寄出 ${sent} 封`);
  appendLiveLog(`全部完成！成功寄出 ${sent} 封（100% 原樣求職信）。`, 'head');
  alert(`完成！這次成功寄出 ${sent} 封。\n\nSHINE 已幫你省下反覆瀏覽網站、尋找電郵、手動一封封寄信的時間。所有信都是你自己寫的內容，完全沒有修改。`);
}

// Public pricing CTA — tier is bound to account after login
function selectTier(_t) {
  const entry = document.getElementById('beta-access');
  const loginCard = document.getElementById('shineLogin');
  if (entry) entry.scrollIntoView({ behavior: 'smooth' });
  if (loginCard) {
    loginCard.style.display = 'block';
    if (entry) entry.style.display = 'none';
  }
}

function updateSourceInputs() {
  const max = getMaxSearchUrls();
  for (let i = 1; i <= 3; i++) {
    const input = document.getElementById('searchUrl' + i);
    if (!input) continue;
    if (i > max) {
      input.disabled = true;
      input.value = '';
      input.placeholder = `（此方案上限 ${max} 個，此欄不啟用）`;
    } else {
      input.disabled = false;
      if (input.placeholder.includes('不啟用') || !input.placeholder) {
        input.placeholder = `https://... 第 ${i} 個完整搜尋結果頁連結`;
      }
    }
  }
}

function updateTaskProgress(msg, isError) {
  const prog = document.getElementById('liveTaskProgress');
  const win = document.getElementById('missionProcessWindow');
  if (prog) prog.textContent = msg;
  if (win) win.classList.toggle('is-error', !!isError);
  const stToday = document.getElementById('stToday');
  if (stToday) stToday.textContent = isError ? '錯誤' : (msg.length > 18 ? msg.slice(0, 18) + '…' : msg);
  if (isError) setMissionLive('ERROR', 'var(--red)');
}

async function loginWithShine() {
  const userId = getInputVal('loginUserId').toLowerCase();
  const accessPassword = getInputVal('loginAccessPassword');
  if (!userId || userId.length < 2) {
    alert('請輸入 SHINE 帳號 ID（由 2C-AI 開通時提供）。');
    return;
  }
  if (!accessPassword) {
    alert('請輸入密碼。');
    return;
  }
  let session;
  try {
    session = await verifyShineAccess(userId, accessPassword);
  } catch (e) {
    alert((e && e.message) || '帳號 ID 或密碼不正確。');
    return;
  }

  accountUserId = session.userId || userId;
  state.isAdmin = !!(session.is_admin || accountUserId === 'admin');
  localStorage.setItem(SHINE_USER_ID_KEY, accountUserId);
  localStorage.removeItem('shine_active_account');

  loadState();
  applyAccountTier(session.tier || state.tier);
  loadSettingsIntoForm();
  loadSentHistory();
  updateQuotaUI();
  updateWordCountUI();
  updateGmailSettingsUI();

  const loginCard = document.getElementById('shineLogin');
  const portal = document.getElementById('portal');
  const entry = document.getElementById('beta-access');
  if (loginCard) loginCard.style.display = 'none';
  if (portal) portal.style.display = 'block';
  if (entry) entry.style.display = 'none';
  const site = document.getElementById('site');
  if (site) site.style.display = 'none';

  updatePlanChip();
  setupAutoScanScheduler();
  updateAutoScanStatusUI();
  updateGmailSettingsUI();
  await loadAutomationStatus();

  const settingsCard = document.querySelector('#portal .card');
  if (settingsCard) settingsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (state.scanOnLogin) {
    const started = await tryScanOnLogin();
    if (!started) {
      alert('登入成功！\n\n已開啟「登入後立即掃描」，但設定尚未完整。請補齊姓名、關鍵字、萬用信、來源 URL、Gmail 與 App Password。');
    }
  }
}

async function loginWithGmail() {
  return loginWithShine();
}

function logoutShine() {
  accountUserId = '';
  localStorage.removeItem(SHINE_USER_ID_KEY);
  localStorage.removeItem('shine_active_account');
  clearAccessSession();
  setInputVal('appPassword', '');
  updateGmailSettingsUI();
  const loginCard = document.getElementById('shineLogin');
  const portal = document.getElementById('portal');
  const site = document.getElementById('site');
  if (portal) portal.style.display = 'none';
  if (loginCard) loginCard.style.display = 'none';
  if (site) site.style.display = 'block';
  const entry = document.getElementById('beta-access');
  if (entry) entry.style.display = 'block';
}

function updateWordCountUI() {
  const el = document.getElementById('letterWordCount');
  const letter = getInputVal('universalLetter') || state.universalLetter || '';
  const n = countWords(letter);
  if (el) {
    el.textContent = `約 ${n} / ${MAX_LETTER_WORDS} 字`;
    el.style.color = n > MAX_LETTER_WORDS ? '#ef4444' : '#6b7280';
  }
}

function getSettingsMissingForScan() {
  const missing = [];
  if (!state.applicantName) missing.push('姓名');
  if (!state.universalLetter) missing.push('萬用信');
  if (!state.searchUrls) missing.push('來源 URL');
  if (!parseKeywordsList(state.keywords).length) missing.push('關鍵字');
  if (!getGmailUser()) missing.push('Gmail 寄信帳號');
  if (!getInputVal('appPassword')) missing.push('App Password');
  return missing;
}

function updateAutoScanStatusUI() {
  const el = document.getElementById('autoScanStatus');
  if (!el) return;
  const parts = [];
  const missing = getSettingsMissingForScan();

  if (state.scanOnLogin) {
    parts.push(missing.length
      ? '登入後立即掃描：已開啟，尚缺 ' + missing.join('、')
      : '登入後立即掃描：已開啟，下次登入將自動開始');
  } else {
    parts.push('登入後立即掃描：已關閉');
  }

  el.style.color = missing.length && state.scanOnLogin ? '#b45309' : '#166534';
  el.textContent = parts.join(' · ');
}

async function tryScanOnLogin() {
  if (!state.scanOnLogin) return false;
  restoreAppPasswordFromSession();
  const form = readFormSettings();
  const errors = validateScanSettings(form);
  if (errors.length) {
    if (typeof updateTaskProgress === 'function') {
      updateTaskProgress('登入後立即掃描：設定未完整 — ' + errors[0], true);
    }
    return false;
  }
  const mwin = document.getElementById('missionProcessWindow');
  if (mwin) mwin.style.display = 'block';
  if (typeof showLiveConsole === 'function') showLiveConsole(true);
  if (typeof updateTaskProgress === 'function') {
    updateTaskProgress('登入後立即掃描：設定已完整，正在啟動...');
  }
  try {
    await startSafeApply();
    return true;
  } catch (e) {
    console.warn('[SHINE] scan on login failed', e);
    return false;
  }
}

function setupAutoScanScheduler() {
  const loginScanEl = document.getElementById('scanOnLogin');
  if (loginScanEl && !loginScanEl._shineBound) {
    loginScanEl._shineBound = true;
    loginScanEl.addEventListener('change', () => { readFormSettings(); updateAutoScanStatusUI(); saveState(); });
  }
  bindAutomationUI();
}

function restoreSessionFromToken() {
  const savedId = localStorage.getItem(SHINE_USER_ID_KEY) || localStorage.getItem('shine_active_account');
  if (!savedId || !isAccessSessionValid()) return false;

  accountUserId = savedId.toLowerCase().trim();
  setInputVal('loginUserId', accountUserId);
  loadState();

  fetch(`${getAccessBackendUrl()}/api/access-status`, {
    headers: getAccessHeaders(),
    cache: 'no-store'
  }).then(r => r.json()).then(data => {
    if (data.tier) {
      localStorage.setItem(ACCESS_TIER_KEY, data.tier);
      applyAccountTier(data.tier);
      updatePlanChip();
    }
  }).catch(() => {});

  loadSettingsIntoForm();
  loadSentHistory();
  applyAccountTier(getStoredAccessTier() || 'lv2');

  const portal = document.getElementById('portal');
  const loginCard = document.getElementById('shineLogin');
  if (portal) portal.style.display = 'block';
  if (loginCard) loginCard.style.display = 'none';
  const entry = document.getElementById('beta-access');
  if (entry) entry.style.display = 'none';
  const site = document.getElementById('site');
  if (site) site.style.display = 'none';
  updatePlanChip();
  setupAutoScanScheduler();
  updateGmailSettingsUI();
  loadAutomationStatus().catch(() => {});
  return true;
}

// Init
function init() {
  const legacy = localStorage.getItem('shine_active_account');
  if (legacy && !localStorage.getItem(SHINE_USER_ID_KEY)) {
    localStorage.setItem(SHINE_USER_ID_KEY, legacy);
  }

  if (!restoreSessionFromToken()) {
    if (legacy) {
      setInputVal('loginUserId', legacy);
      clearAccessSession();
      localStorage.removeItem('shine_active_account');
      localStorage.removeItem(SHINE_USER_ID_KEY);
    }
    const portal = document.getElementById('portal');
    if (portal) portal.style.display = 'none';
  }

  updateQuotaUI();
  updateWordCountUI();
  updateGmailSettingsUI();
  updateAutoScanStatusUI();
  updateSetupChecklist();
  lockTierUI();

  const letterEl = document.getElementById('universalLetter');
  if (letterEl) letterEl.addEventListener('input', () => { updateWordCountUI(); updateSetupChecklist(); });
  ['applicantName', 'keywords', 'searchUrl1', 'searchUrl2', 'searchUrl3', 'gmailUser', 'appPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateSetupChecklist);
  });

  updatePlanChip();
  bindAutomationUI();

  // Demo: show some previous logs
  const logsEl = document.getElementById('logs');
  if (logsEl) {
    if (state.logs.length === 0) {
      logsEl.innerHTML = '<div class="log-entry" style="color:#64748b">尚未有發送紀錄。點擊「開始自動掃描與準備申請」試用。可下載 LOG.txt 記錄已發送職缺。</div>';
    } else {
      state.logs.forEach(log => {
        logsEl.innerHTML += `<div class="log-entry">${new Date(log.time).toLocaleString()} → ${log.email} （延遲 ${log.delay_seconds}s）</div>`;
      });
    }
  }

  console.log('%c[SHINE v' + SHINE_VERSION + '] Ready. Pacing: 1st immediate, then 60s. Send via ' + getSendBackendUrl(), 'color:#16a34a');
}

// Hero console — SHINE(pro) signature streaming demo
function startHeroConsole() {
  if (window.SHINE_MOTION && window.SHINE_MOTION.usesHeroScrub) return;
  const el = document.getElementById('heroLog');
  if (!el) return;
  const script = [
    ['09:01:02', 'head', '啟動代理 · 讀取你指定的來源連結'],
    ['09:01:04', '', '掃描 jump.mingpao.com → 關鍵字「社工」'],
    ['09:01:07', '', '找到 11 個職位 · 跟隨詳情頁提取 email'],
    ['09:01:10', '', '職位 #1 → recruit@tpbcss.org'],
    ['09:01:12', 'ok', '✓ 已發送 · 駐校社工 — 循道衛理'],
    ['09:01:13', 'wait', '等待 60 秒（人類節奏）…'],
    ['09:02:15', 'skip', '職位 #2 · 無公開電郵 → 跳過'],
    ['09:02:18', 'ok', '✓ 已發送 · 學校社工 ASWO'],
    ['09:02:20', 'head', '本輪完成 · 預覽確認後批次寄出'],
  ];
  let i = 0;
  function add() {
    if (i >= script.length) {
      setTimeout(() => { el.innerHTML = ''; i = 0; add(); }, 2800);
      return;
    }
    const [ts, cls, msg] = script[i];
    const d = document.createElement('div');
    d.className = 'ln ' + (cls || '');
    d.innerHTML = `<span class="ts">[${ts}]</span><span class="msg">${msg}${i === script.length - 1 ? '<span class="cur"></span>' : ''}</span>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
    i++;
    const delay = cls === 'wait' ? 1100 : cls === 'ok' ? 750 : 550;
    setTimeout(add, delay);
  }
  setTimeout(add, 600);
}

window.onload = async () => {
  await fetchAccessStatus();
  init();
  if (window.SHINE_MOTION && window.SHINE_MOTION.usesHeroScrub) return;
  startHeroConsole();
};

// Expose
window.SHINE = { state, saveSettings, startSafeApply, readFormSettings, getInputVal, getGmailUser, loginWithShine, loginWithGmail, logoutShine, updateTimeSavingsUI, celebrateTimeSaved, saveAndRun, SHINE_VERSION };
window.loginWithShine = loginWithShine;
window.loginWithGmail = loginWithGmail;
window.logoutShine = logoutShine;
window.getGmailUser = getGmailUser;
window.shineSelectAllJobs = shineSelectAllJobs;
window.updateSelectedJobCountUI = updateSelectedJobCountUI;
window.testGmailConnection = testGmailConnection;
window.setMissionLive = setMissionLive;
window.updateSetupChecklist = updateSetupChecklist;
window.updateTimeSavingsUI = updateTimeSavingsUI;

function saveAndRun() {
  saveSettings();
  if (scanInFlight) {
    appendLiveLog('設定已儲存。掃描進行中，完成後請再按掃描以套用新關鍵字。', 'wait');
    if (typeof updateTaskProgress === 'function') updateTaskProgress('設定已儲存。掃描進行中，請稍候…');
    return;
  }
  const btn = document.getElementById('scanBtn');
  if (btn && !btn.disabled) btn.click();
}
window.saveAndRun = saveAndRun;

function addManualJobs() {
  const text = getInputVal('manualJobs');
  if (!text) return;

  const lines = text.split('\n').filter(l => l.trim());
  const manualJobs = lines.map(line => {
    const parts = line.split('|').map(p => p.trim());
    // Try extract email from any part of the line (for manual tester convenience)
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    return {
      title: parts[0] || '未知職位',
      company: parts[1] || '未知公司',
      description: parts[2] || '',
      apply_email: email,
      confidence: email ? 0.92 : 0.4
    };
  });

  if (!window._pendingManual) window._pendingManual = [];
  window._pendingManual = window._pendingManual.concat(manualJobs);

  alert(`已加入 ${manualJobs.length} 個手動職缺。按「開始掃描與申請」時會一起處理（需有 email 才會進入預覽）。`);
  setInputVal('manualJobs', '');
}

// Live log — primary: dashLog (SHINE pro mission panel)
function appendLiveLog(msg, type = '') {
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dashEl = document.getElementById('dashLog');
  const liveEl = document.getElementById('liveLog');
  const logsEl = document.getElementById('logs');

  if (dashEl) {
    const placeholder = dashEl.querySelector('.ln .msg.muted');
    if (placeholder && placeholder.textContent.includes('填好設定')) dashEl.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'ln ' + type;
    d.innerHTML = `<span class="ts">[${time}]</span><span class="msg">${msg}</span>`;
    dashEl.appendChild(d);
    dashEl.scrollTop = dashEl.scrollHeight;
  }
  if (liveEl) {
    const d = document.createElement('div');
    d.className = 'ln ' + type;
    d.innerHTML = `<span class="ts">[${time}]</span><span class="msg">${msg}</span>`;
    liveEl.appendChild(d);
    liveEl.scrollTop = liveEl.scrollHeight;
  }
  if (logsEl && (type === 'ok' || type === 'head' || type === 'err' || type === 'skip')) {
    logsEl.innerHTML = `<div class="log-entry">[${time}] ${msg}</div>` + logsEl.innerHTML;
  }
}

function showLiveConsole(show = true) {
  setMissionLive(show ? 'RUNNING' : 'IDLE');
  const c = document.getElementById('liveConsole');
  if (c) c.style.display = show ? 'block' : 'none';
}
