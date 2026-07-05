/**
 * SHINE Viral + High-UX Layer v5.3
 * Share · social proof · interactive live log · stories carousel · CTA timer
 */
(function (global) {
  'use strict';

  var SHARE_URL = 'https://2c-ai.com/shine/';
  var SHARE_TEXT = 'SHINE 出眾 — 全自動求職，每月釋放 90+ 小時。不用下班還自己找工：';
  var COUNTER_BASE = 167;
  var simRunning = false;
  var simTimer = null;

  var SIM_SCRIPT = [
    { status: 'SCANNING', statusClass: 'run', phaseIdx: 1, scan: true,
      lines: [
        { ts: '09:01:02', cls: 'head', msg: '▶ 模擬啟動 · 讀取你指定的來源連結' },
        { ts: '09:01:04', cls: '', msg: '掃描 jump.mingpao.com → 關鍵字「社工」' },
        { ts: '09:01:06', cls: '', msg: '分頁掃描 Page 1 → 2 → 3（最近 3 個月）' }
      ]},
    { status: 'MATCHING', statusClass: 'run', phaseIdx: 2, scan: false,
      lines: [
        { ts: '09:01:07', cls: '', msg: '找到 11 個職位 · 跟隨詳情頁提取 email' },
        { ts: '09:01:10', cls: '', msg: '職位 #1 → recruit@tpbcss.org' },
        { ts: '09:01:11', cls: '', msg: '跨站去重 · 同職缺只申請一次' }
      ]},
    { status: 'PACING', statusClass: 'wait', phaseIdx: 3, scan: false,
      lines: [
        { ts: '09:01:12', cls: 'ok', msg: '✓ 已發送 · 駐校社工 — 循道衛理' },
        { ts: '09:01:13', cls: 'wait', msg: '獨家 AI 智能節奏投遞中…' },
        { ts: '09:02:18', cls: 'ok', msg: '✓ 已發送 · 學校社工 ASWO' }
      ]},
    { status: 'SAVED', statusClass: 'ok', phaseIdx: 4, scan: false,
      lines: [
        { ts: '09:02:20', cls: 'head', msg: '本輪完成 · 每封節省約 1 小時' },
        { ts: '09:02:21', cls: 'ok', msg: '✓ 本月已釋放 +1 小時 · 機會持續進場' }
      ]}
  ];

  function toast(msg) {
    var t = document.getElementById('viralToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'viralToast';
      t.className = 'viral-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(t._hide);
    t._hide = setTimeout(function () { t.classList.remove('is-show'); }, 2600);
  }

  function renderLogLines(el, lines, onDone) {
    if (!el) return onDone && onDone();
    el.innerHTML = '';
    var i = 0;
    function next() {
      if (i >= lines.length) return onDone && onDone();
      var row = lines[i++];
      var div = document.createElement('div');
      div.className = 'ln ' + (row.cls || '');
      div.innerHTML = '<span class="ts">[' + row.ts + ']</span><span class="msg"></span>';
      el.appendChild(div);
      var msg = div.querySelector('.msg');
      var text = row.msg;
      var ci = 0;
      function typeChar() {
        if (ci < text.length) {
          msg.textContent += text.charAt(ci++);
          el.scrollTop = el.scrollHeight;
          setTimeout(typeChar, 18 + Math.random() * 22);
        } else {
          setTimeout(next, 280);
        }
      }
      typeChar();
    }
    next();
  }

  function setHeroLive(status, statusClass) {
    var live = document.getElementById('heroConLive');
    if (!live) return;
    var label = live.querySelector('span:last-child') || live;
    label.textContent = status;
    live.classList.remove('is-run', 'is-wait', 'is-ok');
    if (statusClass === 'run') live.classList.add('is-run');
    if (statusClass === 'wait') live.classList.add('is-wait');
    if (statusClass === 'ok') live.classList.add('is-ok');
  }

  function updatePhaseBar(idx) {
    var bar = document.getElementById('heroPhaseBar');
    if (!bar) return;
    bar.querySelectorAll('.phase-dot').forEach(function (d, i) {
      d.classList.toggle('is-on', i <= idx);
      d.classList.toggle('is-active', i === idx);
    });
  }

  function triggerScanLine() {
    var line = document.getElementById('heroScanLine');
    if (!line) return;
    line.classList.remove('active');
    void line.offsetWidth;
    line.classList.add('active');
  }

  global.copyShareLink = function () {
    var text = SHARE_TEXT + ' ' + SHARE_URL;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('✓ 已複製分享連結');
      }).catch(function () {
        toast(text);
      });
    } else {
      toast(text);
    }
  };

  global.shareToWA = function (quote) {
    var q = quote || '「一設定完就收到 HR call，勁！」— 陳社工';
    var url = 'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT + '\n' + q + '\n' + SHARE_URL);
    window.open(url, '_blank', 'noopener');
  };

  global.nativeShareShine = function () {
    if (navigator.share) {
      navigator.share({ title: 'SHINE 出眾', text: SHARE_TEXT, url: SHARE_URL }).catch(function () {});
    } else {
      copyShareLink();
    }
  };

  global.simulateApply = function () {
    if (simRunning) return;
    simRunning = true;
    var btn = document.getElementById('btnSimulateApply');
    var log = document.getElementById('heroLog');
    var cdWrap = document.getElementById('simCountdown');
    var cdVal = document.getElementById('simCountdownVal');
    if (btn) btn.disabled = true;
    if (cdWrap) cdWrap.classList.add('is-active');

    var phase = 0;
    var countdown = 60;

    function runCountdownPulse() {
      if (!cdVal) return;
      cdVal.textContent = String(countdown);
      if (countdown <= 0) return;
      countdown--;
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(cdVal, { scale: 1.2, color: '#FFCB57' }, { scale: 1, color: '#EDEFF7', duration: 0.4 });
      }
      simTimer = setTimeout(runCountdownPulse, phase === 2 ? 120 : 80);
    }

    function runPhase() {
      if (phase >= SIM_SCRIPT.length) {
        simRunning = false;
        if (btn) btn.disabled = false;
        if (cdWrap) cdWrap.classList.remove('is-active');
        clearTimeout(simTimer);
        return;
      }
      var p = SIM_SCRIPT[phase++];
      setHeroLive(p.status, p.statusClass);
      updatePhaseBar(p.phaseIdx);
      if (p.scan) triggerScanLine();
      if (p.status === 'PACING') runCountdownPulse();
      renderLogLines(log, p.lines, function () {
        setTimeout(runPhase, 400);
      });
    }

    if (log) log.innerHTML = '';
    runPhase();
  };

  function initCounter() {
    var el = document.getElementById('viralCounter');
    if (!el) return;
    var stored = parseInt(localStorage.getItem('shine_viral_count') || '', 10);
    var count = !isNaN(stored) && stored >= COUNTER_BASE ? stored : COUNTER_BASE;
    el.textContent = String(count);
    setInterval(function () {
      if (Math.random() > 0.55) return;
      count += 1;
      el.textContent = String(count);
      localStorage.setItem('shine_viral_count', String(count));
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(el, { scale: 1.15, color: '#FFCB57' }, { scale: 1, color: '#EDEFF7', duration: 0.5 });
      }
    }, 12000);
  }

  function initTrialTimer() {
    var el = document.getElementById('viralTimer');
    if (!el) return;
    var key = 'shine_trial_end';
    var end = parseInt(localStorage.getItem(key) || '', 10);
    var now = Date.now();
    if (!end || end < now) {
      end = now + 24 * 60 * 60 * 1000;
      localStorage.setItem(key, String(end));
    }
    function tick() {
      var left = Math.max(0, end - Date.now());
      var h = Math.floor(left / 3600000);
      var m = Math.floor((left % 3600000) / 60000);
      var s = Math.floor((left % 60000) / 1000);
      el.textContent = [h, m, s].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
      if (left > 0) requestAnimationFrame(function () { setTimeout(tick, 1000); });
    }
    tick();
  }

  function initStoriesCarousel() {
    var track = document.getElementById('storiesTrack');
    var dots = document.getElementById('storiesDots');
    if (!track) return;
    var slides = track.querySelectorAll('.story-slide');
    if (!slides.length) return;
    var idx = 0;
    function show(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
      if (dots) {
        dots.querySelectorAll('button').forEach(function (b, i) {
          b.classList.toggle('is-active', i === idx);
        });
      }
    }
    if (dots) {
      dots.querySelectorAll('button').forEach(function (b, i) {
        b.addEventListener('click', function () { show(i); });
      });
    }
    show(0);
    setInterval(function () { show(idx + 1); }, 6000);
  }

  function initPricingLift() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.utils.toArray('.price-grid .flip-wrap').forEach(function (card, i) {
      gsap.from(card, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        delay: i * 0.12,
        ease: 'power2.out',
        scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none none' }
      });
    });
    var hot = document.querySelector('.flip-wrap.viral-hot');
    if (hot && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.to(hot, {
        boxShadow: '0 0 40px rgba(255,203,87,.55), 0 0 80px rgba(255,203,87,.2)',
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }
  }

  function bindEvents() {
    var copyBtn = document.getElementById('btnCopyShare');
    var shareBtn = document.getElementById('btnNativeShare');
    var simBtn = document.getElementById('btnSimulateApply');
    if (copyBtn) copyBtn.addEventListener('click', copyShareLink);
    if (shareBtn) shareBtn.addEventListener('click', nativeShareShine);
    if (simBtn) simBtn.addEventListener('click', simulateApply);
    document.querySelectorAll('[data-wa-quote]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        shareToWA(btn.getAttribute('data-wa-quote'));
      });
    });
  }

  function whenReady(cb) {
    var n = 0;
    (function tick() {
      if (document.readyState === 'complete' || n++ > 80) return cb();
      setTimeout(tick, 50);
    })();
  }

  whenReady(function () {
    bindEvents();
    initCounter();
    initTrialTimer();
    initStoriesCarousel();
    if (typeof gsap !== 'undefined') {
      var ready = function () { initPricingLift(); };
      if (typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        ready();
      } else {
        setTimeout(ready, 300);
      }
    }
  });

  global.SHINE_VIRAL = {
    copyShareLink: copyShareLink,
    shareToWA: shareToWA,
    simulateApply: simulateApply
  };
})(window);