/**
 * SHINE v2.7 Growth Layer — live stats, activity feed, demo sandbox, events
 */
(function (global) {
  'use strict';

  var API = (function () {
    if (global.SHINE_API_BASE) return global.SHINE_API_BASE;
    if (global.SHINE_REG_API) return global.SHINE_REG_API;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return location.origin.replace(/\/$/, '') + '/shine-api';
    }
    return 'https://2c-ai.com/shine-api';
  })();

  function track(name, props) {
    try {
      fetch(API + '/api/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, props: props || {} })
      }).catch(function () {});
    } catch (_) {}
    if (global.umami && typeof global.umami.track === 'function') {
      try { global.umami.track(name, props); } catch (_) {}
    }
  }

  function fetchPublicStats() {
    return fetch(API + '/api/stats/public', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  function fetchActivity() {
    return fetch(API + '/api/stats/activity', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  function initLiveCounter() {
    var el = document.getElementById('viralCounter');
    if (!el) return;
    function apply(stats) {
      if (!stats || !stats.ok) return;
      var n = stats.helped || parseInt(el.textContent, 10) || 167;
      el.textContent = String(n);
      var sentEl = document.getElementById('liveSentWeek');
      if (sentEl && stats.sent_week != null) sentEl.textContent = String(stats.sent_week);
    }
    fetchPublicStats().then(apply);
    setInterval(function () { fetchPublicStats().then(apply); }, 60000);
  }

  function initActivityTicker() {
    var box = document.getElementById('activityTicker');
    if (!box) return;
    function render(data) {
      if (!data || !data.ok || !data.feed || !data.feed.length) return;
      box.innerHTML = data.feed.map(function (row) {
        return '<div class="activity-item"><span class="activity-time">' + row.label + '</span>' +
          '<span class="activity-prof">' + row.profession + '</span>' +
          '<span class="activity-action">' + row.action + '</span></div>';
      }).join('');
    }
    fetchActivity().then(render);
    setInterval(function () { fetchActivity().then(render); }, 45000);
  }

  function initDemoSandbox() {
    var btn = document.getElementById('btnDemoPreview');
    var input = document.getElementById('demoKeyword');
    var out = document.getElementById('demoResults');
    if (!btn || !input || !out) return;
    btn.addEventListener('click', function () {
      var kw = (input.value || '').trim();
      if (kw.length < 2) {
        out.innerHTML = '<p class="hint">請輸入至少 2 個字（例：社工、PT）</p>';
        return;
      }
      btn.disabled = true;
      out.innerHTML = '<p class="hint">掃描中…</p>';
      track('demo_preview_click', { keyword: kw });
      fetch(API + '/api/demo/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw })
      }).then(function (r) { return r.json(); }).then(function (j) {
        btn.disabled = false;
        if (!j.ok) {
          out.innerHTML = '<p class="hint">' + (j.error || '預覽失敗') + '</p>';
          return;
        }
        out.innerHTML = j.jobs.map(function (job, i) {
          return '<div class="demo-job"><strong>' + (i + 1) + '. ' + job.title + '</strong> @ ' + job.company +
            '<br><span class="hint">email: ' + job.apply_email + ' · 好工 ' + Math.round((job.confidence || 0) * 100) + '%</span></div>';
        }).join('') + '<p class="hint" style="margin-top:10px">' + (j.note || '') + '</p>';
      }).catch(function () {
        btn.disabled = false;
        out.innerHTML = '<p class="hint">連線失敗，請稍後再試</p>';
      });
    });
  }

  function initFaq() {
    document.querySelectorAll('.faq-q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq-item');
        if (!item) return;
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  global.reportOutcome = function (type) {
    var token = '';
    try {
      token = localStorage.getItem('shine_access_token') || '';
    } catch (_) {}
    if (!token) {
      alert('請先登入');
      return;
    }
    var prof = '其他';
    try {
      var st = JSON.parse(localStorage.getItem('shine_state_v1') || '{}');
      if (st.keywords) prof = String(st.keywords).split(',')[0].trim() || prof;
    } catch (_) {}
    fetch(API + '/api/outcomes/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-shine-access': token },
      body: JSON.stringify({ type: type, profession: prof })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) {
        track('outcome_reported', { type: type });
        var toast = document.getElementById('outcomeToast');
        if (toast) {
          toast.textContent = type === 'offer' ? '✓ 已記錄 Offer — 感謝分享！' : '✓ 已記錄 HR 來電 — 感謝分享！';
          toast.classList.add('is-show');
          setTimeout(function () { toast.classList.remove('is-show'); }, 3000);
        }
        initLiveCounter();
        initActivityTicker();
      }
    }).catch(function () {});
  };

  function boot() {
    initLiveCounter();
    initActivityTicker();
    initDemoSandbox();
    initFaq();
    track('page_view', { v: '2.7' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.SHINE_GROWTH = { track: track, API: API };
})(window);