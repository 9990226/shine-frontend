// SHINE 出眾 — Full SSOT Compliant Frontend
// Static-friendly for Hostinger /shine (2c-ai.com/shine)
// Key guarantees:
// - User provides up to 1/2/3 source search page URLs (by plan level)
// - Tool automatically processes those sources to find application contacts (user never has to browse repeatedly or hunt emails manually)
// - Universal Cover Letter sent 100% EXACT (no modification whatsoever)
// - 2C-AI covers the AI processing costs for paid tiers; users never input or see any AI API key
// - Backend address completely hidden from UI
// - Human-mimicking pacing (30-180s variable), success-only quota, exact preview, dedup across sources
// - One account = one sender via user's own Gmail App Password
// - Minimal persisted data (localStorage)

const SHINE_VERSION = '20260615fix3';
const STORAGE_KEY = 'shine_ssot_v1';

// Hardcoded backend for production beta. Never shown to users.
// 2C-AI covers DeepSeek costs for paid tiers; users never provide or see any DeepSeek key.
const BACKEND_URL = 'https://shine-backend-byii.onrender.com';

let state = {
  tier: 'lv2',                    // lv1=60/1url, lv2=100/2url, lv3=unlimited/3url (SSOT level-based)
  universalLetter: '',
  keywords: '',
  blacklist: '',
  searchUrls: '',                 // joined \n from the three independent URL boxes
  cvUrl: '',
  successfulThisMonth: 42,        // demo starting value
  logs: []
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) state = { ...state, ...JSON.parse(saved) };
  // Enforce quota based on tier (SSOT)
  if (state.tier === 'lv1' && state.successfulThisMonth > 60) state.successfulThisMonth = 60;
  if (state.tier === 'lv2' && state.successfulThisMonth > 100) state.successfulThisMonth = 100;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getQuotaLimit() {
  if (state.tier === 'lv1') return 60;
  if (state.tier === 'lv2') return 100;
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
    sentHistory = JSON.parse(localStorage.getItem('shine_sent_history') || '[]');
  } catch (e) {
    sentHistory = [];
  }
}

function saveSentHistory() {
  localStorage.setItem('shine_sent_history', JSON.stringify(sentHistory));
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
  const pct = limit === 999999 ? 100 : Math.min(100, (used / limit) * 100);

  const el = document.getElementById('quotaDisplay');
  if (el) el.innerHTML = `
    <strong>${used} / ${limit === 999999 ? '無限' : limit}</strong> 已用 
    <span style="color:#16a34a">剩餘 ${remaining}</span> 封（本月成功發送）
  `;
  const bar = document.getElementById('quotaBar');
  if (bar) bar.style.width = pct + '%';
}

function updateTierFromPortal(newTier) {
  state.tier = newTier;
  saveState();
  updateQuotaUI();
  updateSourceInputs();
}

// Safe DOM read — prevents "Cannot read properties of null (reading 'value')"
function getInputVal(id, fallback = '') {
  const el = document.getElementById(id);
  return el && typeof el.value === 'string' ? el.value.trim() : fallback;
}

function setInputVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// Read live form values into state (scan/send always use latest user input)
function readFormSettings() {
  state.universalLetter = getInputVal('universalLetter');
  state.keywords = getInputVal('keywords');
  state.blacklist = getInputVal('blacklist');
  state.cvUrl = getInputVal('cvUrl');

  const tierSel = document.getElementById('tierSelect');
  if (tierSel) state.tier = tierSel.value;

  const collected = [];
  const maxU = getMaxSearchUrls();
  for (let i = 1; i <= 3; i++) {
    const v = getInputVal('searchUrl' + i);
    if (v) collected.push(v);
  }
  state.searchUrls = collected.slice(0, maxU).join('\n');

  return {
    universalLetter: state.universalLetter,
    keywords: state.keywords,
    blacklist: state.blacklist,
    cvUrl: state.cvUrl,
    searchUrls: collected.slice(0, maxU),
    gmailUser: getInputVal('gmailUser'),
    appPassword: getInputVal('appPassword')
  };
}

function validateScanSettings(form) {
  const errors = [];
  if (!form.universalLetter) {
    errors.push('請填寫 Universal Cover Letter（必填，將 100% 原樣寄出）');
  }
  if (!form.searchUrls.length) {
    errors.push('請在來源連結框至少填寫 1 個完整職位搜尋結果頁 URL（依方案最多 ' + getMaxSearchUrls() + ' 個）');
  }
  if (!form.gmailUser) {
    errors.push('請填寫 Gmail 電郵（用你的信箱寄出申請信）');
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

function saveSettings() {
  readFormSettings();

  if (!state.universalLetter) {
    alert('Universal Cover Letter 為必填（SSOT 要求）。');
    return;
  }

  updateSourceInputs();
  saveState();
  alert('設定已儲存。Universal Cover Letter 將 100% 原樣使用。');
  updateQuotaUI();
}

function loadSettingsIntoForm() {
  setInputVal('universalLetter', state.universalLetter);
  setInputVal('keywords', state.keywords);
  setInputVal('blacklist', state.blacklist);
  setInputVal('cvUrl', state.cvUrl);

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

async function startSafeApply() {
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
      const res = await fetch(`${backendUrl}/api/extract-from-search-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: searchUrls, keywords: state.keywords || '' })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (res.status === 404 || txt.includes('Cannot POST')) {
          throw new Error('掃描服務暫時無法使用。請稍後再試，或聯絡支援確認你的來源連結。');
        }
        throw new Error('掃描來源時發生問題');
      }
      if (typeof updateTaskProgress === 'function') updateTaskProgress('來源內容已取得，正在呼叫 DeepSeek 分析職缺、日期與申請 email...');
      const data = await res.json();
      if (data && data.error) throw new Error(data.error);
      results = (data && data.jobs) || [];
      if (typeof updateTaskProgress === 'function') updateTaskProgress('DeepSeek 分析完成。整理結果、跨來源去重 + 歷史 LOG 比對...');
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

  // === DEDUP across sources (SSOT critical): same job (title + company) from different sites = apply only once ===
  const seen = new Set();
  let deduped = [];
  for (const j of results) {
    const normTitle = (j.title || '').toLowerCase().trim();
    const normCompany = (j.company || '').toLowerCase().trim();
    const key = normTitle + '|' + normCompany;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(j);
  }

  // Sort by date newest first (as requested for processing order, date near to far)
  deduped.sort((a, b) => parseJobDate(b.date) - parseJobDate(a.date));

  // Cross-scan dedup against persistent sent history (LOG based)
  // Skip if same title+company already sent before (even on re-scan of same URL)
  deduped = deduped.filter(j => {
    const key = (j.title || '').toLowerCase().trim() + '|' + (j.company || '').toLowerCase().trim();
    return !sentHistory.some(s => {
      const skey = (s.title || '').toLowerCase().trim() + '|' + (s.company || '').toLowerCase().trim();
      return skey === key;
    });
  });

  // Blacklist filter + require valid apply_email (high confidence already enforced by backend for URL path)
  const bl = (state.blacklist || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  currentBatch = deduped.filter(j => {
    const company = (j.company || '').toLowerCase();
    const hasEmail = !!(j.apply_email && (j.confidence || 0) >= 0.6);
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

  if (currentBatch.length === 0) {
    if (typeof updateTaskProgress === 'function') updateTaskProgress(`掃描完成：找到 ${deduped.length} 個職缺，但 0 個有明確 email 可寄送。詳情見預覽。`);
    list.innerHTML = `
      <div style="color:#ef4444; padding:12px; border:1px solid #fecaca; background:#fef2f2; border-radius:8px;">
        這次從你提供的來源連結沒有找到有明確申請 email 的職缺。<br><br>
        <strong>常見原因：</strong>頁面為動態載入、需填問卷/表單、或職缺只提供線上申請。<br><br>
        <strong>建議：</strong>換成更靜態的職缺列表頁、或使用「手動加入職缺」貼上含 email 的職缺再試。工具只會對能直接 email 申請的職缺自動處理。
      </div>
    `;
    if (deduped.length > 0) {
      list.innerHTML += `<div style="margin-top:12px; font-size:13px;"><strong>掃描找到但無法自動 email 的職缺（前幾個）：</strong></div>`;
      deduped.slice(0, 5).forEach(j => {
        const d = document.createElement('div');
        d.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;margin:4px 0;background:#fff;font-size:13px;';
        d.innerHTML = `<strong>${j.title || '職缺'}</strong> @ ${j.company || '公司'}<br><span style="color:#666">email: ${j.apply_email || '無'} (好工 ${Math.round((j.confidence||0)*100)}%)</span>`;
        list.appendChild(d);
      });
    }
    container.style.display = 'block';
    appendLiveLog(`掃描完成。找到 ${deduped.length} 個職缺資訊，但 0 個有明確 email 可自動寄送。`);
    window._betaCreds = { backendUrl, gmailUser, appPassword, cvUrl: state.cvUrl };
    return;
  }

  currentBatch.forEach((job) => {
    // SSOT: preview shows EXACT universal letter (100% unchanged) + optional CV line for convenience
    const exactBody = state.universalLetter + (state.cvUrl ? `\n\nCV 連結：${state.cvUrl}` : '');
    const div = document.createElement('div');
    div.className = 'job-row';
    div.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fff;';
    div.innerHTML = `
      <strong>${job.title || '職缺'}</strong> @ ${job.company || '公司'} ${job.date ? '• ' + job.date : ''}<br>
      <span style="color:#16a34a;font-weight:600">申請 email: ${job.apply_email}</span>（好工 ${Math.round((job.confidence || 0)*100)}%）<br>
      <details style="margin-top:6px"><summary style="cursor:pointer">預覽 100% 原樣信（點開）</summary>
        <div class="preview-box">${exactBody.replace(/\n/g,'<br>')}</div>
      </details>
      ${job.link ? `<div style="font-size:12px;margin-top:4px;"><a href="${job.link}" target="_blank" rel="noopener">查看原始職缺頁</a></div>` : ''}
    `;
    list.appendChild(div);
  });

  container.style.display = 'block';

  // Store credentials for sending (only in memory for this session)
  window._betaCreds = { backendUrl, gmailUser, appPassword, cvUrl: state.cvUrl };
  window._lastSourceUrls = searchUrls || [];
  if (typeof updateTaskProgress === 'function') updateTaskProgress(`已處理好 ${currentBatch.length} 個職缺（去重 + 黑名單完成）。請在下方預覽確認後按「確認發送」。`);
  appendLiveLog(`已從你指定的來源自動處理好 ${currentBatch.length} 個職缺（跨網站重複的已自動排除）。`);
  alert(`SHINE 已自動從你提供的來源連結找出 ${currentBatch.length} 個適合的職缺並定位申請方式。\n\n請檢查預覽（每封都是你原封不動的信），確認後按「確認發送」即可用你的 Gmail 以最新 AI 擬態技術寄出。無需你再逐一瀏覽網站或手動抄電郵。`);
  } catch (err) {
    console.error('[SHINE] startSafeApply error:', err);
    const msg = err && err.message ? err.message : String(err);
    if (typeof updateTaskProgress === 'function') updateTaskProgress('掃描過程中遇到問題: ' + msg, true);
    throw err;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function confirmAndSendBatch() {
  if (!currentBatch.length || !window._betaCreds) {
    alert('沒有可寄送的職缺。請先完成掃描並在預覽中確認。');
    return;
  }

  const { backendUrl, gmailUser, appPassword, cvUrl } = window._betaCreds;
  if (!gmailUser || !appPassword) {
    alert('缺少 Gmail 設定。請填寫 Gmail 電郵與 App Password 後重新掃描。');
    if (typeof updateTaskProgress === 'function') updateTaskProgress('缺少 Gmail 設定，無法寄送', true);
    return;
  }
  const container = document.getElementById('previewArea');
  const limit = getQuotaLimit();
  let sent = 0;

  appendLiveLog('開始自動批次寄送（每封之間使用真人般的隨機等待時間，讓過程自然安全）...');
  showLiveConsole(true);
  if (typeof updateTaskProgress === 'function') updateTaskProgress(`準備批次寄送 ${currentBatch.length} 封（使用真人節奏）...`);

  for (const job of currentBatch) {
    if (state.successfulThisMonth >= limit) {
      alert('已達到本月額度上限。');
      break;
    }

    const idx = currentBatch.indexOf(job) + 1;  // 1-based for display
    if (typeof updateTaskProgress === 'function') updateTaskProgress(`準備寄送第 ${idx} 封 / ${currentBatch.length}：${job.title} @ ${job.company}`);

    appendLiveLog(`準備寄出給：${job.title} @ ${job.company}`);

    // Real human-like pacing (SSOT) - user saves huge amount of repeated manual work
    const delay = Math.floor(30000 + Math.random() * 150000);
    const delaySec = Math.round(delay / 1000);
    if (typeof updateTaskProgress === 'function') updateTaskProgress(`等待 ${delaySec}s（真人節奏），避免被視為機器...`);
    appendLiveLog(`自然等待 ${delaySec} 秒後寄出...`, 'wait');

    await sleep(delay);

    // SSOT: body = universal letter 100% 原樣 + CV line (user can embed CV in letter too)
    // Subject is a clean, consistent professional default — no user name or variation needed
    const exactBody = state.universalLetter + (cvUrl ? `\n\nCV 連結：${cvUrl}` : '');
    const subject = `誠意申請 ${job.title}`;

    try {
      if (typeof updateTaskProgress === 'function') updateTaskProgress(`正在用 Gmail 寄出第 ${idx} 封至 ${job.apply_email} ...`);
      appendLiveLog(`正在用你的 Gmail 寄出至 ${job.apply_email} ...`);
      const sendRes = await fetch(`${backendUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: job.apply_email,
          subject,
          body: exactBody,
          gmailUser,
          appPassword
        })
      });

      const result = await sendRes.json();

      if (result.success) {
        state.successfulThisMonth++;
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
      if (typeof updateTaskProgress === 'function') updateTaskProgress(`第 ${idx} 封寄送失敗: ${e.message}`, true);
      appendLiveLog(`寄送失敗: ${job.apply_email} - ${e.message}`, 'skip');
    }
  }

  container.style.display = 'none';
  currentBatch = [];
  delete window._betaCreds;
  if (typeof updateTaskProgress === 'function') updateTaskProgress(`本次任務完成！成功寄出 ${sent} 封（全部使用你 100% 原樣的求職信）。`);
  appendLiveLog(`全部完成！這次成功自動寄出 ${sent} 封（全部使用你 100% 原樣的求職信）。`, 'ok');
  alert(`完成！這次成功寄出 ${sent} 封。\n\nSHINE 已幫你省下反覆瀏覽網站、尋找電郵、手動一封封寄信的時間。所有信都是你自己寫的內容，完全沒有修改。`);
}

// Tier selection (from public pricing or portal)
function selectTier(t) {
  state.tier = t;
  saveState();
  updateQuotaUI();

  // Sync portal select if open
  const tierSel = document.getElementById('tierSelect');
  if (tierSel) tierSel.value = t;

  // Update chip for feedback
  const chip = document.getElementById('planChip');
  if (chip) chip.textContent = `${t.toUpperCase()} Beta`;

  // Sync the three independent URL input boxes (enable/disable per level)
  updateSourceInputs();

  alert(`已切換到 ${t.toUpperCase()}。配額與可提供的 URL 數量已更新（SSOT）。`);
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
  // Keep #liveTaskProgress id so later updates never hit null
  const win = document.getElementById('missionProcessWindow');
  if (win) {
    win.innerHTML = '<div style="font-weight:700; color:#b8860b; margin-bottom:4px;">🛰️ Mission Process — Real-time Status</div><div id="liveTaskProgress">' + msg + '</div>';
    if (isError) win.style.borderColor = '#ef4444';
    else win.style.borderColor = '#d4a017';
  }
  if (typeof appendLiveLog === 'function') appendLiveLog('[進度] ' + msg);
}

// Init
function init() {
  loadState();
  loadSettingsIntoForm();
  updateQuotaUI();
  loadSentHistory();

  // Sync chip from tier
  const chip = document.getElementById('planChip');
  if (chip) chip.textContent = `${(state.tier || 'lv2').toUpperCase()} Beta`;

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

  console.log('%c[SHINE v' + SHINE_VERSION + '] Ready. Scan reads live form. Pacing 30-180s. URLs 1/2/3 by tier.', 'color:#16a34a');
}

// Live Console Simulator (inspired by top SHINE_UIUX - great for showing value)
function startHeroConsole() {
  const el = document.getElementById('heroLog');
  if (!el) return;
  const lines = [
    {t:'09:41', m:'Scanning new positions matching your keywords...', c:''},
    {t:'09:42', m:'Found 7 new roles. Extracting contact emails...', c:''},
    {t:'09:43', m:'Preparing application for Senior Social Worker @ 香港社會服務聯會', c:'wait'},
    {t:'09:44', m:'Sent (with natural 47s timing) ✓', c:'ok'},
    {t:'09:46', m:'Preparing application for Registered Nurse @ 醫管局', c:'wait'},
    {t:'09:47', m:'Sent (with natural 63s timing) ✓', c:'ok'},
  ];
  let i = 0;
  const add = () => {
    if (i >= lines.length) { i=0; el.innerHTML=''; }
    const l = lines[i];
    const div = document.createElement('div');
    div.className = `ln ${l.c}`;
    div.innerHTML = `<span class="ts">${l.t}</span> <span class="msg">${l.m}</span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    i++;
    setTimeout(add, 1400);
  };
  setTimeout(add, 800);
}

window.onload = () => {
  init();
  startHeroConsole();
};

// Expose
window.SHINE = { state, saveSettings, startSafeApply, readFormSettings, getInputVal, SHINE_VERSION };

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

// Live log during real batch (Pro style high-quality feedback)
function appendLiveLog(msg, type='') {
  const liveEl = document.getElementById('liveLog');
  const logsEl = document.getElementById('logs');
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const line = `<div class="ln ${type}"><span class="ts">${time}</span> <span class="msg">${msg}</span></div>`;

  if (liveEl) {
    liveEl.innerHTML = line + liveEl.innerHTML;
    liveEl.scrollTop = 0;
  }
  if (logsEl) {
    logsEl.innerHTML = `<div class="log-entry">${line}</div>` + logsEl.innerHTML;
  }
}

function showLiveConsole(show = true) {
  const c = document.getElementById('liveConsole');
  if (c) c.style.display = show ? 'block' : 'none';
  const l = document.getElementById('liveLog');
  if (l && show) l.innerHTML = '';
}
