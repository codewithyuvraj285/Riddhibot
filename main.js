/* Riddhix Technology - main.js */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* entrance */
addEventListener('load', () => setTimeout(() => document.body.classList.add('ready'), reduce ? 0 : 1700));
setTimeout(() => document.body.classList.add('ready'), 4000);

/* mobile menu */
const nv = $('#nv'), bm = $('#bm');
const setMenu = open => { nv.classList.toggle('open', open); bm.setAttribute('aria-expanded', open); bm.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
bm.onclick = () => setMenu(!nv.classList.contains('open'));
nv.addEventListener('click', e => { if (e.target.closest('a,button')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && nv.classList.contains('open')) { setMenu(false); bm.focus(); } });
addEventListener('resize', () => { if (innerWidth > 1040) setMenu(false); });

/* service rows */
const syncRows = () => $$('.row').forEach(x => x.firstElementChild.setAttribute('aria-expanded', x.classList.contains('on')));
$$('.row').forEach(r => r.firstElementChild.onclick = () => {
  const open = r.classList.contains('on');
  $$('.row').forEach(x => x.classList.remove('on'));
  if (!open) r.classList.add('on');
  syncRows();
});
$('.row').classList.add('on'); syncRows();

/* cursor + magnetic buttons */
const cur = $('.cur');
addEventListener('pointermove', e => {
  cur.style.opacity = 1; cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  cur.classList.toggle('big', !!e.target.closest('a,button,.row'));
});
$$('.mag').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`; });
  b.addEventListener('pointerleave', () => b.style.transform = '');
});

/* headline reveal for section titles */
const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); sio.unobserve(e.target); } }), { threshold: .3 });
$$('.split').forEach(h => {
  const words = []; h.childNodes.forEach(n => { const c = n.nodeType === 1 ? n.className : ''; n.textContent.trim().split(/\s+/).forEach(w => w && words.push([w, c])); }); h.innerHTML = '';
  words.forEach(([w, c], i) => { const s = document.createElement('span'); s.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.1em;margin-right:.26em'; s.innerHTML = `<span class="${c}" style="display:inline-block;transform:translateY(110%);transition:transform .9s cubic-bezier(.2,.8,.2,1) ${i * 60}ms">${w}</span>`; h.appendChild(s); });
  sio.observe(h);
});
const st = document.createElement('style'); st.textContent = '.split.in span span{transform:none!important}'; document.head.appendChild(st);

/* scroll: header, 3D layer stack, process line */
const hd = $('#hd'), stack = $('#layers'), iso = $('.iso'), layers = $$('.layer'), dots = $$('.dots i'), box = $('.sp-box'), pl = $('.pl'), tl = $('.tl'), stepLi = $$('.steps li');
const info = [
  ['Website Design', 'The layer your customers see first. Fast, responsive and built to turn visits into enquiries.'],
  ['IoT', 'Sensors and gateways feeding live data upward, so the site and apps always reflect what is really happening.'],
  ['Mobile Application', 'Phones put your product in people\u2019s hands. Apps connect to the same data and the same logic.'],
  ['Custom Software', 'The foundation: databases, APIs and business rules that every other layer relies on.']
];
let lastY = 0, cur_i = -1;
function setInfo(i) {
  if (i === cur_i) return; cur_i = i; box.classList.add('sw');
  setTimeout(() => { $('#sp-t').textContent = info[i][0]; $('#sp-d').textContent = info[i][1]; box.classList.remove('sw'); }, 220);
  layers.forEach(l => l.classList.toggle('on', l.style.getPropertyValue('--i') == 3 - i));
  dots.forEach((d, k) => d.classList.toggle('on', k === i));
}
function onScroll() {
  const y = scrollY; hd.classList.toggle('hide', y > lastY && y > 300 && !nv.classList.contains('open')); lastY = y;
  const p = clamp((y - stack.offsetTop) / (stack.offsetHeight - innerHeight), 0, 1);
  const ex = 1 - Math.pow(1 - clamp(p * 3, 0, 1), 3);
  iso.style.setProperty('--gap', (14 + ex * 96) + 'px');
  iso.style.transform = `rotateX(${58 - p * 8}deg) rotateZ(${-40 + p * 50}deg) translateZ(-90px)`;
  if (p > 0 && p < 1 || cur_i < 0) setInfo(Math.min(3, Math.floor(p * 4)));
  /* process line: fills down to the node it has reached; that node turns orange */
  const r = tl.getBoundingClientRect(), reach = clamp(innerHeight * .6 - r.top, 0, r.height), nodeR = stepLi[0].firstElementChild.offsetHeight / 2;
  pl.firstElementChild.style.height = clamp(reach - nodeR, 0, pl.offsetHeight) + 'px';
  stepLi.forEach(li => li.classList.toggle('on', li.offsetTop + nodeR <= reach));
}
addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true }); onScroll();

/* scroll progress bar, cursor glow, stat counters, FAQ */
const bar = $('#bar'), glow = $('#glow');
addEventListener('scroll', () => bar.style.width = scrollY / (document.documentElement.scrollHeight - innerHeight) * 100 + '%', { passive: true });
addEventListener('pointermove', e => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; });
const cio = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; cio.unobserve(e.target);
  const t = +e.target.dataset.n, suf = e.target.dataset.s || '', t0 = performance.now();
  (function step(now) { const k = reduce ? 1 : clamp((now - t0) / 1600, 0, 1); e.target.textContent = Math.round(t * (1 - Math.pow(1 - k, 3))) + (k === 1 ? suf : ''); if (k < 1) requestAnimationFrame(step); })(t0);
}), { threshold: .5 });
$$('[data-n]').forEach(c => cio.observe(c));
$$('.q').forEach(q => { q.firstElementChild.setAttribute('aria-expanded', 'false'); q.firstElementChild.onclick = () => { const o = q.classList.toggle('open'), d = q.lastElementChild; d.style.maxHeight = o ? d.scrollHeight + 30 + 'px' : 0; q.firstElementChild.setAttribute('aria-expanded', o); }; });

/* headline typing words + why-card spotlight/tilt + chat button + hero network */
(function () {
  const words = ['Website', 'Business', 'Devices', 'Mobile Presence', 'Future'], rot = $('#rot'); let wi = 0, ci = 0, del = false;
  if (reduce) rot.textContent = words[0]; else (function type() {
    const w = words[wi]; ci += del ? -1 : 1; rot.textContent = w.slice(0, ci); let d = del ? 45 : 95;
    if (!del && ci === w.length) { del = true; d = 1500; } else if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; d = 300; }
    setTimeout(type, d);
  })();

  $$('.wc').forEach(c => {
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      c.style.setProperty('--mx', x + 'px'); c.style.setProperty('--my', y + 'px');
      if (!reduce) c.style.transform = `perspective(800px) rotateY(${(x / r.width - .5) * 9}deg) rotateX(${-(y / r.height - .5) * 9}deg) translateY(-6px)`; });
    c.addEventListener('pointerleave', () => c.style.transform = '');
  });

  const fab = $('#chat-fab'), ct = $('#contact');
  new IntersectionObserver(e => fab.classList.toggle('off', e[0].isIntersecting), { threshold: .25 }).observe(ct);

  /* connected-dots network behind the hero */
  const cv = $('#net'), x = cv.getContext('2d'), hero = cv.parentElement; let W, H, P = [], m = { x: -999, y: -999 }, vis = true;
  function rs() { const d = Math.min(devicePixelRatio, 2); W = cv.offsetWidth; H = cv.offsetHeight; cv.width = W * d; cv.height = H * d; x.setTransform(d, 0, 0, d, 0, 0);
    P = Array.from({ length: Math.round(Math.min(80, W / 16)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, o: Math.random() < .2 })); }
  rs(); addEventListener('resize', rs);
  hero.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; });
  new IntersectionObserver(e => vis = e[0].isIntersecting).observe(hero);
  (function draw() {
    requestAnimationFrame(draw); if (!vis) return; x.clearRect(0, 0, W, H);
    for (const p of P) { if (!reduce) { p.x += p.vx; p.y += p.vy; } if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy); if (d < 140 && d > 0) { p.x += dx / d * 2; p.y += dy / d * 2; }
      x.beginPath(); x.arc(p.x, p.y, p.o ? 3 : 2, 0, 7); x.fillStyle = p.o ? '#ff8a1f' : '#1e88e5'; x.fill(); }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 130) { x.strokeStyle = `rgba(${a.o || b.o ? '255,138,31' : '30,136,229'},${.35 * (1 - d / 130)})`; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
  })();
})();

/* 3D hero (three.js): core + service-logo badges orbiting on the ring */
(function () {
  const cv = $('#gl'), hv = $('#hv'); if (!cv) return;
  /* no three.js (CDN blocked) or no WebGL: show the lightweight SVG orb instead */
  let R; try { if (typeof THREE === 'undefined') throw 0; R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (err) { hv.classList.add('fb'); return; }
  R.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
  const S = new THREE.Scene(), FOV = 40, C = new THREE.PerspectiveCamera(FOV, 1, .1, 200); C.position.z = 14;
  S.add(new THREE.AmbientLight(0xffffff, .6));
  const k = new THREE.DirectionalLight(0xffffff, 1.1); k.position.set(4, 5, 6); S.add(k);
  const o = new THREE.PointLight(0xff8a1f, 2.4, 30); o.position.set(-5, -3, 4); S.add(o);
  const b = new THREE.PointLight(0x1e88e5, 2, 30); b.position.set(5, -4, -2); S.add(b);
  const G = new THREE.Group(); S.add(G);
  const ADD = THREE.AdditiveBlending;
  const glowTex = (rgb, a) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('30,136,229', .55), blending: ADD, depthWrite: false, transparent: true })); aura.scale.setScalar(10.5); aura.position.z = -2; G.add(aura);

  /* core: blue -> cyan -> orange tips, vertex coloured */
  const geo = new THREE.IcosahedronGeometry(1.7, 7), base = geo.attributes.position.array.slice();
  const cols = new Float32Array(geo.attributes.position.count * 3); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const core = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .55, roughness: .22 })); G.add(core);
  const cA = new THREE.Color(0x0a4bb0), cB = new THREE.Color(0x1e88e5), cC = new THREE.Color(0xff8a1f), tc = new THREE.Color();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.25, 2), new THREE.MeshBasicMaterial({ color: 0xff8a1f, wireframe: true, transparent: true, opacity: .3 })); G.add(shell);
  const R0 = 3.1, TILT = 1.25;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R0, .035, 12, 240), new THREE.MeshBasicMaterial({ color: 0xff8a1f })); ring.rotation.x = TILT; G.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.7, .018, 12, 240), new THREE.MeshBasicMaterial({ color: 0x1e88e5 })); ring2.rotation.set(1.9, .4, 0); G.add(ring2);

  /* service logos (same icons as the service cards) */
  const SV = [
    { n: 'Website Design', c: ['#1e88e5', '#0a4bb0'], rgb: '30,136,229', hex: 0x1e88e5, p: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'] },
    { n: 'IoT', c: ['#ffb347', '#ff6a00'], rgb: '255,138,31', hex: 0xff8a1f, p: ['M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 18z', 'M9.5 13.5a3.5 3.5 0 0 1 5 0M11 16h2'] },
    { n: 'Mobile Application', c: ['#1e88e5', '#0a4bb0'], rgb: '30,136,229', hex: 0x1e88e5, p: ['M9.5 2.5h5A2.5 2.5 0 0 1 17 5v14a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19V5a2.5 2.5 0 0 1 2.5-2.5z', 'M10.5 10l-2 2 2 2M13.5 10l2 2-2 2M11 18.5h2'] },
    { n: 'Custom Software', c: ['#ffb347', '#ff6a00'], rgb: '255,138,31', hex: 0xff8a1f, p: ['M8.8 12a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1'] }
  ];
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  function tile(s) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, s.c[0]); g.addColorStop(1, s.c[1]); rr(x, 6, 6, 244, 244, 58); x.fillStyle = g; x.fill();
    const sh = x.createLinearGradient(0, 0, 0, 160); sh.addColorStop(0, 'rgba(255,255,255,.4)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); rr(x, 6, 6, 244, 160, 58); x.fillStyle = sh; x.fill();
    rr(x, 6, 6, 244, 244, 58); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.5)'; x.stroke();
    x.save(); x.translate(53, 53); x.scale(6.2, 6.2); x.lineWidth = 1.7; x.lineCap = x.lineJoin = 'round'; x.strokeStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 3;
    s.p.forEach(d => x.stroke(new Path2D(d))); x.restore();
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function labelTex(s) { const c = document.createElement('canvas'); c.width = 512; c.height = 112; s.lc = c; s.lt = new THREE.CanvasTexture(c); paint(s); return s.lt; }
  function paint(s) { const x = s.lc.getContext('2d'); x.clearRect(0, 0, 512, 112); rr(x, 4, 4, 504, 104, 52); x.fillStyle = 'rgba(5,11,26,.8)'; x.fill(); x.lineWidth = 2; x.strokeStyle = `rgba(${s.rgb},.7)`; x.stroke();
    x.font = '700 44px Syne, "Instrument Sans", sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.n, 256, 58); s.lt.needsUpdate = true; }
  if (document.fonts && document.fonts.load) document.fonts.load('700 44px Syne').then(() => SV.forEach(paint));
  function slabGeo() { const w = .98, r = .24, h = w / 2, sh = new THREE.Shape();
    sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: .16, bevelEnabled: true, bevelThickness: .05, bevelSize: .035, bevelSegments: 3, curveSegments: 10 }); g.translate(0, 0, -.08); return g; }
  const sg = slabGeo(), TN = 48, pick3 = [];
  const sats = SV.map((s, i) => {
    const m = new THREE.Group();
    const slab = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x0a1630, metalness: .7, roughness: .3, emissive: s.hex, emissiveIntensity: .3 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshBasicMaterial({ map: tile(s), transparent: true })); face.position.z = .136;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .415), new THREE.MeshBasicMaterial({ map: labelTex(s), transparent: true, depthWrite: false })); lab.position.set(0, -.86, .1);
    const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(s.rgb, .6), blending: ADD, depthWrite: false, transparent: true, opacity: .65 })); hl.scale.setScalar(3.1); hl.position.z = -.25;
    slab.userData.i = face.userData.i = i; pick3.push(slab, face); m.add(hl, slab, face, lab); m.userData.hl = hl; G.add(m);
    const tg = new THREE.BufferGeometry(), col = new Float32Array(TN * 3), cc = new THREE.Color(s.hex);
    for (let j = 0; j < TN; j++) { const f = Math.pow(1 - j / (TN - 1), 2); col.set([cc.r * f, cc.g * f, cc.b * f], j * 3); }
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 3), 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.userData.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, blending: ADD, transparent: true, depthWrite: false })); G.add(m.userData.trail);
    return m;
  });
  const orbit = (a, v) => v.set(R0 * Math.cos(a), R0 * Math.sin(a) * Math.cos(TILT), R0 * Math.sin(a) * Math.sin(TILT));

  /* particles, blue + orange */
  const N = 280, pp = new Float32Array(N * 3), pc = new Float32Array(N * 3), cb = new THREE.Color(0x1e88e5), co = new THREE.Color(0xff8a1f);
  for (let i = 0; i < N; i++) { const r = 4.5 + Math.random() * 3, t = Math.random() * 6.28, u = Math.random() * 3.14; pp[i * 3] = r * Math.sin(u) * Math.cos(t); pp[i * 3 + 1] = r * Math.cos(u); pp[i * 3 + 2] = r * Math.sin(u) * Math.sin(t); const q = Math.random() < .22 ? co : cb; pc.set([q.r, q.g, q.b], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .065, vertexColors: true, transparent: true, opacity: .9, blending: ADD, depthWrite: false })); S.add(pts);

  /* fit: everything that matters (outer ring + logo badges + labels) lives inside a sphere of radius FIT.
     Put the camera exactly far enough away that this sphere is fully inside the panel, whatever its shape. */
  const FIT = 4.6;
  function size() {
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight), a = w / h;
    R.setSize(w, h, false); C.aspect = a;
    const vf = FOV * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * a);
    C.position.z = FIT / Math.sin(Math.min(vf, hf) / 2);
    C.updateProjectionMatrix(); G.position.set(0, 0, 0); G.scale.setScalar(1);
  }
  size(); addEventListener('resize', size); if (window.ResizeObserver) new ResizeObserver(size).observe(cv);

  /* hover + click on logos */
  const ray = new THREE.Raycaster(), nd = new THREE.Vector2(); let hov = -1;
  function pick(cx, cy) { const r = cv.getBoundingClientRect(); if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return -1;
    nd.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(nd, C); const h = ray.intersectObjects(pick3); return h.length ? h[0].object.userData.i : -1; }
  addEventListener('pointermove', e => { hov = pick(e.clientX, e.clientY); if (hov >= 0) cur.classList.add('big'); });
  addEventListener('click', e => { if (e.target.closest('a,button,nav,form')) return; const i = pick(e.clientX, e.clientY); if (i < 0) return;
    $$('.row').forEach((r, n) => r.classList.toggle('on', n === i)); $('#services').scrollIntoView({ behavior: 'smooth' }); });

  let mx = 0, my = 0, tx = 0, ty = 0, vis = true, speed = 1, ang = 0, last = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
  new IntersectionObserver(e => vis = e[0].isIntersecting).observe(cv);
  const clock = new THREE.Clock(), pos = geo.attributes.position, tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), te = new THREE.Euler(), v = new THREE.Vector3();
  (function loop() {
    requestAnimationFrame(loop); if (!vis) return;
    const now = clock.getElapsedTime(), t = now * (reduce ? 0 : 1), dt = Math.min(.05, now - last); last = now;
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2]; const d = 1 + .09 * Math.sin(x * 1.7 + t * 1.2) * Math.sin(y * 1.5 + t) + .05 * Math.sin(z * 2.6 - t * 1.4); pos.setXYZ(i, x * d, y * d, z * d);
      const u = clamp((d - .88) / .26, 0, 1); tc.copy(cA).lerp(cB, u).lerp(cC, Math.max(0, u - .72) * 2.2); cols[i * 3] = tc.r; cols[i * 3 + 1] = tc.g; cols[i * 3 + 2] = tc.b; }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
    core.rotation.y = t * .15; shell.rotation.y = -t * .1; shell.rotation.x = t * .07; ring.rotation.z = t * .25; ring2.rotation.z = -t * .18; pts.rotation.y = t * .03;
    tx += (mx - tx) * .05; ty += (my - ty) * .05;
    G.rotation.y = tx * .9 + scrollY * .0008; G.rotation.x = ty * .5;
    speed += ((hov >= 0 ? .12 : 1) - speed) * .08; if (!reduce) ang += dt * .36 * speed;
    tq.copy(G.quaternion).invert().multiply(C.quaternion);
    sats.forEach((m, i) => {
      const a = ang + i * Math.PI / 2; orbit(a, m.position);
      te.set(.16 * Math.sin(t * .9 + i), .3 * Math.sin(t * .7 + i * 1.7), 0); tq2.setFromEuler(te); m.quaternion.copy(tq).multiply(tq2);
      const sc = m.scale.x + ((i === hov ? 1.28 : 1) - m.scale.x) * .12; m.scale.setScalar(sc);
      const hm = m.userData.hl.material; hm.opacity += ((i === hov ? 1 : .65) - hm.opacity) * .1;
      const tp = m.userData.trail.geometry.attributes.position; for (let j = 0; j < TN; j++) { orbit(a - j * .022, v); tp.setXYZ(j, v.x, v.y, v.z); } tp.needsUpdate = true;
    });
    R.render(S, C);
  })();
})();
