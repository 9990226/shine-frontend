/**
 * SHINE Motion Layer v5.3-cinema
 * Lenis smooth scroll + GSAP ScrollTrigger + Three.js hero/dashboard orbs.
 */
(function (global) {
  'use strict';

  var reduced = false;
  var heroScrubEnabled = false;
  var loginBusy = false;
  var lastHeroPhaseKey = '';
  var lenisInstance = null;
  var heroOrbStarted = false;
  var dashboardOrbStarted = false;

  function whenReady(cb) {
    var tries = 0;
    (function tick() {
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') return cb();
      if (++tries > 120) return;
      setTimeout(tick, 50);
    })();
  }

  function landingVisible() {
    var site = document.getElementById('site');
    return site && site.style.display !== 'none';
  }

  function syncLenisState() {
    if (!lenisInstance) return;
    if (landingVisible()) lenisInstance.start();
    else lenisInstance.stop();
  }

  function initLenis() {
    if (reduced || typeof Lenis === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    lenisInstance = new Lenis({
      duration: 1.12,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.15
    });
    lenisInstance.on('scroll', function (e) {
      ScrollTrigger.update();
      if (typeof global.SHINE_SPINE_TICK === 'function') global.SHINE_SPINE_TICK(e.scroll);
      if (typeof global.SHINE_HEADER_TICK === 'function') global.SHINE_HEADER_TICK(e.scroll);
    });
    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop: function (value) {
        if (arguments.length) lenisInstance.scrollTo(value, { immediate: true });
        return lenisInstance.scroll;
      },
      getBoundingClientRect: function () {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: document.documentElement.style.transform ? 'transform' : 'fixed'
    });
    ScrollTrigger.addEventListener('refresh', function () { lenisInstance.resize(); });
    gsap.ticker.add(function (time) { lenisInstance.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('#site a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var hash = (a.getAttribute('href') || '').slice(1);
        if (!hash) return;
        var target = document.getElementById(hash);
        if (!target) return;
        e.preventDefault();
        lenisInstance.scrollTo(target, { offset: -72 });
      });
    });
    ['site', 'portal', 'shineLogin', 'shineRegister'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(syncLenisState).observe(el, { attributes: true, attributeFilter: ['style'] });
    });
    syncLenisState();
  }

  function initHeroOrb3D() {
    if (heroOrbStarted || reduced || typeof THREE === 'undefined') return;
    var canvas = document.getElementById('heroOrb3d');
    if (!canvas) return;
    heroOrbStarted = true;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    var dpr = Math.min(1.75, window.devicePixelRatio || 1);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 5.2;

    var amb = new THREE.AmbientLight(0x8aa6ff, 0.35);
    var key = new THREE.PointLight(0xffcb57, 1.4, 20);
    key.position.set(2, 2, 4);
    var rim = new THREE.PointLight(0x00d4ff, 0.9, 18);
    rim.position.set(-3, -1, 2);
    scene.add(amb, key, rim);

    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshStandardMaterial({ color: 0xffcb57, emissive: 0x553300, metalness: 0.65, roughness: 0.22, transparent: true, opacity: 0.92 })
    );
    scene.add(core);

    var rings = new THREE.Group();
    [[1.35, 0x00d4ff, 0.14], [1.75, 0x8aa6ff, 0.1], [2.1, 0xffcb57, 0.08]].forEach(function (cfg, i) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(cfg[0], 0.018, 8, 96),
        new THREE.MeshBasicMaterial({ color: cfg[1], transparent: true, opacity: cfg[2], wireframe: i === 1 })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.35;
      ring.rotation.y = i * 0.6;
      rings.add(ring);
    });
    scene.add(rings);

    var particles = new THREE.Group();
    var pGeo = new THREE.SphereGeometry(0.025, 6, 6);
    for (var i = 0; i < 48; i++) {
      var m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffcb57 : (i % 3 === 1 ? 0x5fd08a : 0x8aa6ff),
        transparent: true, opacity: 0.35 + (i % 5) * 0.08
      }));
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var rad = 2.2 + Math.random() * 1.4;
      m.position.set(rad * Math.sin(phi) * Math.cos(theta), rad * Math.sin(phi) * Math.sin(theta), rad * Math.cos(phi));
      m.userData = { theta: theta, phi: phi, rad: rad, sp: 0.15 + Math.random() * 0.25 };
      particles.add(m);
    }
    scene.add(particles);

    var mx = 0, my = 0;
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5;
      my = (e.clientY - r.top) / r.height - 0.5;
    }, { passive: true });

    function resize() {
      var w = canvas.clientWidth || 400;
      var h = canvas.clientHeight || 360;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    var scrollRot = 0;
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.create({
        trigger: '#top',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8,
        onUpdate: function (self) { scrollRot = self.progress * Math.PI * 0.8; }
      });
    }

    var clock = new THREE.Clock();
    var run = true;
    document.addEventListener('visibilitychange', function () { run = !document.hidden; });
    (function loop() {
      requestAnimationFrame(loop);
      if (!run) return;
      var t = clock.getElapsedTime();
      core.rotation.x = t * 0.22 + my * 0.35;
      core.rotation.y = t * 0.38 + mx * 0.45 + scrollRot;
      rings.rotation.y = t * 0.12;
      rings.rotation.z = Math.sin(t * 0.2) * 0.15;
      particles.children.forEach(function (p) {
        var u = p.userData;
        u.theta += u.sp * 0.008;
        p.position.set(
          u.rad * Math.sin(u.phi) * Math.cos(u.theta),
          u.rad * Math.sin(u.phi) * Math.sin(u.theta),
          u.rad * Math.cos(u.phi)
        );
      });
      camera.position.x += (mx * 0.9 - camera.position.x) * 0.06;
      camera.position.y += (-my * 0.6 - camera.position.y) * 0.06;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    })();
  }

  function initDashboardOrb() {
    if (dashboardOrbStarted || reduced || typeof THREE === 'undefined') return;
    var canvas = document.getElementById('dashboard-orb');
    if (!canvas) return;
    dashboardOrbStarted = true;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    var dpr = Math.min(1.75, window.devicePixelRatio || 1);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.2, 6.5);

    scene.add(new THREE.AmbientLight(0x8aa6ff, 0.4));
    var sun = new THREE.PointLight(0xffcb57, 1.6, 24);
    sun.position.set(2, 1, 5);
    scene.add(sun);

    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 36, 36),
      new THREE.MeshStandardMaterial({ color: 0xffcb57, emissive: 0x442200, metalness: 0.7, roughness: 0.25 })
    );
    scene.add(core);

    var halo = new THREE.Group();
    [[0.95, 0x00d4ff, 0.16, true], [1.25, 0x8aa6ff, 0.12, false], [1.55, 0xffcb57, 0.1, true]].forEach(function (c, i) {
      var torus = new THREE.Mesh(
        new THREE.TorusGeometry(c[0], 0.02, 10, 80),
        new THREE.MeshBasicMaterial({ color: c[1], transparent: true, opacity: c[2], wireframe: c[3] })
      );
      torus.rotation.x = Math.PI / 2 + i * 0.4;
      halo.add(torus);
    });
    scene.add(halo);

    var jobs = new THREE.Group();
    var jobCount = 14;
    for (var i = 0; i < jobCount; i++) {
      var dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + (i % 3) * 0.015, 10, 10),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? 0x8aa6ff : 0x5fd08a,
          emissive: i % 2 ? 0x0a1530 : 0x0a3020,
          metalness: 0.4, roughness: 0.35
        })
      );
      dot.userData = { angle: (i / jobCount) * Math.PI * 2, radius: 1.55 + (i % 4) * 0.18, speed: 0.28 + i * 0.035, y: (i % 5) * 0.12 };
      jobs.add(dot);
    }
    scene.add(jobs);

    var stars = new THREE.Group();
    for (var s = 0; s < 60; s++) {
      var star = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 + Math.random() * 0.35 })
      );
      star.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3 - 1);
      stars.add(star);
    }
    scene.add(stars);

    var mx = 0, my = 0, hover = false;
    canvas.addEventListener('mouseenter', function () { hover = true; });
    canvas.addEventListener('mouseleave', function () { hover = false; mx = my = 0; });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });

    function onResize() {
      var w = canvas.clientWidth || 320;
      var h = canvas.clientHeight || 220;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    onResize();
    window.addEventListener('resize', onResize);

    var clock = new THREE.Clock();
    (function anim() {
      requestAnimationFrame(anim);
      var t = clock.getElapsedTime();
      core.rotation.y = t * 0.4;
      core.rotation.x = Math.sin(t * 0.35) * 0.12;
      halo.rotation.y = t * 0.15;
      halo.rotation.x = my * 0.2;
      jobs.rotation.y += hover ? 0.014 + mx * 0.025 : 0.005;
      jobs.rotation.x = my * 0.18;
      jobs.children.forEach(function (dot) {
        var u = dot.userData;
        var a = u.angle + t * u.speed;
        dot.position.set(
          Math.cos(a) * u.radius,
          Math.sin(a * 1.4) * 0.42 + u.y,
          Math.sin(a) * u.radius
        );
      });
      stars.rotation.y = t * 0.02;
      camera.position.x += (mx * 0.35 - camera.position.x) * 0.05;
      camera.position.y += (0.2 - my * 0.25 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    })();
  }
  global.initDashboardOrb = initDashboardOrb;

  function initCinemaParallax() {
    if (reduced || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.utils.toArray('#how, #time, #pricing, #gaze, .sec-gaze').forEach(function (sec) {
      var inner = sec.querySelector('.wrap') || sec.querySelector('.gaze-grid') || sec.firstElementChild;
      if (!inner) return;
      gsap.fromTo(inner, { y: 32, rotateX: 2 }, {
        y: -24, rotateX: -1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
      });
    });

    gsap.utils.toArray('.flip-wrap').forEach(function (card) {
      gsap.to(card, {
        rotateY: 4, z: 20, transformPerspective: 900, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top 95%', end: 'top 35%', scrub: 0.6 }
      });
    });

    var stage = document.getElementById('heroStage');
    if (stage) {
      gsap.to('#heroOrb3d', {
        y: -40, scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: 1 }
      });
    }
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
        { ts: '09:01:13', cls: 'wait', msg: '獨家 AI 智能節奏投遞中…' },
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
    if (!portal) return;
    new MutationObserver(function () {
      if (portal.style.display !== 'none') {
        initDashboardOrb();
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }
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

  function presetLoginUserId(id) {
    var el = document.getElementById('loginUserId');
    if (el) el.value = String(id || '').trim();
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
      var loginField = document.getElementById('loginUserId');
      if (loginField) loginField.focus();
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

    initLenis();
    initCursor();
    initLogObservers();
    initDashboardOrbWatcher();
    initHeroOrb3D();
    initHeroEntrance();
    initHeroScrub();
    initCinemaParallax();
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

  function openTrialLogin() {
    presetLoginUserId('testshine');
    openLogin();
  }

  global.SHINE_MOTION = {
    get usesHeroScrub() { return heroScrubEnabled; },
    openLogin: openLogin,
    openTrialLogin: openTrialLogin,
    presetLoginUserId: presetLoginUserId,
    closeLogin: closeLogin,
    animateCount: animateCount,
    triggerScanLine: triggerScanLine,
    finishLoader: finishLoader,
    refresh: function () {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      syncLenisState();
    },
    lenis: function () { return lenisInstance; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);