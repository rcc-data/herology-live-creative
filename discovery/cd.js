/* Herology Creative Discovery (static). Only global: window.CD. Data: ./data/ads.json, ./data/brands.json */
(function () {
  'use strict';
  const CD = (window.CD = window.CD || {});
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtN = n => (n == null || isNaN(n) ? '0' : Number(n).toLocaleString('en-IE'));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const BATCH = 48;
  const PRODUCTS = ['Balance', 'PPN', 'Meno', 'Zen', 'Collagen', 'Inositol', 'Creatine', "Men's Prenatal"];
  const BEN = ['hormones/PMS', 'menopause', 'fertility/pregnancy', 'postnatal', 'sleep/stress', 'skin/hair', 'PCOS', 'energy', 'performance', 'gut', 'other'];
  const BENL = v => ({'hormones/PMS':'Hormones / PMS','menopause':'Menopause','fertility/pregnancy':'Fertility / pregnancy','postnatal':'Postnatal','sleep/stress':'Sleep / stress','skin/hair':'Skin / hair','PCOS':'PCOS','energy':'Energy','performance':'Performance','gut':'Gut'})[v] || v;
  const PROOF = ['reviews', 'founder', 'expert/GP', 'study', 'before-after', 'UGC testimonial', 'press'];
  const OFFER = ['subscription', 'bundle', '% off', 'gift', 'free shipping', 'none'];
  const FMT = ['video', 'image', 'carousel'];
  const ASP = ['9:16', '4:5', '1:1', '16:9'];
  const HOOKF = ['Question', 'Symptom callout', 'POV / Relatable', 'Bold claim', 'Expert intro', 'Testimonial quote', 'Personal story', 'Social proof / Numbers', 'Offer / Price first', 'Product reveal', 'List / Tips', 'Myth buster / Mistake', 'Results / Before and after', 'Founder story', 'Urgency', 'Ingredient focus', 'Visual only', 'Other'];
  const COLORS = { video: '#8580C4', image: '#D88A7A', carousel: '#D1AE6E' };
  const ICON = {
    play: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    filter: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('hcd_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('hcd_' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  const S = { cards: [], byId: {}, brands: [], tab: 'discover', q: '', sort: store.get('sort', 'newest'), f: F0(), brand: null,
    hk: { q: '', fmt: null, who: 'all', sort: 'proven' }, incHg: store.get('incHg', false), auto: store.get('auto', false), gapView: 'market', gapMkt: store.get('gapMkt', 'ALL'), meta: {} };
  CD.state = S;
  function F0() { return { market: new Set(), brand: new Set(), vf: new Set(), benefit: new Set(), ingredient: new Set(), proof: new Set(), offer: new Set(), fmt: new Set(), aspect: new Set(), match: new Set(), status: new Set(), proven: new Set() }; }
  const FKEYS = ['market', 'brand', 'vf', 'fmt', 'match', 'benefit', 'ingredient', 'proof', 'offer', 'aspect', 'status', 'proven'];
  const FLABEL = { market: 'Market', brand: 'Brand', vf: 'Creative type (Motion)', match: 'Herology product', benefit: 'Benefit', ingredient: 'Ingredient', proof: 'Proof', offer: 'Offer', fmt: 'Format (Motion)', aspect: 'Aspect', status: 'Live or ended', proven: 'Proven' };

  // ------------------------------------------------------------ data
  async function load() {
    const [a, b] = await Promise.all([fetch('data/ads.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('ads.json HTTP ' + r.status); return r.json(); }),
      fetch('data/brands.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('brands.json HTTP ' + r.status); return r.json(); })]);
    const F = a.fields;
    S.meta = { built: a.built, today: a.today, pending: a.pending || [], gaps: a.gaps || [], gapsBy: a.gapsByMarket || {}, memberHooks: a.memberHooks || {},
      markets: a.markets || { IE: 'Ireland' } };
    MK_ORDER = Object.keys(S.meta.markets);
    S.cards = a.cards.map(row => { const o = {}; F.forEach((k, i) => (o[k] = row[i])); return prep(o); });
    S.cards.forEach(c => { S.byId[c.id] = c; (c.formats || []).forEach(m => { if (!S.byId[m.id]) S.byId[m.id] = c; }); });
    S.brands = b;
    S.logos = await fetch('data/logos.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  let MK_ORDER = ['IE'];
  const mkName = k => (S.meta.markets && S.meta.markets[k]) || k || 'Ireland';
  function prep(c) {
    c.hg = c.brand === 'Herology';
    c.mkt = mkName(c.market);
    c.provenTag = c.isProven ? ['Proven (60+ days)'] : [];
    c.age = c.start ? Math.round((Date.parse(S.meta.today || '2026-11-10') - Date.parse(c.start)) / 864e5) : 999;
    c.hay = norm([c.brand, c.title, c.text, c.hook, c.onscreen, c.link, c.cta, c.match, (c.benefit || []).join(' '), (c.ingredient || []).join(' '), (c.proof || []).join(' '), (c.offer || []).join(' '), (c.vf || []).join(' '), c.hookFormat, c.adName].join(' '));
    return c;
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }
  function val(c, k) {
    if (k === 'status') return [c.status === 'active' ? 'Live' : 'Ended'];
    if (k === 'proven') return c.isProven ? ['Proven (60+ days)'] : [];
    if (k === 'match') return [c.match || 'none'];
    if (k === 'market') return [c.mkt];
    const v = c[k];
    return Array.isArray(v) ? v : v == null ? [] : [v];
  }
  function ratio(a) { return { '9:16': 9 / 16, '4:5': 0.8, '1:1': 1, '16:9': 16 / 9 }[a] || 0.8; }
  function poster(c) { return c.poster || (c.imgs && c.imgs[0]) || ''; }

  // ------------------------------------------------------------ filtering
  function qMatch(c, terms) { return terms.every(t => c.hay.includes(t)); }
  function fMatch(c, F, skip) {
    for (const k of FKEYS) {
      if (k === skip || !F[k].size) continue;
      const v = val(c, k);
      if (!v.some(x => F[k].has(x))) return false;
    }
    return true;
  }
  function terms() { return norm(S.q).split(/\s+/).filter(Boolean); }
  function filtered(base, F = S.f, skip) { const t = terms(); return base.filter(c => qMatch(c, t) && fMatch(c, F, skip)); }
  function sorted(arr) {
    const s = S.sort;
    const k = s === 'proven' ? c => -(c.proven || 0) : s === 'longest' ? c => -(c.days || 0) : c => -(Date.parse(c.start || 0) || 0);
    return arr.slice().sort((a, b) => k(a) - k(b) || (b.proven || 0) - (a.proven || 0));
  }
  function fToQS() {
    const p = new URLSearchParams();
    FKEYS.forEach(k => { if (S.f[k].size) p.set(k, [...S.f[k]].join('~')); });
    if (S.q.trim()) p.set('q', S.q.trim());
    if (S.sort !== 'newest') p.set('sort', S.sort);
    return p.toString();
  }
  function fFromQS(qs) {
    const p = new URLSearchParams(qs || '');
    S.f = F0();
    FKEYS.forEach(k => { const v = p.get(k); if (v) v.split('~').filter(Boolean).forEach(x => S.f[k].add(x)); });
    S.q = p.get('q') || '';
    if (p.get('sort')) S.sort = p.get('sort');
  }

  // ------------------------------------------------------------ routing
  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    const [path, qs] = h.split('?');
    const parts = (path || 'discover').split('/');
    return { parts, qs };
  }
  let lastPath = null;
  function route() {
    const { parts, qs } = parseHash();
    const adIdx = parts.indexOf('ad');
    const adId = adIdx >= 0 ? parts[adIdx + 1] : null;
    const base = adIdx >= 0 ? parts.slice(0, adIdx) : parts;
    const tab = ['discover', 'herology', 'brands', 'hooks', 'gaps', 'trending'].includes(base[0]) ? base[0] : 'discover';
    const pathKey = base.join('/') + '?' + (qs || '');
    S.tab = tab;
    S.brand = tab === 'brands' && base[1] ? base[1] : null;
    if (pathKey !== lastPath) {
      lastPath = pathKey;
      if (tab === 'discover' || tab === 'herology' || (tab === 'brands' && S.brand)) fFromQS(qs);
      draw();
    }
    if (adId) openViewer(adId, false); else closeViewer(false);
  }
  function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }
  CD.go = go;
  function curBase() { const { parts } = parseHash(); const i = parts.indexOf('ad'); return (i >= 0 ? parts.slice(0, i) : parts).join('/') || 'discover'; }
  function setQS() { const qs = fToQS(); const h = '#' + curBase() + (qs ? '?' + qs : ''); lastPath = curBase() + '?' + qs; history.replaceState(null, '', h); }

  // ------------------------------------------------------------ shell
  function header() {
    const comp = S.cards.filter(c => !c.hg);
    const hg = S.cards.filter(c => c.hg);
    const nb = new Set(comp.map(c => c.brand)).size;
    const nm = new Set(comp.map(c => c.market)).size;
    $('#cd-stats').innerHTML = [
      [fmtN(comp.length), 'Market cards'], [fmtN(nb), 'Brands'], [fmtN(nm), 'Markets'], [fmtN(comp.filter(c => c.status === 'active').length), 'Live', 'p'], [fmtN(hg.length), 'Herology cards'],
    ].map(([n, l, c]) => `<div class="cd-stat"><span class="num ${c || ''}">${n}</span><span class="lbl">${l}</span></div>`).join('');
    $('#cd-foot').innerHTML = `Markets: ${esc(MK_ORDER.map(mkName).join(', '))}. Market ads from Motion's Inspo library (last 12 months, English, supplements that overlap Herology's range, no advertorials), at most 100 ads per brand (34 longest running, 33 newest, 33 most saved; a few global brands such as AG1 and Cymbiotika at 30); Herology ads from the Creative Hub (all ads with spend). A card is one creative; its sizes (9:16, 4:5, 1:1, 16:9) sit inside it. Irish brands ${esc(S.meta.pending.join(', '))} are coming from Meta Ad Library in a later run. Data built ${esc((S.meta.built || '').replace('T', ' '))} UTC. Proven = 60+ days live; Proven score = days live (max 90) + concept variants + parallel launches.`;
  }
  function tabs() { $$('#cd-tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === S.tab)); }
  function draw() {
    tabs();
    const m = $('#cd-main');
    teardownGrid();
    if (S.tab === 'brands') return S.brand ? vBrand(m) : vBrands(m);
    if (S.tab === 'hooks') return vHooks(m);
    if (S.tab === 'gaps') return vGaps(m);
    if (S.tab === 'trending') return vTrending(m);
    if (S.tab === 'herology') return vHerology(m);
    return vDiscover(m);
  }

  // ------------------------------------------------------------ cards + grid
  function cardHTML(c, small) {
    const p = poster(c);
    const r = ratio(c.aspect);
    const n = c.n > 1 ? `<span class="cd-pill">${c.n} sizes</span>` : '';
    const vid = c.fmt === 'video' && c.video ? ` data-v="${esc(c.video)}"` : '';
    const hl = c.hook || c.title || (c.text || '').slice(0, 120);
    return `<article class="cd-card" data-open="${esc(c.id)}" tabindex="0" aria-label="${esc(c.brand)} ad">
      <div class="cd-fr" style="aspect-ratio:${r.toFixed(4)}"${vid}>
        ${p ? `<img data-src="${esc(p)}" alt="" decoding="async">` : ''}<div class="cd-shim"></div>
        <span class="cd-tagv">${c.fmt === 'video' ? ICON.play + (small ? '' : ' Video') : c.fmt === 'carousel' ? 'Carousel' : 'Image'}${small ? '' : ' · ' + esc(c.aspect)}</span>
        ${c.isProven ? `<span class="cd-tagp">${small ? 'P' : 'Proven'}</span>` : ''}
      </div>
      <div class="cd-cb">
        <div class="t"><span class="b ${c.hg ? 'hg' : ''}" title="${esc(c.mkt)}">${LG(c.brand, 18)}${esc(c.brand)}</span><span>${fmtN(c.days)}d${c.status === 'active' ? ' · live' : ''}</span></div>
        ${small ? '' : `<p class="h">${esc(hl)}</p>`}
        ${small ? '' : `<div class="cd-pills">${c.match && c.match !== 'none' ? `<span class="cd-pill m">${esc(c.match)}</span>` : ''}${(c.vf || []).slice(0, 1).map(x => `<span class="cd-pill t">${esc(x)}</span>`).join('')}${(c.benefit || []).filter(x => x !== 'other').slice(0, 1).map(x => `<span class="cd-pill">${esc(x)}</span>`).join('')}${n}</div>`}
      </div></article>`;
  }
  let IO = null, MORE = null, G = null;
  function imgIO() {
    return IO || (IO = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const img = e.target; IO.unobserve(img);
      img.onload = () => img.classList.add('ld');
      img.onerror = () => { img.remove(); };
      img.src = img.dataset.src;
    }), { rootMargin: '600px 0px' }));
  }
  function watchImgs(el) { $$('img[data-src]', el).forEach(i => imgIO().observe(i)); }
  function nCols(w) { return w < 560 ? 2 : w < 900 ? 3 : w < 1200 ? 4 : w < 1600 ? 5 : 6; }
  function teardownGrid() { if (MORE) MORE.disconnect(); MORE = null; if (typeof AIO !== 'undefined' && AIO) { AIO.disconnect(); AIO = null; AP.forEach(stopAuto); AP.clear(); VIS.clear(); } G = null; }
  function grid(host, list) {
    teardownGrid();
    const w = host.clientWidth || window.innerWidth;
    const cols = nCols(w);
    host.innerHTML = `<div class="cd-grid">${Array.from({ length: cols }, () => '<div class="cd-col"></div>').join('')}</div><div class="cd-more" aria-live="polite"></div>`;
    G = { host, list, i: 0, cols: $$('.cd-col', host), hs: new Array(cols).fill(0), more: $('.cd-more', host) };
    if (!list.length) { host.innerHTML = `<div class="cd-empty"><b>No ads match.</b> Try clearing a filter or using fewer words.</div>`; return; }
    addBatch();
    MORE = new IntersectionObserver(es => { if (es[0].isIntersecting) addBatch(); }, { rootMargin: '1200px 0px' });
    MORE.observe(G.more);
    autoSync();
  }
  // autoplay (off by default): every video card that is mostly on screen is a candidate; the 6 most visible play,
  // muted and looping. Cards added by infinite scroll are watched as they arrive; when one leaves, the next visible one takes its slot.
  let AIO = null; const AP = new Set(); const VIS = new Map(); const AP_MAX = 6; let APT = 0;
  function autoSync() {
    if (AIO) { AIO.disconnect(); AIO = null; }
    AP.forEach(stopAuto); AP.clear(); VIS.clear();
    if (!S.auto || !G) return;
    AIO = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting && e.intersectionRatio >= 0.5) VIS.set(e.target, e.intersectionRatio); else VIS.delete(e.target); }); clearTimeout(APT); APT = setTimeout(rebalance, 120); }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    $$('.cd-fr[data-v]', G.host).forEach(fr => AIO.observe(fr));
  }
  function rebalance() {
    const want = [...VIS.entries()].filter(([fr]) => fr.isConnected)
      .sort((a, b) => b[1] - a[1] || a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top)
      .slice(0, AP_MAX).map(x => x[0]);
    [...AP].forEach(fr => { if (!want.includes(fr)) { stopAuto(fr); AP.delete(fr); } });
    want.forEach(fr => { if (!AP.has(fr) && !(H && H.fr === fr)) { startAuto(fr); AP.add(fr); } });
  }
  function startAuto(fr) { const v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.className = 'ap';
    v.addEventListener('playing', () => fr.classList.add('play')); v.addEventListener('error', () => { fr.classList.remove('play'); });
    v.src = fr.dataset.v; fr.appendChild(v); const go = () => v.play().catch(() => {}); if (v.readyState >= 2) go(); else v.addEventListener('loadeddata', go, { once: true }); go(); }
  function stopAuto(fr) { const v = fr.querySelector('video.ap'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } fr.classList.remove('play'); }
  document.addEventListener('visibilitychange', () => { if (!S.auto) return; if (document.hidden) { AP.forEach(stopAuto); AP.clear(); } else rebalance(); });
  function addBatch() {
    if (!G || G.i >= G.list.length) return;
    const g = G;
    const end = Math.min(g.i + BATCH, g.list.length);
    const colW = g.cols[0].clientWidth || 200;
    for (; g.i < end; g.i++) {
      const c = g.list[g.i];
      let k = 0; for (let j = 1; j < g.hs.length; j++) if (g.hs[j] < g.hs[k] - 1) k = j;
      const t = document.createElement('template'); t.innerHTML = cardHTML(c).trim();
      const el = t.content.firstElementChild; g.cols[k].appendChild(el);
      g.hs[k] += colW / ratio(c.aspect) + 90;
      watchImgs(el);
      if (AIO) $$('.cd-fr[data-v]', el).forEach(fr => AIO.observe(fr));
    }
    g.more.textContent = g.i < g.list.length ? `Showing ${fmtN(g.i)} of ${fmtN(g.list.length)}` : `All ${fmtN(g.list.length)} shown`;
  }
  // hover = play only; the video src is set only on hover and removed on leave
  let H = null;
  function hoverIn(fr) {
    if (H && H.fr === fr) return; hoverOut(); if (fr.querySelector('video.ap')) return;
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto'; v.setAttribute('playsinline', '');
    v.src = fr.dataset.v;
    fr.appendChild(v);
    v.addEventListener('playing', () => fr.classList.add('play'));
    v.play().catch(() => {});
    H = { fr, v };
  }
  function hoverOut() { if (!H) return; const { fr, v } = H; v.pause(); v.removeAttribute('src'); v.load(); v.remove(); fr.classList.remove('play'); H = null; }
  document.addEventListener('mouseover', e => { if (!matchMedia('(hover:hover)').matches) return; const fr = e.target.closest && e.target.closest('.cd .cd-fr[data-v]'); if (fr) hoverIn(fr); else if (H && !H.fr.contains(e.target)) hoverOut(); });
  document.addEventListener('mouseleave', hoverOut);

  // ------------------------------------------------------------ Discover
  function bar(host, base, opts = {}) {
    const fc = FKEYS.reduce((n, k) => n + S.f[k].size, 0);
    host.innerHTML = `<div class="cd-bar">
      <label class="cd-search">${ICON.search}<input id="cd-q" type="search" placeholder="Search hooks, copy, brands, ingredients" value="${esc(S.q)}" aria-label="Search ads"></label>
      <button class="cd-btn" id="cd-fbtn" aria-expanded="false">${ICON.filter} Filters${fc ? ' · ' + fc : ''}</button>
      <select class="cd-sel" id="cd-sort" aria-label="Sort"><option value="newest">Newest</option><option value="proven">Proven score</option><option value="longest">Longest running</option></select>
      <span class="cd-count" id="cd-count"></span></div>
      <div class="cd-row2">${opts.hgToggle ? `<label class="cd-sw"><input type="checkbox" id="cd-inchg" ${S.incHg ? 'checked' : ''}><span></span>Include Herology</label>` : ''}<label class="cd-sw"><input type="checkbox" id="cd-auto" ${S.auto ? 'checked' : ''}><span></span>Autoplay videos</label>
      <div class="cd-vfq" id="cd-vfq" role="group" aria-label="Benefit"></div></div>
      <div class="cd-chips" id="cd-act"></div><div id="cd-gridhost"></div>`;
    $('#cd-sort', host).value = S.sort;
    let tq;
    $('#cd-q', host).addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.q = e.target.value; setQS(); refresh(); }, 180); });
    $('#cd-sort', host).addEventListener('change', e => { S.sort = e.target.value; store.set('sort', S.sort); setQS(); refresh(); });
    $('#cd-fbtn', host).addEventListener('click', () => openFilters(base, opts.skip));
    if (opts.hgToggle) $('#cd-inchg', host).addEventListener('change', e => { S.incHg = e.target.checked; store.set('incHg', S.incHg); draw(); });
    $('#cd-auto', host).addEventListener('change', e => { S.auto = e.target.checked; store.set('auto', S.auto); autoSync(); });
    $('#cd-vfq', host).addEventListener('click', e => { const b = e.target.closest('button[data-vfq]'); if (!b) return; const v = b.dataset.vfq; S.f.benefit.has(v) ? S.f.benefit.delete(v) : S.f.benefit.add(v); setQS(); refresh(); });
    const refresh = () => {
      const list = sorted(filtered(base, S.f, opts.skip));
      $('#cd-count').textContent = `${fmtN(list.length)} of ${fmtN(base.length)} cards` + (S.q.trim() ? ` for "${S.q.trim()}"` : '');
      $('#cd-act').innerHTML = FKEYS.filter(k => k !== opts.skip).flatMap(k => [...S.f[k]].map(v => `<button class="cd-chip" data-rm="${esc(k)}" data-v="${esc(v)}">${esc(FLABEL[k])}: ${esc(v)} <i>✕</i></button>`)).join('') +
        (FKEYS.some(k => S.f[k].size) ? '<button class="cd-chip" data-clear>Clear all</button>' : '');
      const fcn = FKEYS.reduce((n, k) => n + (k === opts.skip ? 0 : S.f[k].size), 0);
      $('#cd-fbtn').innerHTML = `${ICON.filter} Filters${fcn ? ' · ' + fcn : ''}`;
      const bc = {}; filtered(base, S.f, 'benefit').forEach(c => (c.benefit || []).forEach(v => (bc[v] = (bc[v] || 0) + 1)));
      const top = BEN.filter(v => v !== 'other' && (bc[v] || S.f.benefit.has(v))).sort((a, b) => (bc[b] || 0) - (bc[a] || 0));
      $('#cd-vfq').innerHTML = top.length ? `<span class="lbl">Benefits</span>` + top.map(v => `<button class="cd-q ${S.f.benefit.has(v) ? 'on' : ''}" data-vfq="${esc(v)}" aria-pressed="${S.f.benefit.has(v)}">${esc(BENL(v))} <b>${fmtN(bc[v] || 0)}</b></button>`).join('') : '';
      grid($('#cd-gridhost'), list);
    };
    $('#cd-act', host).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-clear')) FKEYS.forEach(k => { if (k !== opts.skip) S.f[k].clear(); }); else S.f[b.dataset.rm].delete(b.dataset.v);
      setQS(); refresh();
    });
    S.refresh = refresh;
    refresh();
  }
  function vDiscover(m) {
    m.innerHTML = `<div class="cd-h"><div><h2>Discover</h2><p>Supplement ads that overlap Herology's range in ${esc(MK_ORDER.map(mkName).join(', '))}. Herology's own ads are in the Herology tab (switch them on here to compare). Filter by benefit below, or by Motion's creative types and formats in Filters. Hover a video to play it, or switch on autoplay; click any card for the hook, copy and sizes.</p></div></div>
      ${S.meta.pending.length ? `<div class="cd-note"><b>More Irish brands coming.</b> ${esc(S.meta.pending.join(', '))} are not in Motion; they will be added from Meta Ad Library in a later run.</div>` : ''}<div id="cd-db"></div>`;
    bar($('#cd-db'), S.incHg ? S.cards : S.cards.filter(c => !c.hg), { hgToggle: true });
  }
  function vHerology(m) {
    const hg = S.cards.filter(c => c.hg);
    m.innerHTML = `<div class="cd-h"><div><h2>Herology</h2><p>Herology's own ads with spend from the Creative Hub (${fmtN(hg.length)} cards), with the same hooks, tags and Motion-style filters as the market. Compare against the market in Herology vs market.</p></div></div><div id="cd-db"></div>`;
    bar($('#cd-db'), hg, { skip: 'brand' });
  }

  // ------------------------------------------------------------ filters drawer
  let FD = null;
  function openFilters(base, skip) {
    FD = { base, skip, D: cloneF(S.f) };
    let o = $('#cd-fd');
    if (!o) { o = document.createElement('div'); o.id = 'cd-fd'; o.className = 'cd-fd'; $('#cd-app').appendChild(o); o.addEventListener('click', onFD); }
    o.hidden = false; drawFD(); document.documentElement.style.overflow = 'hidden';
    $('#cd-fbtn') && $('#cd-fbtn').setAttribute('aria-expanded', 'true');
  }
  function cloneF(F) { const o = F0(); FKEYS.forEach(k => F[k].forEach(v => o[k].add(v))); return o; }
  function opts(k, base) {
    const all = { market: MK_ORDER.map(mkName), brand: [...new Set(S.cards.map(c => c.brand))].sort((a, b) => (a === 'Herology' ? -1 : b === 'Herology' ? 1 : a.localeCompare(b))), match: [...PRODUCTS, 'none'], benefit: BEN, proof: PROOF, offer: OFFER, fmt: FMT, aspect: ASP, vf: VFS(), status: ['Live', 'Ended'], proven: ['Proven (60+ days)'],
      ingredient: [...new Set(base.flatMap(c => c.ingredient || []))].sort() }[k];
    return all;
  }
  function VFS() { const o = {}; S.cards.forEach(c => (c.vf || []).forEach(v => (o[v] = (o[v] || 0) + 1))); return Object.keys(o).sort((a, b) => o[b] - o[a]); }
  function drawFD() {
    const o = $('#cd-fd'); if (!o || o.hidden) return;
    const { base, skip, D } = FD;
    const t = terms();
    const total = base.filter(c => qMatch(c, t) && fMatch(c, D, skip)).length;
    o.innerHTML = `<div class="cd-fdp" role="dialog" aria-modal="true" aria-label="Filters"><div class="cd-fdh"><h3 class="disp">Filters</h3><button class="cd-btn" data-fx aria-label="Close filters">✕</button></div><div class="cd-fdb">
      ${FKEYS.filter(k => k !== skip).map(k => {
        const counts = {}; base.filter(c => qMatch(c, t) && fMatch(c, D, k)).forEach(c => val(c, k).forEach(v => (counts[v] = (counts[v] || 0) + 1)));
        return `<section class="cd-fg"><h4>${esc(FLABEL[k])}</h4><div class="cd-opts">${opts(k, base).map(v => { const n = counts[v] || 0, on = D[k].has(v); return `<button class="cd-opt ${on ? 'on' : ''}" data-k="${k}" data-v="${esc(v)}" ${!n && !on ? 'disabled' : ''} aria-pressed="${on}">${k === 'brand' ? LG(v, 16) : ''}${esc(v)}<b>${fmtN(n)}</b></button>`; }).join('')}</div></section>`;
      }).join('')}</div><div class="cd-fdf"><button class="cd-btn" data-fclear>Clear all</button><button class="cd-btn p" data-fapply>Show ${fmtN(total)} results</button></div></div>`;
  }
  function onFD(e) {
    const t = e.target;
    if (t === $('#cd-fd') || t.closest('[data-fx]')) return closeFilters();
    const b = t.closest('button'); if (!b) return;
    if (b.dataset.k) { const s = FD.D[b.dataset.k]; s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); return drawFD(); }
    if (b.hasAttribute('data-fclear')) { FKEYS.forEach(k => { if (k !== FD.skip) FD.D[k].clear(); }); return drawFD(); }
    if (b.hasAttribute('data-fapply')) { FKEYS.forEach(k => { if (k !== FD.skip) S.f[k] = FD.D[k]; }); closeFilters(); setQS(); S.refresh && S.refresh(); }
  }
  function closeFilters() { const o = $('#cd-fd'); if (o) { o.hidden = true; o.innerHTML = ''; } if (!$('#cd-vw') || $('#cd-vw').hidden) document.documentElement.style.overflow = ''; const b = $('#cd-fbtn'); if (b) b.setAttribute('aria-expanded', 'false'); }

  // ------------------------------------------------------------ viewer
  let VW = null;
  function openViewer(id, push = true) {
    const c = S.byId[id];
    if (!c) { toast('That ad is not in this build'); return; }
    if (push) { location.hash = '#' + curBase() + '/ad/' + id; return; }
    const mem = (c.formats && c.formats.length ? c.formats : [{ id: c.id, aspect: c.aspect, fmt: c.fmt, video: c.video, img: poster(c) }]);
    const m = mem.find(x => x.id === id) || mem[0];
    const hk = (S.meta.memberHooks[m.id]) || (m.id === c.id ? { h: c.hook, o: c.onscreen, k: c.hookKind, f: c.hookFormat } : {});
    let o = $('#cd-vw');
    if (!o) { o = document.createElement('div'); o.id = 'cd-vw'; o.className = 'cd-vw'; $('#cd-app').appendChild(o); o.addEventListener('click', onVW); }
    const list = VW && VW.list ? VW.list : (G ? G.list : S.cards);
    VW = { id, c, list };
    const idx = list.indexOf(c);
    const media = m.fmt === 'video' && m.video ? `<video controls playsinline preload="metadata" ${m.img ? `poster="${esc(m.img)}"` : ''} src="${esc(m.video)}"></video>`
      : m.img ? `<img src="${esc(m.img)}" alt="">` : '<div class="cd-empty">No media</div>';
    const hookTxt = hk.h ? `<div class="cd-hook">${esc(hk.h)}</div>` : `<div class="cd-hook" style="color:var(--ink-muted);font-size:15px">${hk.k === 'visual' || hk.k === 'none' ? 'No on-screen text in the first 3 seconds (visual hook)' : c.fmt === 'video' ? 'Hook not read yet' : 'Image ad (hooks are read for videos)'}</div>`;
    const tags = (k, l) => (c[k] && c[k].length ? `<dt>${l}</dt><dd>${c[k].map(esc).join(', ')}</dd>` : '');
    o.innerHTML = `<div class="cd-vwp" role="dialog" aria-modal="true" aria-label="Ad viewer"><div class="cd-vwm">${media}<button class="cd-x" data-vx aria-label="Close">✕</button></div><div class="cd-vwi">
      <div style="font-size:12px;color:var(--ink-muted)">${idx >= 0 ? `${fmtN(idx + 1)} of ${fmtN(list.length)} · ` : ''}${esc(c.mkt)} · ${c.status === 'active' ? 'Live' : 'Ended'} · ${esc(m.fmt)} ${esc(m.aspect)}</div>
      <h3 class="cd-bn ${c.hg ? 'hg' : ''}">${LG(c.brand, 28)}${esc(c.brand)}</h3>
      <div class="cd-sec"><h4>Hook line (on screen, first 3 seconds)</h4>${hookTxt}${hk.f ? `<div class="cd-pills"><span class="cd-pill m">${esc(hk.f)}</span></div>` : ''}</div>
      ${hookAnalysis(c, hk)}
      ${hk.o ? `<div class="cd-sec"><h4>All on-screen text</h4><div class="cd-copy">${esc(hk.o)}</div></div>` : ''}
      ${c.title ? `<div class="cd-sec"><h4>Ad headline (Meta)</h4><div>${esc(c.title)}</div></div>` : ''}
      ${c.text ? `<div class="cd-sec"><h4>Primary text</h4><div class="cd-copy">${esc(c.text)}</div></div>` : ''}
      <dl class="cd-kv">
        <dt>Launched</dt><dd>${esc(c.start || 'n/a')}${c.end && c.status !== 'active' ? ' to ' + esc(c.end) : ''}</dd>
        <dt>Days live</dt><dd>${fmtN(c.days)}${c.isProven ? ' · Proven' : ''}</dd>
        <dt>Proven score</dt><dd>${fmtN(c.proven)}</dd>
        <dt>Herology product</dt><dd>${esc(c.match || 'none')}</dd>
        ${tags('benefit', 'Benefit')}${tags('ingredient', 'Ingredient')}${tags('proof', 'Proof')}${tags('offer', 'Offer')}${tags('vf', 'Creative type (Motion)')}
        ${c.cta ? `<dt>CTA</dt><dd>${esc(c.cta)}</dd>` : ''}
        ${c.link ? `<dt>Landing page</dt><dd><a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.link.replace(/^https?:\/\//, ''))}</a></dd>` : ''}
        ${c.spend ? `<dt>Herology spend</dt><dd>€${fmtN(Math.round(c.spend))}</dd>` : ''}
      </dl>
      ${sameCopy(c)}
      ${mem.length > 1 ? `<div class="cd-sec"><h4>Sizes of this creative (${mem.length})</h4><div class="cd-fmts">${mem.map(x => `<button class="cd-opt ${x.id === m.id ? 'on' : ''}" data-mem="${esc(x.id)}">${esc(x.fmt)} ${esc(x.aspect)}</button>`).join('')}</div></div>` : ''}
      <div class="cd-nav"><button class="cd-btn" data-vp ${idx <= 0 ? 'disabled' : ''}>Previous</button><button class="cd-btn" data-vn ${idx < 0 || idx >= list.length - 1 ? 'disabled' : ''}>Next</button>
      <button class="cd-btn p" data-copy>Copy link</button>${c.alib && /\/ads\/library\/\?id=|\d{6,}/.test(c.alib) ? `<a class="cd-btn" href="${esc(c.alib)}" target="_blank" rel="noopener">Ad Library</a>` : ''}
      <a class="cd-btn" href="#brands/${esc(slug(c.brand))}">Brand page</a></div></div></div>`;
    o.hidden = false; document.documentElement.style.overflow = 'hidden'; hoverOut();
  }
  // hook analysis for one ad: how common its format is, how long that format runs, its pattern and similar hooks
  const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y), h = b.length >> 1; return b.length % 2 ? b[h] : Math.round((b[h - 1] + b[h]) / 2); };
  let HKS = null;
  function hookStats() {
    if (HKS) return HKS;
    const read = S.cards.filter(c => c.hookKind), mk = read.filter(c => !c.hg && c.market !== 'Heavy hitters'), hg = read.filter(c => c.hg);
    const by = (arr) => { const o = {}; arr.forEach(c => { const f = c.hookFormat || 'Other'; (o[f] = o[f] || []).push(c); }); return o; };
    HKS = { read, mk, hg, mkBy: by(mk), hgBy: by(hg), mkMed: median(mk.map(c => c.days || 0)) };
    return HKS;
  }
  function hookAnalysis(c, hk) {
    if (!hk || !hk.f) return '';
    const H = hookStats(), f = hk.f;
    const mkN = (H.mkBy[f] || []).length, hgN = (H.hgBy[f] || []).length;
    const med = median((H.mkBy[f] || []).map(x => x.days || 0));
    const tplCards = c.hookTpl ? S.cards.filter(x => x.hookTpl === c.hookTpl && x !== c) : [];
    const ben = new Set(c.benefit || []);
    let sim = tplCards.length ? tplCards : (H.mkBy[f] || []).concat(H.hgBy[f] || []).filter(x => x !== c && x.hook && (x.benefit || []).some(b => ben.has(b) && b !== 'other'));
    sim = sim.sort((a, b) => b.proven - a.proven).slice(0, 4);
    LISTS['sim-' + c.id] = sim;
    const line = f === 'Visual only' ? 'No text in the first 3 seconds; the opening relies on the picture.'
      : `${pct(mkN, H.mk.length)}% of market video hooks use this format (Herology ${pct(hgN, H.hg.length)}%). In market these run a median ${fmtN(med)} days, against ${fmtN(H.mkMed)} days for all hooks.`;
    return `<div class="cd-sec cd-ha"><h4>Hook analysis</h4><p>${esc(line)} <span class="nr">Days live, not results.</span></p>
      ${c.hookTpl ? `<p>Pattern <code>${esc(c.hookTpl)}</code>${tplCards.length ? ` · used on ${fmtN(tplCards.length + 1)} ads by ${esc([...new Set([c, ...tplCards].map(x => x.brand))].slice(0, 4).join(', '))}` : ''}</p>` : ''}
      ${sim.length ? `<div class="cd-sim" data-list="sim-${esc(c.id)}"><div class="sub">${tplCards.length ? 'Same pattern' : 'Same format and benefit'}, highest Proven score</div>${sim.map(x => `<button type="button" class="cd-simr" data-open="${esc(x.id)}">${LG(x.brand, 16)}<span>${esc(x.hook)}</span><b>${fmtN(x.days)}d</b></button>`).join('')}</div>` : ''}</div>`;
  }
  function sameCopy(c) {
    const k = c.conceptCount || 1;
    if (k < 2) return '';
    const others = S.cards.filter(x => x.concept === c.concept && x !== c).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    LISTS['cc-' + c.id] = others;
    return `<div class="cd-sec"><h4>Same copy, ${fmtN(k)} creatives</h4><div style="font-size:13px;color:var(--ink-muted);margin-bottom:6px">${esc(c.brand)} ran this caption on ${fmtN(k)} different creatives. Others:</div><div class="cd-fmts">${others.slice(0, 12).map(x => `<button class="cd-opt" data-cc="${esc(x.id)}">${esc(x.start || '')} · ${esc(x.fmt)} ${esc(x.aspect)}</button>`).join('')}${others.length > 12 ? `<span style="font-size:12px;color:var(--ink-muted)">+${fmtN(others.length - 12)} more</span>` : ''}</div></div>`;
  }
  // brand logo (from data/logos.json); falls back to a monogram if missing or broken
  const MONO = b => (b || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  function LG(b, sz) { const l = (S.logos || {})[slug(b || '')]; const st = sz ? ` style="--lg:${sz}px"` : '';
    return l ? `<img class="cd-lg" src="${esc(l.u)}" alt="" loading="lazy" data-m="${esc(MONO(b))}"${st}>` : `<span class="cd-lg mono"${st}>${esc(MONO(b))}</span>`; }
  document.addEventListener('error', e => { const t = e.target; if (t && t.classList && t.classList.contains('cd-lg') && t.tagName === 'IMG') { const m = document.createElement('span'); m.className = 'cd-lg mono'; m.textContent = t.dataset.m || '?'; if (t.getAttribute('style')) m.setAttribute('style', t.getAttribute('style')); t.replaceWith(m); } }, true);
  function slug(b) { return b.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function closeViewer(push = true) {
    const o = $('#cd-vw'); if (!o || o.hidden) return;
    const v = $('video', o); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    o.hidden = true; o.innerHTML = ''; VW = null; document.documentElement.style.overflow = '';
    if (push) { const qs = fToQS(); history.pushState(null, '', '#' + curBase() + (qs && (S.tab === 'discover' || S.brand) ? '?' + qs : '')); }
  }
  function onVW(e) {
    const t = e.target;
    if (t === $('#cd-vw') || t.closest('[data-vx]')) return closeViewer();
    const b = t.closest('button'); if (!b) return;
    if (b.dataset.open) { const id = b.dataset.open, l = LISTS['sim-' + VW.id] || []; history.replaceState(null, '', '#' + curBase() + '/ad/' + id); VW.list = l.length ? [VW.c, ...l] : S.cards; openViewer(id, false); return; }
    if (b.dataset.cc) { history.replaceState(null, '', '#' + curBase() + '/ad/' + b.dataset.cc); VW.list = VW.list.includes(S.byId[b.dataset.cc]) ? VW.list : S.cards; openViewer(b.dataset.cc, false); return; }
    if (b.dataset.mem) { history.replaceState(null, '', '#' + curBase() + '/ad/' + b.dataset.mem); openViewer(b.dataset.mem, false); }
    if (b.hasAttribute('data-vp') || b.hasAttribute('data-vn')) step(b.hasAttribute('data-vn') ? 1 : -1);
    if (b.hasAttribute('data-copy')) copyLink(VW && VW.id);
  }
  function step(d) { if (!VW) return; const i = VW.list.indexOf(VW.c) + d; if (i < 0 || i >= VW.list.length) return; const n = VW.list[i]; history.replaceState(null, '', '#' + curBase() + '/ad/' + n.id); openViewer(n.id, false); }
  async function copyLink(id) {
    const u = location.origin + location.pathname + '#ad/' + id;
    let ok = false;
    try { await navigator.clipboard.writeText(u); ok = true; } catch (e) { /* fallback below */ }
    if (!ok) { const ta = document.createElement('textarea'); ta.value = u; document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); }
    toast(ok ? 'Link copied' : u);
  }
  let tT;
  function toast(t) { let el = $('#cd-toast'); if (!el) { el = document.createElement('div'); el.id = 'cd-toast'; el.className = 'cd-toast'; el.setAttribute('role', 'status'); $('#cd-app').appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(tT); tT = setTimeout(() => (el.hidden = true), 2000); }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('#cd-fd') && !$('#cd-fd').hidden) return closeFilters(); if ($('#cd-vw') && !$('#cd-vw').hidden) return closeViewer(); }
    if ($('#cd-vw') && !$('#cd-vw').hidden && !/input|textarea/i.test(e.target.tagName)) { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('.cd-card')) openViewer(e.target.dataset.open);
  });
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.cd [data-open]');
    if (c && !e.target.closest('a,button')) { e.preventDefault(); if (VW === null) VW = { list: c.closest('[data-list]') ? listFor(c.closest('[data-list]').dataset.list) : (G ? G.list : S.cards) }; openViewer(c.dataset.open); }
  });
  const LISTS = {};
  function listFor(k) { return LISTS[k] || S.cards; }

  // ------------------------------------------------------------ shared stats
  function share(cards, k, v) { return pct(cards.filter(c => val(c, k).includes(v)).length, cards.length); }
  function counter(cards, k) { const o = {}; cards.forEach(c => val(c, k).forEach(v => (o[v] = (o[v] || 0) + 1))); return o; }
  function hbars(rows, opts = {}) {
    const mx = Math.max(1, ...rows.map(r => r[1]));
    return `<div class="cd-hb">${rows.map(([l, v, extra]) => `<${opts.click ? `button type="button" data-${opts.click}="${esc(l)}"` : 'div'} class="cd-hbr" title="${esc(l)}: ${v}${opts.unit || ''}"><span class="l">${esc(l)}</span><span class="tr"><i style="width:${(v / mx) * 100}%"></i></span><b>${fmtN(v)}${opts.unit || ''}</b></${opts.click ? 'button' : 'div'}>`).join('')}</div>`;
  }
  function mixBar(fm, total) {
    return `<div class="cd-mix">${FMT.filter(k => fm[k]).map(k => `<i style="width:${(100 * fm[k]) / total}%;background:${COLORS[k]}"></i>`).join('')}</div><div class="cd-leg">${FMT.filter(k => fm[k]).map(k => `<span style="--c:${COLORS[k]}">${k} ${pct(fm[k], total)}%</span>`).join('')}</div>`;
  }
  function strip(cards, key) { LISTS[key] = cards; return `<div class="cd-strip" data-list="${esc(key)}">${cards.map(c => cardHTML(c, true)).join('')}</div>`; }

  // ------------------------------------------------------------ Brands
  function vBrands(m) {
    const B = S.bl || (S.bl = { q: '', mk: 'all', sort: 'cards' });
    const all = S.brands.filter(b => !b.pending), pend = S.brands.filter(b => b.pending);
    const mkOf = b => (b.tier === 'heavy' ? 'Heavy hitters' : b.market || 'IE');
    const chips = [['all', 'All', all.length], ...MK_ORDER.map(k => [k, mkName(k), all.filter(b => mkOf(b) === k).length]), ['Heavy hitters', 'Heavy hitters', all.filter(b => mkOf(b) === 'Heavy hitters').length]].filter(c => c[2] || c[0] === 'all');
    const q = norm(B.q);
    const SORT = { cards: (a, b) => b.cards - a.cards, live: (a, b) => b.live - a.live, new30: (a, b) => b.new30 - a.new30, longest: (a, b) => b.medianDays - a.medianDays, az: (a, b) => a.brand.localeCompare(b.brand) };
    const list = all.filter(b => (B.mk === 'all' || mkOf(b) === B.mk) && (!q || norm(b.brand + ' ' + (b.site || '')).includes(q)))
      .sort((a, b) => (a.brand === 'Herology' ? -1 : b.brand === 'Herology' ? 1 : (SORT[B.sort] || SORT.cards)(a, b)));
    const pl = pend.filter(b => (B.mk === 'all' || B.mk === 'IE') && (!q || norm(b.brand).includes(q)));
    const fbar = b => { const t = b.cards || 1, v = (b.formats || {}).video || 0, im = (b.formats || {}).image || 0, o = t - v - im;
      return `<div class="cd-fbar"><i class="v" style="width:${(100 * v) / t}%"></i><i class="i" style="width:${(100 * im) / t}%"></i>${o > 0 ? `<i class="o" style="width:${(100 * o) / t}%"></i>` : ''}</div><div class="cd-fleg"><span class="v">Video ${pct(v, t)}%</span><span class="i">Image ${pct(im, t)}%</span>${o > 0 ? `<span class="o">Other ${pct(o, t)}%</span>` : ''}</div>`; };
    const first = t => (t || '').split(/(?<=\.)\s/)[0];
    const card = b => `<a class="cd-bc ${b.brand === 'Herology' ? 'hg' : ''}" href="#brands/${esc(b.slug)}"><div class="hd">${LG(b.brand, 40)}<div><h3>${esc(b.brand)}</h3><div class="mk">${esc(mkName(mkOf(b)) || mkOf(b))}${b.site ? ' · ' + esc(b.site) : ''}</div></div></div>
      <div class="nums"><span><b>${fmtN(b.live)}</b> live</span><span><b>${fmtN(b.cards)}</b> cards</span><span><b>${fmtN(b.new30)}</b> new in 30 days</span><span><b>${fmtN(b.medianDays)}d</b> median</span></div>${fbar(b)}<p>${esc(first(b.summary))}</p></a>`;
    m.innerHTML = `<div class="cd-h"><div><h2>Brands</h2><p>${fmtN(all.length)} brands with ads in this build. At most 100 ads per brand (a few global brands 30; Herology all), so counts are ads captured, not everything a brand ran.</p></div></div>
      <div class="cd-bar"><label class="cd-search">${ICON.search}<input id="cd-bq" type="search" placeholder="Search brands" value="${esc(B.q)}" aria-label="Search brands"></label>
        <select id="cd-bs" class="cd-sel" aria-label="Sort brands">${[['cards', 'Most cards'], ['live', 'Most live'], ['new30', 'Most new (30 days)'], ['longest', 'Longest running'], ['az', 'A to Z']].map(([k, l]) => `<option value="${k}" ${B.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <span class="cd-count">${fmtN(list.length)} brands</span></div>
      <div class="cd-chips" role="group" aria-label="Market">${chips.map(([k, l, n]) => `<button type="button" class="cd-chip ${B.mk === k ? 'on' : ''}" data-bm="${esc(k)}" aria-pressed="${B.mk === k}">${esc(l)}<b>${fmtN(n)}</b></button>`).join('')}</div>
      <div class="cd-bcs">${list.map(card).join('') || '<div class="cd-empty">No brands match.</div>'}</div>
      ${pl.length ? `<h3 class="disp" style="font-size:20px;margin:26px 0 10px">Coming next <span style="color:var(--ink-muted);font-size:14px">Irish brands not in Motion, from Meta Ad Library in a later run</span></h3><div class="cd-bcs">${pl.map(b => `<div class="cd-bc pend"><div class="hd">${LG(b.brand, 40)}<div><h3>${esc(b.brand)}</h3><div class="mk">Ireland</div></div></div><p>${esc(b.summary)}</p></div>`).join('')}</div>` : ''}`;
    $$('[data-bm]', m).forEach(x => x.addEventListener('click', () => { B.mk = x.dataset.bm; vBrands(m); }));
    $('#cd-bs', m).addEventListener('change', e => { B.sort = e.target.value; vBrands(m); });
    let tq; $('#cd-bq', m).addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { B.q = e.target.value; vBrands(m); const i = $('#cd-bq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 120); });
  }
  function vBrand(m) {
    const b = S.brands.find(x => x.slug === S.brand);
    if (!b) { m.innerHTML = '<div class="cd-empty">Brand not found. <a href="#brands">All brands</a></div>'; return; }
    if (b.pending) { m.innerHTML = `<div class="cd-h"><div><h2 class="cd-bn">${LG(b.brand, 40)}${esc(b.brand)}</h2><p>${esc(b.summary)}</p></div><a class="cd-btn" href="#brands">All brands</a></div>`; return; }
    const cs = S.cards.filter(c => c.brand === b.brand);
    const top = cs.slice().sort((x, y) => y.proven - x.proven).slice(0, 8);
    const hooks = cs.filter(c => c.hook).sort((x, y) => y.proven - x.proven).slice(0, 6);
    const rows = (k, list) => list.map(v => [v, share(cs, k, v)]).filter(r => r[1] > 0).sort((x, y) => y[1] - x[1]);
    // launches per week by format, last 8 weeks
    const td = new Date((S.meta.today || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    const wk = [...Array(8)].map((_, k) => { const e = new Date(td - (7 * (7 - k)) * 864e5), st = new Date(e - 6 * 864e5); return [st.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; });
    const wrows = wk.map(([a2, b2]) => { const inW = cs.filter(c => c.start && c.start >= a2 && c.start <= b2); return { l: a2.slice(5), v: inW.filter(c => c.fmt === 'video').length, i: inW.filter(c => c.fmt !== 'video').length }; });
    const wmx = Math.max(1, ...wrows.map(r => r.v + r.i));
    const asp = ASP.map(a2 => [a2, share(cs, 'aspect', a2)]).filter(r => r[1] > 0);
    const hr = cs.filter(c => c.hookKind), hfc = counter(hr.filter(c => c.hookFormat && c.hookFormat !== 'Visual only' && c.hookFormat !== 'Other'), 'hookFormat');
    const hft = Object.entries(hfc).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([f, n]) => { const ex = hr.filter(c => c.hookFormat === f && c.hook).sort((x, y) => y.proven - x.proven)[0]; return { f, n, ex }; });
    m.innerHTML = `<div class="cd-h"><div><h2 class="cd-bn ${b.brand === 'Herology' ? 'hg' : ''}">${LG(b.brand, 40)}${esc(b.brand)}</h2><p>${esc(b.summary)}</p></div><a class="cd-btn" href="#brands">All brands</a></div>
      <div class="cd-bhd">${esc(mkName(b.tier === 'heavy' ? 'Heavy hitters' : b.market) || '')}${b.site ? ` · <a href="https://${esc(b.site)}" target="_blank" rel="noopener">${esc(b.site)}</a>` : ''} · <b>${fmtN(b.live)}</b> live of ${fmtN(b.cards)} cards · median <b>${fmtN(b.medianDays)}</b> days live</div>
      <div class="cd-panels">
        <section class="cd-panel"><h3>Launches captured per week</h3><div class="sub">Last 8 weeks by start date · capped pull, so this is what was captured, not everything that launched</div>
          <div class="cd-wk">${wrows.map(r => `<div class="c" title="${r.v} video, ${r.i} image"><div class="st" style="height:${((r.v + r.i) / wmx) * 100}%"><i class="v" style="flex:${r.v}"></i><i class="i" style="flex:${r.i}"></i></div><b>${r.v + r.i}</b><span>${esc(r.l)}</span></div>`).join('')}</div>
          <div class="cd-fleg"><span class="v">Video</span><span class="i">Image</span></div>
          <h3 style="margin-top:14px">Aspect</h3>${hbars(asp, { unit: '%' })}</section>
        <section class="cd-panel"><h3>Top hook formats</h3><div class="sub">${fmtN(hr.length)} videos read${hr.length < 20 ? ' · fewer than 20, so treat as indicative' : ''}</div>${hft.length ? hft.map(h => `<div class="cd-tpl2" ${h.ex ? `data-open="${esc(h.ex.id)}"` : ''}><code>${esc(h.f)} · ${fmtN(h.n)}</code>${h.ex ? `<div class="ex">“${esc(h.ex.hook)}”</div>` : ''}</div>`).join('') : '<p class="sub">No text hooks read for this brand.</p>'}</section>
        <section class="cd-panel"><h3>At a glance</h3><div class="cd-kpis"><div class="cd-kpi"><div class="n">${fmtN(b.cards)}</div><div class="l">Cards</div></div><div class="cd-kpi"><div class="n">${fmtN(b.live)}</div><div class="l">Live</div></div><div class="cd-kpi"><div class="n">${fmtN(b.proven)}</div><div class="l">Proven</div></div><div class="cd-kpi"><div class="n">${fmtN(b.medianDays)}</div><div class="l">Median days</div></div></div>${mixBar(b.formats || {}, b.cards)}
          ${b.brand !== 'Herology' ? `<p style="font-size:12px;color:var(--ink-muted);margin-top:10px">${esc(mkName(b.market))}. Raw ${fmtN(b.raw)} ads, English ${fmtN(b.english)}, in range ${fmtN(b.scoped != null ? b.scoped : b.kept)}, kept ${fmtN(b.kept)}. Dropped: ${Object.entries(b.drops || {}).map(([k, v]) => `${esc(k)} ${fmtN(v)}`).join(', ') || 'none'}.</p>` : ''}</section>
        <section class="cd-panel"><h3>Herology product overlap</h3><div class="sub">% of cards</div>${hbars(rows('match', [...PRODUCTS, 'none']), { unit: '%' })}</section>
        <section class="cd-panel"><h3>Benefits</h3><div class="sub">% of cards</div>${hbars(rows('benefit', BEN), { unit: '%' })}</section>
        <section class="cd-panel"><h3>Proof and offers</h3><div class="sub">% of cards</div>${hbars(rows('proof', PROOF).concat(rows('offer', OFFER.filter(x => x !== 'none')).map(r => ['offer: ' + r[0], r[1]])), { unit: '%' })}</section>
        ${hooks.length ? `<section class="cd-panel"><h3>Hooks</h3>${hooks.map(c => `<div class="cd-tpl" data-open="${esc(c.id)}" style="cursor:pointer"><span>${esc(c.hook)}</span><span style="color:var(--ink-muted)">${esc(c.hookFormat || '')}</span></div>`).join('')}</section>` : ''}
      </div>
      <h3 class="disp" style="margin:24px 0 10px;font-size:20px">Top ads by Proven score</h3>${strip(top, 'top-' + b.slug)}
      <h3 class="disp" style="margin:24px 0 10px;font-size:20px">All ${esc(b.brand)} ads</h3><div id="cd-bb"></div>`;
    watchImgs(m);
    S.f.brand = new Set([b.brand]);
    bar($('#cd-bb'), cs, { skip: 'brand' });
  }

  // ------------------------------------------------------------ Hooks
  // opening devices: repeatable ways a hook starts or frames itself (matched on the hook text)
  const OPENERS = [
    ['"If you…" callout', /^(if|when) (you|your)\b/i, 'Speaks straight to a reader who has the problem'],
    ['Expert voice ("As a nurse…")', /\b(as an? (nurse|doctor|dr|gp|pharmacist|nutritionist|dietitian|midwife|registered|naturopath)|doctor|dr\.|pharmacist|dietitian|nutritionist|ob-?gyn)\b/i, 'A professional frames the claim'],
    ['Life-stage or symptom named', /(perimenopaus|menopaus|pcos|postpartum|postnatal|pregnan|\bttc\b|period|\bpms\b|luteal|fertility|bloat|brain fog|hot flash|night sweat|over (30|40|50)|in your (30|40|50)s|after (30|40|50))/i, 'Names who it is for in the first line'],
    ['Question', /\?/, 'Opens with a question'],
    ['Numbered list ("3 reasons")', /(^\d+\s|\b(\d+|three|five) (reasons|signs|things|ways|tips|mistakes|supplements|benefits))/i, 'Promises a short list'],
    ['"I wish someone told me"', /(wish (i|someone)|nobody (told|warned)|no one (told|warned)|didn'?t know)/i, 'Hindsight or confession'],
    ['"Stop / Don\'t" warning', /^(stop|don'?t|never|quit|you'?re (doing|taking)\b.*wrong)/i, 'Myth-busting or warning'],
    ['POV / relatable', /^(pov\b|me when|when you|that feeling)/i, 'Meme-style relatable caption'],
    ['First-person story ("I…", "My…")', /^(i|i'm|i've|i was|my)\b/i, 'Personal experience up front'],
    ['Reveal ("Meet…", "This is…")', /^(meet|introducing|say hello|new\b|this is|here'?s|these are)/i, 'Introduces the product or idea'],
    ['Price or offer in the hook', /(% off|[$£€]\s?\d|free (gift|shipping|delivery|bottle|trial)|for free|\bsale\b|\bdeals?\b|bundle|discount|\bcode\b)/i, 'Leads with the deal'],
    ['"This is your sign"', /your sign/i, 'Nudge to act'],
  ];
  function vHooks(m) {
    const H = hookStats(), read = H.read;
    const vids = S.cards.filter(c => c.fmt === 'video');
    const who = S.hk.who, sort = S.hk.sort || 'proven';
    const pool = read.filter(c => who === 'all' || (who === 'hg' ? c.hg : !c.hg));
    const text = read.filter(c => c.hookKind === 'text');
    const mkT = H.mk.filter(c => c.hook), hgT = H.hg.filter(c => c.hook);
    const rows = HOOKF.map(f => { const mk = H.mkBy[f] || [], hg = H.hgBy[f] || [];
      return { f, mk: mk.length, hg: hg.length, mkP: pct(mk.length, H.mk.length), hgP: pct(hg.length, H.hg.length), med: median(mk.map(c => c.days || 0)), ps: mk.length ? Math.round(mk.reduce((a, c) => a + (c.proven || 0), 0) / mk.length) : 0 }; })
      .filter(r => r.mk || r.hg).sort((a, b) => b.mk - a.mk);
    const mxP = Math.max(1, ...rows.map(r => Math.max(r.mkP, r.hgP)));
    // monthly launches, top 5 text formats, last 6 months
    const top5 = rows.filter(r => r.f !== 'Visual only' && r.f !== 'Other').slice(0, 5).map(r => r.f);
    const today = S.meta.today || new Date().toISOString().slice(0, 10);
    const months = []; { const d = new Date(today + 'T00:00:00Z'); for (let k = 5; k >= 0; k--) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)); months.push(x.toISOString().slice(0, 7)); } }
    const trend = top5.map(f => [f, months.map(mo => H.mk.filter(c => c.hookFormat === f && (c.start || '').startsWith(mo)).length)]);
    const tmx = Math.max(1, ...trend.flatMap(t => t[1]));
    const MON = mo => new Date(mo + '-01T00:00:00Z').toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' });
    const TC = ['var(--purple)', 'var(--terracotta)', 'var(--gold)', 'var(--green)', '#7FB3D5'];
    // opening devices: market vs Herology share, best examples
    const ops = OPENERS.map(([name, re, why]) => { const mk = mkT.filter(c => re.test(c.hook)), hg = hgT.filter(c => re.test(c.hook));
      return { name, why, mk, hg, mkP: pct(mk.length, mkT.length), hgP: pct(hg.length, hgT.length), med: median(mk.map(c => c.days || 0)), ex: [...mk].sort((a, b) => b.proven - a.proven).slice(0, 3) }; })
      .filter(o => o.mk.length >= 5).sort((a, b) => b.mk.length - a.mk.length);
    ops.forEach(o => (LISTS['op-' + o.name] = o.ex));
    // formats by benefit
    const bens = BEN.filter(b => b !== 'other').map(b => { const mk = H.mk.filter(c => (c.benefit || []).includes(b) && c.hook), hg = H.hg.filter(c => (c.benefit || []).includes(b) && c.hook);
      const fc = counter(mk.filter(c => c.hookFormat !== 'Other'), 'hookFormat'), top = Object.entries(fc).sort((x, y) => y[1] - x[1]).slice(0, 2);
      const hfc = counter(hg.filter(c => c.hookFormat !== 'Other'), 'hookFormat'), htop = Object.entries(hfc).sort((x, y) => y[1] - x[1])[0];
      const ex = top[0] ? [...mk].filter(c => c.hookFormat === top[0][0]).sort((x, y) => y.proven - x.proven)[0] : null;
      return { b, n: mk.length, top: top.map(([f, n]) => [f, pct(n, mk.length)]), h: htop ? [htop[0], pct(htop[1], hg.length)] : null, hn: hg.length, ex }; }).filter(r => r.n >= 15).sort((a, b) => b.n - a.n);
    // what stands out
    const ins = [];
    const gap = rows.filter(r => r.mk >= 20 && r.f !== 'Other' && r.f !== 'Visual only').sort((a, b) => (b.mkP - b.hgP) - (a.mkP - a.hgP))[0];
    if (gap && gap.mkP - gap.hgP >= 3) ins.push(['Under-used format', `${gap.f}: ${gap.mkP}% of market hooks, ${gap.hgP}% of Herology's.`, gap.f]);
    const lon = rows.filter(r => r.mk >= 25 && r.f !== 'Other').sort((a, b) => b.med - a.med)[0];
    if (lon) ins.push(['Runs longest in market', `${lon.f}: median ${lon.med} days live against ${H.mkMed} for all hooks.`, lon.f]);
    const d30 = new Date(new Date(today + 'T00:00:00Z') - 30 * 864e5).toISOString().slice(0, 10), d60 = new Date(new Date(today + 'T00:00:00Z') - 60 * 864e5).toISOString().slice(0, 10);
    const ris = rows.filter(r => r.f !== 'Other').map(r => { const a2 = (H.mkBy[r.f] || []).filter(c => c.start > d30).length, b2 = (H.mkBy[r.f] || []).filter(c => c.start > d60 && c.start <= d30).length; return { f: r.f, a2, b2 }; }).filter(r => r.a2 >= 10).sort((x, y) => (y.a2 - y.b2) / Math.max(1, y.b2) - (x.a2 - x.b2) / Math.max(1, x.b2))[0];
    if (ris && ris.a2 > ris.b2) ins.push(['Rising in launches captured', `${ris.f}: ${ris.a2} new in the last 30 days vs ${ris.b2} the 30 before.`, ris.f]);
    const og = ops.filter(o => o.mk.length >= 20).sort((a, b) => (b.mkP - b.hgP) - (a.mkP - a.hgP))[0];
    if (og && og.mkP - og.hgP >= 3) ins.push(['Opening Herology rarely uses', `${og.name}: ${og.mkP}% of market text hooks, ${og.hgP}% of Herology's.`, null]);
    // library
    const t = norm(S.hk.q).split(/\s+/).filter(Boolean);
    const SORTS = { proven: (a, b) => b.proven - a.proven, newest: (a, b) => (b.start || '').localeCompare(a.start || ''), longest: (a, b) => (b.days || 0) - (a.days || 0) };
    const lib = pool.filter(c => c.hook && (!S.hk.fmt || c.hookFormat === S.hk.fmt) && t.every(x => norm(c.hook + ' ' + c.brand + ' ' + (c.onscreen || '')).includes(x))).sort(SORTS[sort] || SORTS.proven);
    LISTS.hooks = lib;
    const shown = lib.slice(0, S.hk.n || 48);
    const stat = (n, l, p) => `<div class="cd-stat"><span class="num ${p ? 'p' : ''}">${n}</span><span class="lbl">${l}</span></div>`;
    const thumb = (c, cls) => `<div class="cd-fr ${cls || ''}" ${c.video ? `data-v="${esc(c.video)}"` : ''}>${poster(c) ? `<img data-src="${esc(poster(c))}" alt="" decoding="async">` : ''}<div class="cd-shim"></div></div>`;
    const hcard = c => `<article class="cd-hk" data-open="${esc(c.id)}" tabindex="0" aria-label="${esc(c.brand)} hook">${thumb(c)}${c.isProven ? '<span class="cd-tagp">Proven</span>' : ''}
      <div class="b"><div class="tx">${esc(c.hook)}</div><div class="mt"><span class="cd-bn ${c.hg ? 'hg' : ''}">${LG(c.brand, 16)}${esc(c.brand)}</span></div>
      <div class="mt"><span class="cd-pill m">${esc(c.hookFormat || 'unclassified')}</span> ${fmtN(c.days)}d live · score ${fmtN(c.proven)}</div></div></article>`;
    m.innerHTML = `<div class="cd-h"><div><h2>Hooks</h2><p>What is written on screen in the first 3 seconds of each video, read from the frames (not the Meta headline). Market excludes Heavy hitters. Days live and Proven score show what brands keep running, not results.</p></div>
      <div class="cd-stats">${stat(fmtN(read.length), 'Videos read')}${stat(pct(text.length, read.length) + '%', 'Open with text')}${stat(fmtN(H.hg.length), 'Herology read', 1)}${stat(fmtN(H.mkMed) + 'd', 'Median live')}</div></div>
      ${ins.length ? `<section class="cd-ins">${ins.map(([h, b, f]) => `<${f ? `button type="button" data-hf="${esc(f)}"` : 'div'} class="i"><span>${esc(h)}</span><b>${esc(b)}</b>${f ? '<em>See these hooks ↓</em>' : ''}</${f ? 'button' : 'div'}>`).join('')}</section>` : ''}
      <section class="cd-panel"><div class="cd-ph"><div><h3>Hook formats: Herology vs market</h3><div class="sub">Share of each side's video hooks${S.hk.fmt ? ` · library filtered to <b>${esc(S.hk.fmt)}</b> (click again to clear)` : ' · click a row to filter the library below'}</div></div>
        <div class="cd-leg2"><span class="mk">Market</span><span class="hg">Herology</span></div></div>
        <div class="cd-cmp" role="list">${rows.map(r => `<button type="button" role="listitem" class="cd-cmpr ${S.hk.fmt === r.f ? 'on' : ''}" data-hf="${esc(r.f)}"><span class="l">${esc(r.f)}</span>
          <span class="bars"><span class="tr mk"><i style="width:${(r.mkP / mxP) * 100}%"></i><em>${r.mkP}%</em></span><span class="tr hg"><i style="width:${(r.hgP / mxP) * 100}%"></i><em>${r.hgP}%</em></span></span>
          <span class="sig"><b>${fmtN(r.med)}d</b><small>median live</small></span><span class="sig"><b>${fmtN(r.ps)}</b><small>avg Proven</small></span></button>`).join('')}</div></section>
      <section class="cd-panel" style="margin-top:16px"><div class="cd-ph"><div><h3>New market ads per month, top 5 text formats</h3><div class="sub">By launch date · capped pull, so counts are ads captured</div></div>
        <div class="cd-leg2">${trend.map(([f], k) => `<span style="--c:${TC[k]}" class="c">${esc(f)}</span>`).join('')}</div></div>
        <div class="cd-mchart">${months.map((mo, mi) => `<div class="mo"><div class="bars">${trend.map(([f, v], k) => `<div class="b" style="height:${(v[mi] / tmx) * 100}%;background:${TC[k]}" title="${esc(f)} · ${MON(mo)}: ${v[mi]}"><span>${v[mi] || ''}</span></div>`).join('')}</div><div class="lb">${MON(mo)}${mi === months.length - 1 ? ' (to date)' : ''}</div></div>`).join('')}</div></section>
      <section class="cd-panel" style="margin-top:16px"><div class="cd-ph"><div><h3>Opening lines that repeat</h3><div class="sub">How hooks start, matched on the text: share of each side's text hooks, how long the market keeps them running, and the market's highest-scoring examples</div></div>
        <div class="cd-leg2"><span class="mk">Market</span><span class="hg">Herology</span></div></div>
        <div class="cd-ops">${ops.map(o => `<div class="op"><div class="hd"><h4>${esc(o.name)}</h4><div class="why">${esc(o.why)}</div>
          <div class="nums"><span class="mk"><b>${o.mkP}%</b> market</span><span class="hg"><b>${o.hgP}%</b> Herology</span><span><b>${fmtN(o.med)}d</b> median live</span></div></div>
          <div class="exs" data-list="op-${esc(o.name)}">${o.ex.map(c => `<div class="ex" data-open="${esc(c.id)}">${thumb(c, 'sm')}<div><div class="tx">${esc(c.hook)}</div><div class="mt">${LG(c.brand, 14)}${esc(c.brand)} · ${fmtN(c.days)}d</div></div></div>`).join('')}</div></div>`).join('')}</div></section>
      ${bens.length ? `<section class="cd-panel" style="margin-top:16px"><h3>Which hooks the market uses per benefit</h3><div class="sub">Top two market hook formats for each benefit, Herology's most used, and the market's highest-scoring example</div>
        <div class="cd-bens">${bens.map(r => `<div class="br" ${r.ex ? `data-open="${esc(r.ex.id)}"` : ''}><div class="bn">${esc(BENL(r.b))}<small>${fmtN(r.n)} market hooks</small></div>
          <div class="fm">${r.top.map(([f, p2]) => `<span class="cd-pill m">${esc(f)} ${p2}%</span>`).join(' ')}</div>
          <div class="hg">${r.h ? `Herology: ${esc(r.h[0])} ${r.h[1]}%` : r.hn ? 'Herology: mostly Other' : 'Herology: none read'}</div>
          <div class="ex">${r.ex ? `“${esc(r.ex.hook)}” <span>${esc(r.ex.brand)}</span>` : ''}</div></div>`).join('')}</div></section>` : ''}
      <div class="cd-bar" style="margin-top:22px" id="cd-hlib"><label class="cd-search">${ICON.search}<input id="cd-hq" type="search" placeholder="Search hooks, on-screen text, brands" value="${esc(S.hk.q)}" aria-label="Search hooks"></label>
        <div class="cd-seg" role="group" aria-label="Whose hooks">${[['all', 'All'], ['market', 'Market'], ['hg', 'Herology']].map(([k, l]) => `<button data-who="${k}" class="${who === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <select id="cd-hs" class="cd-sel" aria-label="Sort hooks">${[['proven', 'Proven score'], ['newest', 'Newest'], ['longest', 'Longest running']].map(([k, l]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${S.hk.fmt ? `<button type="button" class="cd-chip on" data-hf="${esc(S.hk.fmt)}">${esc(S.hk.fmt)} ✕</button>` : ''}
        <span class="cd-count">${fmtN(lib.length)} hooks</span></div>
      <div class="cd-hkg" data-list="hooks">${shown.map(hcard).join('') || '<div class="cd-empty">No hooks match.</div>'}</div>
      ${lib.length > shown.length ? `<div style="text-align:center;margin:18px 0"><button class="cd-btn" data-more>Show more (${fmtN(lib.length - shown.length)} left)</button></div>` : ''}`;
    watchImgs(m);
    const re = (scroll) => { const y = scroll ? null : window.scrollY; vHooks(m); if (scroll) { const l = $('#cd-hlib'); l && l.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else window.scrollTo(0, y); };
    $$('[data-who]', m).forEach(b => b.addEventListener('click', () => { S.hk.who = b.dataset.who; S.hk.n = 48; re(); }));
    $$('[data-hf]', m).forEach(b => b.addEventListener('click', () => { S.hk.fmt = S.hk.fmt === b.dataset.hf ? null : b.dataset.hf; S.hk.n = 48; re(!!S.hk.fmt); }));
    $('#cd-hs', m).addEventListener('change', e => { S.hk.sort = e.target.value; re(); });
    const mb = $('[data-more]', m); if (mb) mb.addEventListener('click', () => { S.hk.n = (S.hk.n || 48) + 48; re(); });
    let tq; $('#cd-hq', m).addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.hk.q = e.target.value; S.hk.n = 48; vHooks(m); const i = $('#cd-hq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  }

  // ------------------------------------------------------------ Runneth trending (weekly top ads, media stored in R2)
  let TR = null;
  async function vTrending(m) {
    if (!TR) { m.innerHTML = '<div class="cd-empty">Loading trending ads…</div>'; TR = await fetch('data/trending.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null) || { weeks: {} }; if (S.tab !== 'trending') return; }
    const weeks = Object.keys(TR.weeks || {}).sort().reverse();
    if (!weeks.length) { m.innerHTML = '<div class="cd-h"><div><h2>Trending</h2><p>No trending pull yet.</p></div></div>'; return; }
    const T = S.tr || (S.tr = { wk: weeks[0], cat: 'supplements' });
    if (!TR.weeks[T.wk]) T.wk = weeks[0];
    const cats = Object.keys(TR.weeks[T.wk]); if (!cats.includes(T.cat)) T.cat = cats[0];
    const rows = TR.weeks[T.wk][T.cat] || [];
    const prev = weeks[weeks.indexOf(T.wk) + 1], prevRanks = {};
    if (prev && TR.weeks[prev][T.cat]) TR.weeks[prev][T.cat].forEach(r => (prevRanks[r.src] = r.rank));
    const known = new Set(S.brands.map(b => b.brand.toLowerCase()));
    const bl = b => S.brands.find(x => x.brand.toLowerCase() === (b || '').toLowerCase());
    const label = c => (TR.cats || {})[c] || c;
    m.innerHTML = `<div class="cd-h"><div><h2>Trending</h2><p>The week's top ads in Runneth's ${cats.map(c => esc(label(c))).join(' and ')} lists (Motion's trending ranking, not Herology data). Media is stored in our bucket, so ads stay viewable after they stop running.</p></div></div>
      <div class="cd-bar"><div class="cd-seg" role="group" aria-label="List">${cats.map(c => `<button data-tc="${esc(c)}" class="${T.cat === c ? 'on' : ''}">${esc(label(c))}</button>`).join('')}</div>
        <select id="cd-tw" class="cd-sel" aria-label="Week">${weeks.map(w => `<option value="${w}" ${w === T.wk ? 'selected' : ''}>Week of ${w}</option>`).join('')}</select>
        <span class="cd-count">${fmtN(rows.length)} ads · ${fmtN(rows.filter(r => r.kind === 'video').length)} video</span></div>
      <div class="cd-trg">${rows.map(r => { const b = bl(r.brand), img = r.poster || (r.images || [])[0] || '', pr = prevRanks[r.src];
        const mv = !prev ? '' : pr == null ? '<span class="nw">New</span>' : pr > r.rank ? `<span class="up">▲ ${pr - r.rank}</span>` : pr < r.rank ? `<span class="dn">▼ ${r.rank - pr}</span>` : '<span class="eq">=</span>';
        return `<button type="button" class="cd-trc" data-tr="${r.rank}"><div class="md">${img ? `<img data-src="${esc(img)}" alt="${esc(r.brand)} ad">` : ''}<span class="rk">${r.rank}</span>${r.kind !== 'image' ? `<span class="kd">${esc(r.kind)}</span>` : ''}</div>
          <div class="bt">${r.logo ? `<img class="cd-lg" src="${esc(r.logo)}" alt="" style="--lg:18px" loading="lazy" data-m="${esc((r.brand || '?').slice(0, 1))}">` : LG(r.brand, 18)}<span class="bn">${esc(r.brand)}</span>${mv}</div>
          <div class="mt">${r.age ? esc(r.age) + ' live' : ''}${b ? ` · <span class="in">in our build</span>` : ''}</div></button>`; }).join('')}</div>`;
    watchImgs(m);
    $$('[data-tc]', m).forEach(b => b.addEventListener('click', () => { T.cat = b.dataset.tc; vTrending(m); }));
    $('#cd-tw', m).addEventListener('change', e => { T.wk = e.target.value; vTrending(m); });
    $$('[data-tr]', m).forEach(b => b.addEventListener('click', () => trView(rows.find(r => String(r.rank) === b.dataset.tr), bl)));
  }
  function trView(r, bl) {
    if (!r) return;
    let o = $('#cd-trv'); if (!o) { o = document.createElement('div'); o.id = 'cd-trv'; o.className = 'cd-vw'; $('#cd-app').appendChild(o); o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-tx]')) { o.hidden = true; o.innerHTML = ''; document.documentElement.style.overflow = ''; } }); }
    const b = bl(r.brand);
    const media = r.video ? `<video controls playsinline autoplay muted preload="metadata" ${r.poster ? `poster="${esc(r.poster)}"` : ''} src="${esc(r.video)}"></video>` : (r.images || []).map(u => `<img src="${esc(u)}" alt="">`).join('');
    o.innerHTML = `<div class="cd-vwp" role="dialog" aria-modal="true" aria-label="Trending ad"><div class="cd-vwm ${r.images && r.images.length > 1 ? 'car' : ''}">${media}<button class="cd-x" data-tx aria-label="Close">✕</button></div><div class="cd-vwi">
      <div style="font-size:12px;color:var(--ink-muted)">Rank ${r.rank} · ${esc((TR.cats || {})[S.tr.cat] || S.tr.cat)} · week of ${esc(S.tr.wk)}</div>
      <h3 class="cd-bn">${LG(r.brand, 28)}${esc(r.brand)}</h3>
      <dl class="cd-kv"><dt>Format</dt><dd>${esc(r.kind)}</dd>${r.age ? `<dt>Live</dt><dd>${esc(r.age)}</dd>` : ''}</dl>
      <div class="cd-nav">${b ? `<a class="cd-btn" href="#brands/${esc(b.slug)}">Brand page</a>` : ''}<button class="cd-btn" data-tx>Close</button></div></div></div>`;
    o.hidden = false; document.documentElement.style.overflow = 'hidden';
  }

  // ------------------------------------------------------------ Herology vs market
  function vGaps(m) {
    const MK = S.gapMkt in S.meta.gapsBy || S.gapMkt === 'ALL' ? S.gapMkt : 'ALL';
    const hg = S.cards.filter(c => c.hg), mk = S.cards.filter(c => !c.hg && (MK === 'ALL' || c.market === MK));
    const mkLabel = MK === 'ALL' ? 'All markets' : mkName(MK);
    const comps = [...new Set(mk.map(c => c.brand))].sort((a, b) => mk.filter(c => c.brand === b).length - mk.filter(c => c.brand === a).length);
    const sub = MK === 'ALL' ? MK_ORDER.filter(k => mk.some(c => c.market === k)).map(k => [mkName(k), mk.filter(c => c.market === k)])
      : comps.slice(0, 8).map(b => [b, mk.filter(c => c.brand === b)]);
    const cols = [['Herology', hg], [mkLabel, mk], ...sub];
    const today = Date.parse(S.meta.today || '2026-11-10');
    const in30 = c => c.start && today - Date.parse(c.start) <= 30 * 864e5;
    const in60 = c => c.start && today - Date.parse(c.start) > 30 * 864e5 && today - Date.parse(c.start) <= 60 * 864e5;
    const last = mk.filter(in30), prior = mk.filter(in60), proven = mk.filter(c => c.isProven);
    const read = c => c.hookKind;
    const DIMS = [['Format', 'fmt', FMT, null], ['Aspect', 'aspect', ASP, null], ['Hook type (videos read)', 'hookFormat', HOOKF, read], ['Benefit', 'benefit', BEN, null], ['Proof', 'proof', PROOF, null], ['Offer', 'offer', OFFER, null], ['Herology product', 'match', [...PRODUCTS, 'none'], null]];
    const cell = (cards, k, v, base) => { const b = base ? cards.filter(base) : cards; return b.length ? pct(b.filter(c => val(c, k).includes(v)).length, b.length) : null; };
    const table = `<div class="cd-tw"><table class="cd-t"><thead><tr><th>Share of cards</th>${cols.map(([n, cs]) => `<th>${esc(n)}<br><span style="font-weight:400;text-transform:none">${fmtN(cs.length)}</span></th>`).join('')}<th>Proven in market</th><th>Launches last 30d</th><th>Prior 30d</th></tr></thead><tbody>
      ${DIMS.map(([lab, k, vals, base]) => `<tr class="grp"><td colspan="${cols.length + 4}">${esc(lab)}</td></tr>` + vals.map(v => {
        const cells = cols.map(([n, cs], i) => { const p = cell(cs, k, v, base); return `<td class="${i === 0 ? 'hgc' : i === 1 ? 'mk' : ''}">${p == null ? '·' : p + '%'}</td>`; });
        const pv = cell(proven, k, v, base);
        const l = (base ? last.filter(base) : last).filter(c => val(c, k).includes(v)).length, pr = (base ? prior.filter(base) : prior).filter(c => val(c, k).includes(v)).length;
        if (cols.every(([, cs]) => !cell(cs, k, v, base))) return '';
        return `<tr><td>${esc(v)}</td>${cells.join('')}<td>${pv == null ? '·' : pv + '%'}</td><td>${l}</td><td>${pr} ${l > pr ? '<span class="cd-dlt up">▲</span>' : l < pr ? '<span class="cd-dlt dn">▼</span>' : ''}</td></tr>`;
      }).join('')).join('')}</tbody></table></div>`;
    // per product
    const prodPanels = PRODUCTS.map(p => {
      const h = hg.filter(c => c.match === p), k = mk.filter(c => c.match === p);
      if (!h.length || !k.length) return '';
      const rows = [];
      [['fmt', FMT], ['proof', PROOF], ['offer', OFFER.filter(x => x !== 'none')], ['benefit', BEN.filter(x => x !== 'other')]].forEach(([kk, vals]) => vals.forEach(v => {
        const a = h.length ? pct(h.filter(c => val(c, kk).includes(v)).length, h.length) : 0, b = k.length ? pct(k.filter(c => val(c, kk).includes(v)).length, k.length) : 0;
        if (a || b) rows.push([v, a, b]);
      }));
      rows.sort((x, y) => Math.abs(y[2] - y[1]) - Math.abs(x[2] - x[1]));
      const hr = h.filter(read), kr = k.filter(read);
      return `<section class="cd-panel"><h3>${esc(p)}</h3><div class="sub">Herology ${fmtN(h.length)} cards · market ${fmtN(k.length)} cards (${esc([...new Set(k.map(c => c.brand))].join(', ') || 'none')})</div>
        <table class="cd-t"><thead><tr><th>Biggest differences</th><th>Herology</th><th>Market</th></tr></thead><tbody>${rows.slice(0, 8).map(([v, a, b]) => `<tr><td>${esc(v)}</td><td class="hgc">${a}%</td><td class="mk">${b}%</td></tr>`).join('')}
        ${kr.length ? `<tr><td>Top market hook type</td><td class="hgc">${esc(top1(hr, 'hookFormat'))}</td><td class="mk">${esc(top1(kr, 'hookFormat'))}</td></tr>` : ''}</tbody></table>
        ${k.length ? `<div class="sub" style="margin-top:10px">Most Proven market ads</div>${strip(k.slice().sort((a, b) => b.proven - a.proven).slice(0, 6), 'p-' + p)}` : ''}</section>`;
    }).join('');
    // trending
    const trend = [];
    [['benefit', BEN], ['proof', PROOF], ['offer', OFFER], ['fmt', FMT], ['aspect', ASP], ['match', PRODUCTS], ['hookFormat', HOOKF]].forEach(([k, vals]) => vals.forEach(v => {
      const l = last.filter(c => val(c, k).includes(v)).length, p = prior.filter(c => val(c, k).includes(v)).length;
      if (l + p >= 4) trend.push([k, v, l, p, l - p]);
    }));
    trend.sort((a, b) => b[4] - a[4]);
    const pvr = [];
    [['benefit', BEN], ['proof', PROOF], ['offer', OFFER], ['fmt', FMT], ['aspect', ASP], ['hookFormat', HOOKF]].forEach(([k, vals]) => vals.forEach(v => {
      const base = k === 'hookFormat' ? read : null;
      const p = cell(proven, k, v, base), h = cell(hg, k, v, base);
      if (p) pvr.push([k, v, p, h || 0]);
    }));
    pvr.sort((a, b) => (b[2] - b[3]) - (a[2] - a[3]));
    const gaps = (MK === 'ALL' ? S.meta.gaps : S.meta.gapsBy[MK]) || [];
    const seg = `<div class="cd-seg" role="group" aria-label="Market">${[['ALL', 'All markets'], ...MK_ORDER.filter(k => k in S.meta.gapsBy).map(k => [k, mkName(k)])].map(([k, l]) => `<button data-gm="${k}" class="${MK === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
    LISTS.gapsAll = [];
    m.innerHTML = `<div class="cd-h"><div><h2>Herology vs ${esc(MK === 'ALL' ? 'market' : mkLabel)}</h2><p>Share of cards with each tag. ${esc(mkLabel)} = ${fmtN(comps.length)} brands, ${fmtN(mk.length)} cards${MK === 'ALL' ? ' (Ireland, UK, North America and Australia)' : ''}. Trending = launches in the last 30 days vs the 30 before; Proven in market = 60+ days live.</p></div>${seg}</div>
      <div class="cd-note"><b>Coverage.</b> ${MK === 'ALL' || MK === 'IE' ? `Irish brands ${esc(S.meta.pending.join(', '))} are not in Motion and are coming from Meta Ad Library in a later run. ` : ''}Each brand is capped at 100 ads, so big advertisers do not swamp the shares. Herology = all its ads with spend in the Creative Hub. ${MK === 'ALL' ? '' : `Brands: ${esc(comps.join(', '))}.`}</div>
      <h3 class="disp" style="font-size:22px;margin:8px 0 12px">Gaps, ranked</h3>
      <p style="color:var(--ink-muted);font-size:13px;margin:-6px 0 14px">Common, proven or rising in the market, little or none at Herology. Score = (bigger of market share and proven-in-market share minus Herology share) x a boost for growth in the last 30 days.</p>
      ${gaps.length ? gaps.map((g, i) => { const ex = g.examples.map(id => S.byId[id]).filter(Boolean); return `<section class="cd-gap"><div class="gh"><span class="rk">${i + 1}</span><h3>${esc(g.title)}</h3><span class="cd-pill m">${esc(g.dim)}</span></div><p class="why">${esc(g.why)}</p>${ex.length ? strip(ex, 'gap' + i) : ''}</section>`; }).join('') : '<div class="cd-empty">No gaps computed in this build.</div>'}
      <h3 class="disp" style="font-size:22px;margin:28px 0 12px">Side by side</h3>${table}
      <h3 class="disp" style="font-size:22px;margin:28px 0 12px">By Herology product</h3><div class="cd-panels">${prodPanels}</div>
      <div class="cd-panels" style="margin-top:16px"><section class="cd-panel"><h3>Trending in market</h3><div class="sub">Launches, last 30 days vs prior 30 (${fmtN(last.length)} vs ${fmtN(prior.length)} cards)</div>
        <table class="cd-t"><thead><tr><th>Tag</th><th>Last 30</th><th>Prior 30</th><th>Change</th></tr></thead><tbody>${trend.slice(0, 14).map(([k, v, l, p, d]) => `<tr><td>${esc(v)} <span style="color:var(--ink-muted)">${esc(FLABEL[k] || 'hook')}</span></td><td>${l}</td><td>${p}</td><td class="cd-dlt ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '+' : ''}${d}</td></tr>`).join('')}</tbody></table></section>
        <section class="cd-panel"><h3>Proven in market</h3><div class="sub">${fmtN(proven.length)} market cards ran 60+ days. Share with the tag vs Herology.</div>
        <table class="cd-t"><thead><tr><th>Tag</th><th>Proven market</th><th>Herology</th></tr></thead><tbody>${pvr.slice(0, 14).map(([k, v, p, h]) => `<tr><td>${esc(v)} <span style="color:var(--ink-muted)">${esc(FLABEL[k] || 'hook')}</span></td><td class="mk">${p}%</td><td class="hgc">${h}%</td></tr>`).join('')}</tbody></table></section></div>`;
    watchImgs(m);
    $$('[data-gm]', m).forEach(b => b.addEventListener('click', () => { S.gapMkt = b.dataset.gm; store.set('gapMkt', S.gapMkt); vGaps(m); }));
  }
  function top1(cs, k) { const o = counter(cs, k); const e = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} (${pct(e[1], cs.length)}%)` : 'none read'; }

  // ------------------------------------------------------------ boot
  window.addEventListener('hashchange', route);
  let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (G && nCols(G.host.clientWidth) !== G.cols.length) { const { host, list } = G; grid(host, list); } }, 250); });
  load().then(() => { header(); route(); }).catch(e => { $('#cd-main').innerHTML = `<div class="cd-note"><b>Creative Discovery could not load.</b> ${esc(e.message)}</div>`; console.error(e); });
  CD.openViewer = openViewer;
})();
