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
    hk: { q: '', fmt: null, who: 'all' }, incHg: store.get('incHg', false), auto: store.get('auto', false), gapView: 'market', gapMkt: store.get('gapMkt', 'ALL'), meta: {} };
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
    const tab = ['discover', 'herology', 'brands', 'hooks', 'gaps'].includes(base[0]) ? base[0] : 'discover';
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
        <div class="t"><span class="b ${c.hg ? 'hg' : ''}" title="${esc(c.mkt)}">${esc(c.brand)}</span><span>${fmtN(c.days)}d${c.status === 'active' ? ' · live' : ''}</span></div>
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
  function teardownGrid() { if (MORE) MORE.disconnect(); MORE = null; if (typeof AIO !== 'undefined' && AIO) { AIO.disconnect(); AIO = null; AP.forEach(stopAuto); AP.clear(); } G = null; }
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
  // autoplay (off by default): plays videos in view, at most 4 at once, muted; hover still works when off
  let AIO = null; const AP = new Set();
  function autoSync() {
    if (AIO) { AIO.disconnect(); AIO = null; }
    AP.forEach(stopAuto); AP.clear();
    if (!S.auto || !G) return;
    AIO = new IntersectionObserver(es => es.forEach(e => {
      const fr = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) { if (AP.size < 4 && !AP.has(fr)) { startAuto(fr); AP.add(fr); } }
      else if (AP.has(fr)) { stopAuto(fr); AP.delete(fr); }
    }), { threshold: [0, 0.6] });
    $$('.cd-fr[data-v]', G.host).forEach(fr => AIO.observe(fr));
  }
  function startAuto(fr) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.loop = true; v.setAttribute('playsinline', ''); v.src = fr.dataset.v; v.className = 'ap'; fr.appendChild(v); v.addEventListener('playing', () => fr.classList.add('play')); v.play().catch(() => {}); }
  function stopAuto(fr) { const v = fr.querySelector('video.ap'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } fr.classList.remove('play'); }
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
      <div class="cd-vfq" id="cd-vfq" role="group" aria-label="Creative type (Motion)"></div></div>
      <div class="cd-chips" id="cd-act"></div><div id="cd-gridhost"></div>`;
    $('#cd-sort', host).value = S.sort;
    let tq;
    $('#cd-q', host).addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.q = e.target.value; setQS(); refresh(); }, 180); });
    $('#cd-sort', host).addEventListener('change', e => { S.sort = e.target.value; store.set('sort', S.sort); setQS(); refresh(); });
    $('#cd-fbtn', host).addEventListener('click', () => openFilters(base, opts.skip));
    if (opts.hgToggle) $('#cd-inchg', host).addEventListener('change', e => { S.incHg = e.target.checked; store.set('incHg', S.incHg); draw(); });
    $('#cd-auto', host).addEventListener('change', e => { S.auto = e.target.checked; store.set('auto', S.auto); autoSync(); });
    $('#cd-vfq', host).addEventListener('click', e => { const b = e.target.closest('button[data-vfq]'); if (!b) return; const v = b.dataset.vfq; S.f.vf.has(v) ? S.f.vf.delete(v) : S.f.vf.add(v); setQS(); refresh(); });
    const refresh = () => {
      const list = sorted(filtered(base, S.f, opts.skip));
      $('#cd-count').textContent = `${fmtN(list.length)} of ${fmtN(base.length)} cards` + (S.q.trim() ? ` for "${S.q.trim()}"` : '');
      $('#cd-act').innerHTML = FKEYS.filter(k => k !== opts.skip).flatMap(k => [...S.f[k]].map(v => `<button class="cd-chip" data-rm="${esc(k)}" data-v="${esc(v)}">${esc(FLABEL[k])}: ${esc(v)} <i>✕</i></button>`)).join('') +
        (FKEYS.some(k => S.f[k].size) ? '<button class="cd-chip" data-clear>Clear all</button>' : '');
      const fcn = FKEYS.reduce((n, k) => n + (k === opts.skip ? 0 : S.f[k].size), 0);
      $('#cd-fbtn').innerHTML = `${ICON.filter} Filters${fcn ? ' · ' + fcn : ''}`;
      const vc = {}; filtered(base, S.f, 'vf').forEach(c => (c.vf || []).forEach(v => (vc[v] = (vc[v] || 0) + 1)));
      const top = Object.keys(vc).sort((a, b) => vc[b] - vc[a]).slice(0, 14); [...S.f.vf].forEach(v => { if (!top.includes(v)) top.unshift(v); });
      $('#cd-vfq').innerHTML = top.length ? `<span class="lbl">Motion types</span>` + top.map(v => `<button class="cd-q ${S.f.vf.has(v) ? 'on' : ''}" data-vfq="${esc(v)}" aria-pressed="${S.f.vf.has(v)}">${esc(v)} <b>${fmtN(vc[v] || 0)}</b></button>`).join('') : '';
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
    m.innerHTML = `<div class="cd-h"><div><h2>Discover</h2><p>Supplement ads that overlap Herology's range in ${esc(MK_ORDER.map(mkName).join(', '))}. Herology's own ads are in the Herology tab (switch them on here to compare). Filter by Motion's creative types and formats below. Hover a video to play it, or switch on autoplay; click any card for the hook, copy and sizes.</p></div></div>
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
        return `<section class="cd-fg"><h4>${esc(FLABEL[k])}</h4><div class="cd-opts">${opts(k, base).map(v => { const n = counts[v] || 0, on = D[k].has(v); return `<button class="cd-opt ${on ? 'on' : ''}" data-k="${k}" data-v="${esc(v)}" ${!n && !on ? 'disabled' : ''} aria-pressed="${on}">${esc(v)}<b>${fmtN(n)}</b></button>`; }).join('')}</div></section>`;
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
      <h3 class="${c.hg ? 'hg' : ''}">${esc(c.brand)}</h3>
      <div class="cd-sec"><h4>Hook line (on screen, first 3 seconds)</h4>${hookTxt}${hk.f ? `<div class="cd-pills"><span class="cd-pill m">${esc(hk.f)}</span></div>` : ''}</div>
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
  function sameCopy(c) {
    const k = c.conceptCount || 1;
    if (k < 2) return '';
    const others = S.cards.filter(x => x.concept === c.concept && x !== c).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    LISTS['cc-' + c.id] = others;
    return `<div class="cd-sec"><h4>Same copy, ${fmtN(k)} creatives</h4><div style="font-size:13px;color:var(--ink-muted);margin-bottom:6px">${esc(c.brand)} ran this caption on ${fmtN(k)} different creatives. Others:</div><div class="cd-fmts">${others.slice(0, 12).map(x => `<button class="cd-opt" data-cc="${esc(x.id)}">${esc(x.start || '')} · ${esc(x.fmt)} ${esc(x.aspect)}</button>`).join('')}${others.length > 12 ? `<span style="font-size:12px;color:var(--ink-muted)">+${fmtN(others.length - 12)} more</span>` : ''}</div></div>`;
  }
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
    const live = S.brands.filter(b => !b.pending).sort((a, b) => (a.brand === 'Herology' ? -1 : b.brand === 'Herology' ? 1 : b.cards - a.cards));
    const pend = S.brands.filter(b => b.pending);
    const tile = b => `<a class="cd-tile" href="#brands/${esc(b.slug)}"><h3 class="${b.brand === 'Herology' ? 'hg' : ''}">${esc(b.brand)}</h3><div class="sub">${esc(b.site || '')}${b.brand !== 'Herology' ? ` · raw ${fmtN(b.raw)}, English ${fmtN(b.english)}, in range ${fmtN(b.scoped != null ? b.scoped : b.kept)}, kept ${fmtN(b.kept)} ads` : ` · ${fmtN(b.ads)} ads with spend`}</div>
        <div class="cd-kpis"><div class="cd-kpi"><div class="n">${fmtN(b.cards)}</div><div class="l">Cards</div></div><div class="cd-kpi"><div class="n">${fmtN(b.live)}</div><div class="l">Live</div></div><div class="cd-kpi"><div class="n">${fmtN(b.proven)}</div><div class="l">Proven</div></div><div class="cd-kpi"><div class="n">${fmtN(b.new30)}</div><div class="l">New 30d</div></div></div>
        ${mixBar(b.formats || {}, b.cards)}<p>${esc(b.summary)}</p></a>`;
    const groups = MK_ORDER.map(k => [k, live.filter(b => (b.market || 'IE') === k)]).filter(g => g[1].length);
    m.innerHTML = `<div class="cd-h"><div><h2>Brands</h2><p>${live.length} brands with ads in this build, by market. At most 100 ads per brand (AG1, Cymbiotika, Winks Sleep 30; Herology all). Summaries use only the counts shown.</p></div></div>
      ${groups.map(([k, bs]) => `<h3 class="disp" style="font-size:20px;margin:22px 0 10px">${esc(mkName(k))} <span style="color:var(--ink-muted);font-size:14px">${bs.length} brands</span></h3>
      <div class="cd-tiles">${bs.map(tile).join('')}${k === 'IE' ? pend.map(b => `<div class="cd-tile pend"><h3>${esc(b.brand)}</h3><p>${esc(b.summary)}</p></div>`).join('') : ''}</div>`).join('')}`;
  }
  function vBrand(m) {
    const b = S.brands.find(x => x.slug === S.brand);
    if (!b) { m.innerHTML = '<div class="cd-empty">Brand not found. <a href="#brands">All brands</a></div>'; return; }
    if (b.pending) { m.innerHTML = `<div class="cd-h"><div><h2>${esc(b.brand)}</h2><p>${esc(b.summary)}</p></div><a class="cd-btn" href="#brands">All brands</a></div>`; return; }
    const cs = S.cards.filter(c => c.brand === b.brand);
    const top = cs.slice().sort((x, y) => y.proven - x.proven).slice(0, 8);
    const hooks = cs.filter(c => c.hook).sort((x, y) => y.proven - x.proven).slice(0, 6);
    const rows = (k, list) => list.map(v => [v, share(cs, k, v)]).filter(r => r[1] > 0).sort((x, y) => y[1] - x[1]);
    m.innerHTML = `<div class="cd-h"><div><h2 class="${b.brand === 'Herology' ? 'hg' : ''}">${esc(b.brand)}</h2><p>${esc(b.summary)}</p></div><a class="cd-btn" href="#brands">All brands</a></div>
      <div class="cd-panels">
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
  function vHooks(m) {
    const read = S.cards.filter(c => c.hookKind);
    const vids = S.cards.filter(c => c.fmt === 'video');
    const who = S.hk.who;
    const pool = read.filter(c => who === 'all' || (who === 'hg' ? c.hg : !c.hg));
    const fc = counter(pool, 'hookFormat');
    const fmts = HOOKF.map(f => [f, fc[f] || 0]).filter(r => r[1]);
    const tpl = {};
    pool.forEach(c => { if (c.hookTpl) (tpl[c.hookTpl] = tpl[c.hookTpl] || []).push(c); });
    const tpls = Object.entries(tpl).filter(([k, v]) => k.length <= 70 && new Set(v.map(c => norm(c.hook))).size >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 25);
    const t = norm(S.hk.q).split(/\s+/).filter(Boolean);
    const lib = pool.filter(c => c.hook && (!S.hk.fmt || c.hookFormat === S.hk.fmt) && t.every(x => norm(c.hook + ' ' + c.brand).includes(x))).sort((a, b) => b.proven - a.proven);
    LISTS.hooks = lib;
    const nHg = read.filter(c => c.hg).length;
    m.innerHTML = `<div class="cd-h"><div><h2>Hooks</h2><p>On-screen text in the first 3 seconds, read from video frames (not the Meta headline). ${fmtN(read.length)} of ${fmtN(vids.length)} video cards read (${fmtN(nHg)} Herology).</p></div>
      <div class="cd-seg" role="group" aria-label="Whose hooks">${[['all', 'All'], ['market', 'Market'], ['hg', 'Herology']].map(([k, l]) => `<button data-who="${k}" class="${who === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="cd-panels"><section class="cd-panel"><h3>Hook formats</h3><div class="sub">Cards per format${S.hk.fmt ? ` · filtering the library by ${esc(S.hk.fmt)} (click again to clear)` : ' · click a bar to filter the library'}</div>${hbars(fmts, { click: 'hf' })}</section>
      <section class="cd-panel"><h3>Templates</h3><div class="sub">Patterns shared by 2+ different hooks ([PRODUCT], [N], [AGE] are placeholders)</div>${tpls.length ? tpls.map(([k, v]) => `<div class="cd-tpl"><code>${esc(k)}</code><span style="color:var(--ink-muted)">${v.length} ads · ${esc([...new Set(v.map(c => c.brand))].join(', '))}</span></div>`).join('') : '<p class="sub">No shared templates yet.</p>'}</section></div>
      <div class="cd-bar" style="margin-top:20px"><label class="cd-search">${ICON.search}<input id="cd-hq" type="search" placeholder="Search hooks" value="${esc(S.hk.q)}" aria-label="Search hooks"></label><span class="cd-count">${fmtN(lib.length)} hooks</span></div>
      <div class="cd-panel" style="padding:4px 8px" data-list="hooks">${lib.slice(0, 300).map(c => `<div class="cd-hrow" data-open="${esc(c.id)}"><div class="th">${poster(c) ? `<img data-src="${esc(poster(c))}" alt="">` : ''}</div><div><div class="tx">${esc(c.hook)}</div><div class="mt"><span class="${c.hg ? 'hg' : ''}">${esc(c.brand)}</span> · ${esc(c.hookFormat || 'unclassified')} · ${fmtN(c.days)} days · Proven score ${fmtN(c.proven)}${c.match && c.match !== 'none' ? ' · ' + esc(c.match) : ''}</div></div></div>`).join('') || '<div class="cd-empty">No hooks match.</div>'}${lib.length > 300 ? `<div class="cd-more">Top 300 by Proven score shown; search to narrow.</div>` : ''}</div>`;
    watchImgs(m);
    $$('[data-who]', m).forEach(b => b.addEventListener('click', () => { S.hk.who = b.dataset.who; vHooks(m); }));
    $$('[data-hf]', m).forEach(b => b.addEventListener('click', () => { S.hk.fmt = S.hk.fmt === b.dataset.hf ? null : b.dataset.hf; vHooks(m); }));
    let tq; $('#cd-hq', m).addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.hk.q = e.target.value; vHooks(m); const i = $('#cd-hq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
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
