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
  // Optional live hint
  if (typeof appendLiveLog === 'function') {
    // no-op unless console open
  }
}

function saveSettings() {
  state.universalLetter = document.getElementById('universalLetter').value.trim();
  state.keywords = document.getElementById('keywords').value.trim();
  state.blacklist = document.getElementById('blacklist').value.trim();
  state.cvUrl = document.getElementById('cvUrl').value.trim();

  // Collect from the three independent professional URL boxes (no more single textarea)
  let collected = [];
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('searchUrl' + i);
    const v = el ? el.value.trim() : '';
    if (v) collected.push(v);
  }
  const maxU = getMaxSearchUrls();
  collected = collected.slice(0, maxU);
  state.searchUrls = collected.join('\n');

  // Sync tier from the level select (SSOT: level decides URLs count + quota)
  const tierSel = document.getElementById('tierSelect');
  if (tierSel) state.tier = tierSel.value;

  if (!state.universalLetter) {
    alert('Universal Cover Letter 為必填（SSOT 要求）。');
    return;
  }

  // Re-sync the boxes (in case of downgrade)
  updateSourceInputs();

  saveState();
  alert('設定已儲存。Universal Cover Letter 將 100% 原樣使用。');
  updateQuotaUI();
}

function loadSettingsIntoForm() {
  document.getElementById('universalLetter').value = state.universalLetter || '';
  document.getElementById('keywords').value = state.keywords || '';
  document.getElementById('blacklist').value = state.blacklist || '';
  document.getElementById('cvUrl').value = state.cvUrl || '';

  // Populate the three independent URL boxes from stored joined string
  const urls = (state.searchUrls || '').split('\n').map(u => u.trim()).filter(Boolean);
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('searchUrl' + (i + 1));
    if (el) el.value = urls[i] || '';
  }

  const tierSel = document.getElementById('tierSelect');
  if (tierSel) tierSel.value = state.tier || 'lv2';

  // Ensure correct boxes are enabled for the loaded tier
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
  if (!state.universalLetter) {
    alert('請先在上面儲存你的 Universal Cover Letter（必填）。');
    return;
  }

  // Early force visible mission window + console so user is never "in the dark"
  const mwin = document.getElementById('missionProcessWindow');
  if (mwin) mwin.style.display = 'block';
  const lcon = document.getElementById('liveConsole');
  if (lcon) lcon.style.display = 'block';
  if (typeof updateTaskProgress === 'function') updateTaskProgress('開始自動掃描與準備申請... 正在收集設定');

  const backendUrl = BACKEND_URL;
  const gmailUser = document.getElementById('gmailUser').value.trim();
  const appPassword = document.getElementById('appPassword').value.trim();

  let results = [];

  // Primary automation path (no user AI keys ever involved or shown)
  // Collect from the three independent professional boxes (user fills separate slots)
  let searchUrls = [];
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('searchUrl' + i);
    const v = el ? el.value.trim() : '';
    if (v) searchUrls.push(v);
  }

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
    if (typeof updateTaskProgress === 'function') updateTaskProgress('錯誤：未提供來源 URL（請在 1-3 個框填寫）', true);
    alert('請在上面的三個獨立來源框至少填寫一個完整職位搜尋結果頁連結（依你的方案自動限制數量）。工具會自動從這些來源處理職缺與申請方式。');
    return;
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
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function confirmAndSendBatch() {
  if (!currentBatch.length || !window._betaCreds) return;

  const { backendUrl, gmailUser, appPassword, cvUrl } = window._betaCreds;
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

function updateTaskProgress(msg) {
  // Dual target for compatibility (legacy #liveTaskProgress + the prominent gold #missionProcessWindow under quota)
  const prog = document.getElementById('liveTaskProgress');
  if (prog) prog.textContent = msg;
  const win = document.getElementById('missionProcessWindow');
  if (win) {
    win.innerHTML = '<div style="font-weight:700; color:#b8860b; margin-bottom:4px;">🛰️ Mission Process — Real-time Status</div><div>' + msg + '</div>';
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
  if (state.logs.length === 0) {
    logsEl.innerHTML = '<div class="log-entry" style="color:#64748b">尚未有發送紀錄。點擊「開始掃描與申請」試用。 可下載 LOG.txt 記錄已發送職缺。</div>';
  } else {
    state.logs.forEach(log => {
      logsEl.innerHTML += `<div class="log-entry">${new Date(log.time).toLocaleString()} → ${log.email} （延遲 ${log.delay_seconds}s）</div>`;
    });
  }

  // Keyboard hint
  console.log('%c[SHINE] SSOT app ready. All universal letters sent exactly as-is. Pacing = human variable 30-180s. Level-based URLs (1/2/3) + cross-site dedup + history dedup + LOG.txt.', 'color:#64748b');
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
window.SHINE = { state, saveSettings, startSafeApply };

function addManualJobs() {
  const text = document.getElementById('manualJobs').value.trim();
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
  document.getElementById('manualJobs').value = '';
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
