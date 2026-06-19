/**
 * SHINE Motion Layer v5.0-deadly
 * Conversion-focused GSAP: hero scrub, timeline, hour-pool, magnetic CTAs, sticky bar.
 */
(function (global) {
  'use strict';

  var reduced = false;
  var heroScrubEnabled = false;
  var loginBusy = false;
  var lastHeroPhaseKey = '';

  function whenReady(cb) {
    var tries = 0;
    (function tick() {
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') return cb();
      if (++tries > 120) return;
      setTimeout(tick, 50);
    })();
  }

  function animateCount(el, target, duration) {
    if (!el || isNaN(target)) return;
    var start = parseInt(String(el.textContent).replace(/[^\d]/g, ''), 10) || 0;
    var t0 = performance.now();
    function frame(now) {
      var p = Math.min((now - t0) / duration, 1);
      var v = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      el.textContent = String(v);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function triggerScanLine(id) {
    var line = document.getElementById(id);
    if (!line) return;
    line.classList.remove('active');
    void line.offsetWidth;
    line.classList.add('active');
  }

  function revealFallback() {
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    var sticky = document.getElementById('stickyCta');
    if (sticky) sticky.style.opacity = '1';
  }

  function finishLoader() {
    var loader = document.getElementById('loader');
    if (loader) loader.classList.add('off');
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale').forEach(function (el) {
      if (getComputedStyle(el).opacity === '0') {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    });
  }

  function renderHeroLog(lines) {
    var el = document.getElementById('heroLog');
    if (!el) return;
    el.innerHTML = lines.map(function (row) {
      return '<div class="ln ' + (row.cls || '') + '"><span class="ts">[' + row.ts + ']</span><span class="msg">' + row.msg + '</span></div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  var HERO_PHASES = [
    { progress: 0, status: 'IDLE', statusClass: 'muted', phaseIdx: 0,
      lines: [{ ts: '09:00:00', cls: 'head', msg: '就緒 · 等待你的來源連結與萬用求職信' }], pillar: -1, scan: false },
    { progress: 0.22, status: 'SCANNING', statusClass: 'run', phaseIdx: 1,
      lines: [
        { ts: '09:01:02', cls: 'head', msg: '啟動代理 · 讀取你指定的來源連結' },
        { ts: '09:01:04', cls: '', msg: '掃描 jump.mingpao.com → 關鍵字「社工」' },
        { ts: '09:01:06', cls: '', msg: '分頁掃描 Page 1 → 2 → 3（最近 3 個月）' }
      ], pillar: 0, scan: true },
    { progress: 0.48, status: 'MATCHING', statusClass: 'run', phaseIdx: 2,
      lines: [
        { ts: '09:01:07', cls: '', msg: '找到 11 個職位 · 跟隨詳情頁提取 email' },
        { ts: '09:01:10', cls: '', msg: '職位 #1 → recruit@tpbcss.org' },
        { ts: '09:01:11', cls: '', msg: '跨站去重 · 同職缺只申請一次' }
      ], pillar: 1, scan: false },
    { progress: 0.72, status: 'PACING', statusClass: 'wait', phaseIdx: 3,
      lines: [
        { ts: '09:01:12', cls: 'ok', msg: '✓ 已發送 · 駐校社工 — 循道衛理' },
        { ts: '09:01:13', cls: 'wait', msg: '等待 60 秒（真人節奏）…' },
        { ts: '09:02:18', cls: 'ok', msg: '✓ 已發送 · 學校社工 ASWO' }
      ], pillar: 2, scan: false },
    { progress: 1, status: 'SAVED', statusClass: 'ok', phaseIdx: 4,
      lines: [
        { ts: '09:02:20', cls: 'head', msg: '本輪完成 · 每封節省約 1 小時' },
        { ts: '09:02:21', cls: 'ok', msg: '✓ 本月已釋放 +1 小時 · 機會持續進場' }
      ], pillar: 2, scan: false }
  ];

  function updatePhaseBar(idx) {
    var bar = document.getElementById('heroPhaseBar');
    if (!bar) return;
    bar.querySelectorAll('.phase-dot').forEach(function (d, i) {
      d.classList.toggle('is-on', i <= idx);
      d.classList.toggle('is-active', i === idx);
    });
  }

  function applyHeroPhase(phase) {
    renderHeroLog(phase.lines);
    if (phase.scan) triggerScanLine('heroScanLine');
    updatePhaseBar(phase.phaseIdx);

    var live = document.getElementById('heroConLive');
    if (live) {
      var label = live.querySelector('[data-i18n="console-running"]') || live.querySelector('span:last-child') || live;
      var labels = { IDLE: 'IDLE', SCANNING: 'SCANNING', MATCHING: 'MATCHING', PACING: 'PACING 60s', SAVED: '+1h SAVED' };
      label.textContent = labels[phase.status] || phase.status;
      live.classList.remove('is-run', 'is-wait', 'is-ok');
      if (phase.statusClass === 'run') live.classList.add('is-run');
      if (phase.statusClass === 'wait') live.classList.add('is-wait');
      if (phase.statusClass === 'ok') live.classList.add('is-ok');
    }

    document.querySelectorAll('#heroPillars .pillar').forEach(function (p, i) {
      p.classList.toggle('is-active', i === phase.pillar);
    });
  }

  function phaseAtProgress(p) {
    var active = HERO_PHASES[0];
    for (var i = 0; i < HERO_PHASES.length; i++) {
      if (p >= HERO_PHASES[i].progress) active = HERO_PHASES[i];
    }
    return active;
  }

  function initHeroEntrance() {
    if (reduced || typeof gsap === 'undefined') return;
    var lines = document.querySelectorAll('.hero-headline .hero-line');
    gsap.fromTo(lines, { opacity: 0, y: 48, rotateX: 12 }, {
      opacity: 1, y: 0, rotateX: 0, duration: 1.1, stagger: 0.14, ease: 'power4.out', delay: 0.2
    });
    gsap.fromTo('#heroCopy .eyebrow', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' });
    gsap.fromTo('#heroStage', { opacity: 0, x: 60, scale: 0.94 }, { opacity: 1, x: 0, scale: 1, duration: 1.2, ease: 'power3.out', delay: 0.35 });
    gsap.fromTo('.hero-proof .proof-cell', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, delay: 0.8, ease: 'power2.out' });
  }

  function initHeroScrub() {
    if (reduced || window.innerWidth < 900) return false;

    var hero = document.getElementById('top');
    var pinWrap = document.getElementById('heroPinWrap');
    if (!hero || !pinWrap) return false;

    heroScrubEnabled = true;
    applyHeroPhase(HERO_PHASES[0]);

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=150%',
        pin: pinWrap,
        scrub: 0.75,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var phase = phaseAtProgress(self.progress);
          var key = String(phase.progress);
          if (key !== lastHeroPhaseKey) {
            lastHeroPhaseKey = key;
            applyHeroPhase(phase);
          }
          var hint = document.getElementById('heroScrubHint');
          if (hint) hint.style.opacity = String(Math.max(0, 1 - self.progress * 2.8));
          gsap.set('#heroCopy', { opacity: 1 - self.progress * 0.35, y: -self.progress * 28 });
          gsap.set('#heroStage .hero-console', {
            scale: 1 + self.progress * 0.04,
            boxShadow: '0 ' + (40 + self.progress * 30) + 'px 80px -30px rgba(0,0,0,.7), 0 0 ' + (50 + self.progress * 40) + 'px -20px rgba(255,203,87,' + (0.15 + self.progress * 0.2) + ')'
          });
        }
      }
    });

    tl.fromTo('#heroCta .btn-gold', { scale: 1 }, { scale: 1.06, duration: 0.4 }, 0.85);

    var glow = document.querySelector('.hero-bg-glow');
    if (glow) {
      gsap.to(glow, { yPercent: 18, opacity: 0.75, scrollTrigger: { trigger: hero, start: 'top top', end: '+=150%', scrub: 1 } });
    }
    return true;
  }

  function initStepsTimeline() {
    var track = document.getElementById('stepsTrack');
    var fill = document.getElementById('stepsFill');
    if (!track || !fill || typeof ScrollTrigger === 'undefined') return;

    ScrollTrigger.create({
      trigger: track,
      start: 'top 75%',
      end: 'bottom 40%',
      scrub: 0.6,
      onUpdate: function (self) {
        fill.style.width = (self.progress * 100) + '%';
      }
    });

    gsap.utils.toArray('.steps .step').forEach(function (step, i) {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 82%',
        onEnter: function () { step.classList.add('is-lit'); },
        onLeaveBack: function () { step.classList.remove('is-lit'); }
      });
      gsap.fromTo(step, { opacity: 0, y: 50, scale: 0.96 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.85, delay: i * 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 88%', toggleActions: 'play none none none' }
      });
    });
  }

  function initHourPool() {
    var wrap = document.getElementById('hourPoolWrap');
    var fill = document.getElementById('hourFill');
    if (!wrap || !fill) return;

    ScrollTrigger.create({
      trigger: wrap,
      start: 'top 80%',
      end: 'bottom 50%',
      scrub: 0.8,
      onUpdate: function (self) {
        fill.style.height = (20 + self.progress * 80) + '%';
      }
    });

    gsap.to('.hour-glow', {
      opacity: 0.6, scale: 1.05, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut',
      scrollTrigger: { trigger: wrap, start: 'top 85%', toggleActions: 'play pause resume pause' }
    });
  }

  function initPricingSpotlight() {
    var feat = document.querySelector('.tier.feat-wrap');
    if (!feat) return;

    gsap.to(feat, {
      boxShadow: '0 0 80px -16px rgba(255,203,87,.55)',
      duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut'
    });

    ScrollTrigger.create({
      trigger: '#pricing',
      start: 'top 60%',
      onEnter: function () { feat.classList.add('is-spotlight'); }
    });

    gsap.utils.toArray('.price-grid .flip-wrap').forEach(function (card, i) {
      gsap.fromTo(card, { opacity: 0, y: 60, rotateY: -8 }, {
        opacity: 1, y: 0, rotateY: 0, duration: 0.9, delay: i * 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none none' }
      });
    });
  }

  function initWeaponSection() {
    var sec = document.getElementById('weapon');
    if (!sec || typeof gsap === 'undefined') return;

    gsap.to('.weapon-ring', {
      rotate: 360, duration: 24, repeat: -1, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
    gsap.to('.weapon-orbit span', {
      rotate: 360, duration: 8, repeat: -1, ease: 'none', stagger: 0.4
    });
    gsap.fromTo('.weapon-core', { scale: 0.9, opacity: 0.7 }, {
      scale: 1, opacity: 1, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut',
      scrollTrigger: { trigger: sec, start: 'top 75%', toggleActions: 'play pause resume pause' }
    });
  }

  function initStickyCta() {
    var sticky = document.getElementById('stickyCta');
    var pricing = document.getElementById('pricing');
    if (!sticky || !pricing || typeof ScrollTrigger === 'undefined') return;

    ScrollTrigger.create({
      trigger: pricing,
      start: 'top 70%',
      onEnter: function () {
        sticky.classList.add('is-visible');
        sticky.setAttribute('aria-hidden', 'false');
      },
      onLeaveBack: function () {
        sticky.classList.remove('is-visible');
        sticky.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function initMagneticButtons() {
    if (reduced || window.innerWidth < 900) return;
    document.querySelectorAll('.btn-magnetic').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.18;
        var y = (e.clientY - r.top - r.height / 2) * 0.18;
        gsap.to(btn, { x: x, y: y, duration: 0.35, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      });
    });
  }

  function initScrollReveals() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.utils.toArray('.reveal').forEach(function (el, i) {
      gsap.fromTo(el, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.95, delay: i * 0.03, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
      });
    });
    gsap.utils.toArray('.reveal-left').forEach(function (el) {
      if (el.closest('#heroCopy')) return;
      gsap.fromTo(el, { opacity: 0, x: -55 }, {
        opacity: 1, x: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });
    gsap.utils.toArray('.reveal-right').forEach(function (el) {
      if (el.closest('#heroStage')) return;
      gsap.fromTo(el, { opacity: 0, x: 55 }, {
        opacity: 1, x: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });
    gsap.utils.toArray('.reveal-scale').forEach(function (el) {
      gsap.fromTo(el, { opacity: 0, scale: 0.9 }, {
        opacity: 1, scale: 1, duration: 0.95, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
      });
    });

    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, { rotateY: x * 10, rotateX: -y * 10, duration: 0.35, ease: 'power2.out', transformPerspective: 900 });
      });
      card.addEventListener('mouseleave', function () {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.55, ease: 'power2.out' });
      });
    });

    if (!heroScrubEnabled) {
      var glow = document.querySelector('.hero-bg-glow');
      if (glow) {
        gsap.to(glow, { yPercent: 14, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      }
    }

    document.querySelectorAll('.time-stat .n').forEach(function (el) {
      var target = parseInt(el.textContent, 10) || 0;
      if (target > 0 && el.id !== 'heroTimeMonth') {
        ScrollTrigger.create({
          trigger: el, start: 'top 85%', once: true,
          onEnter: function () { animateCount(el, target, 1400); }
        });
      }
    });

    document.querySelectorAll('.proof-n[data-count]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (!target) return;
      ScrollTrigger.create({
        trigger: '#heroProof', start: 'top 90%', once: true,
        onEnter: function () {
          var t0 = performance.now();
          function frame(now) {
            var p = Math.min((now - t0) / 1600, 1);
            var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
            el.textContent = v.toLocaleString() + '+';
            if (p < 1) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        }
      });
    });

    gsap.fromTo('.final-cta-card', { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '#final-cta', start: 'top 80%', toggleActions: 'play none none none' }
    });
  }

  function initCursor() {
    var cursor = document.getElementById('shine-cursor');
    if (!cursor || 'ontouchstart' in window) return;
    document.addEventListener('mousemove', function (e) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.querySelectorAll('a,button,.step,.flip-wrap,.time-stat,.pillar,.btn-gold,.btn-magnetic').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('on'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('on'); });
    });
  }

  function initDashboardOrbWatcher() {
    var portal = document.getElementById('portal');
    if (!portal || typeof initDashboardOrb !== 'function') return;
    new MutationObserver(function () {
      if (portal.style.display !== 'none') initDashboardOrb();
    }).observe(portal, { attributes: true, attributeFilter: ['style'] });
  }

  function initLogObservers() {
    ['dashLog', 'liveLog'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(function () {
        var wait = el.querySelector('.ln.wait');
        var pulse = el.querySelector('.countdown-pulse');
        if (wait && !pulse) {
          var p = document.createElement('div');
          p.className = 'countdown-pulse';
          p.innerHTML = '<span class="dot"></span><span>60s human rhythm</span>';
          wait.appendChild(p);
        } else if (!wait && pulse) {
          pulse.remove();
        }
      }).observe(el, { childList: true, subtree: true });
    });
  }

  function openLogin() {
    if (loginBusy) return;
    loginBusy = true;

    var site = document.getElementById('site');
    var login = document.getElementById('shineLogin');
    if (!site || !login) { loginBusy = false; return; }

    function showLogin() {
      site.style.display = 'none';
      login.style.display = 'flex';
      login.setAttribute('aria-hidden', 'false');
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      loginBusy = false;
    }

    if (reduced || typeof gsap === 'undefined') {
      showLogin();
      return;
    }

    var card = login.querySelector('.surface-card');
    gsap.set(login, { display: 'flex', opacity: 1 });
    gsap.set(card, { opacity: 0, y: 40, scale: 0.94 });
    gsap.set(site, { filter: 'blur(0px)', scale: 1, opacity: 1 });

    var tl = gsap.timeline({
      onComplete: function () {
        gsap.set(site, { clearProps: 'filter,scale,opacity' });
        gsap.fromTo(card, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power4.out' });
        loginBusy = false;
      }
    });
    tl.to(site, { scale: 0.97, opacity: 0, filter: 'blur(12px)', duration: 0.45, ease: 'power2.inOut' });
    tl.add(showLogin);
  }

  function closeLogin() {
    if (loginBusy) return;
    loginBusy = true;

    var site = document.getElementById('site');
    var login = document.getElementById('shineLogin');
    if (!site || !login) { loginBusy = false; return; }

    function showSite() {
      login.style.display = 'none';
      login.setAttribute('aria-hidden', 'true');
      site.style.display = 'block';
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      loginBusy = false;
    }

    if (reduced || typeof gsap === 'undefined') {
      showSite();
      return;
    }

    var card = login.querySelector('.surface-card');
    var tl = gsap.timeline({ onComplete: showSite });
    tl.to(card, { opacity: 0, y: 24, scale: 0.96, duration: 0.3, ease: 'power2.in' });
    tl.set(site, { display: 'block', opacity: 0, scale: 0.97, filter: 'blur(10px)' });
    tl.to(site, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power4.out' });
  }

  function init() {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      revealFallback();
      finishLoader();
      return;
    }

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    initCursor();
    initLogObservers();
    initDashboardOrbWatcher();
    initHeroEntrance();
    initHeroScrub();
    initScrollReveals();
    initStepsTimeline();
    initHourPool();
    initPricingSpotlight();
    initWeaponSection();
    initStickyCta();
    initMagneticButtons();
    finishLoader();
    ScrollTrigger.refresh();
  }

  function boot() {
    whenReady(function () {
      init();
      setTimeout(finishLoader, 900);
    });
  }

  global.SHINE_MOTION = {
    get usesHeroScrub() { return heroScrubEnabled; },
    openLogin: openLogin,
    closeLogin: closeLogin,
    animateCount: animateCount,
    triggerScanLine: triggerScanLine,
    finishLoader: finishLoader,
    refresh: function () { if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);