const { chromium } = require('playwright');
// Creative Discovery page check: node discovery/tools/check.js <base url> <out dir>. Run by .github/workflows/cd-check.yml.
(async () => {
  const base = process.argv[2] || 'http://localhost:8765/discovery/';
  const out = process.argv[3] || '/tmp/claude-0/cdtest';
  const b = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
  const res = [];
  const ok = (n, c, d) => { res.push([c ? 'PASS' : 'FAIL', n, d || '']); };
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });
    await p.goto(base + '#discover', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.cd-card', { timeout: 20000 });
    await p.waitForTimeout(1500);
    const n1 = await p.$$eval('.cd-card', e => e.length);
    ok(`${w} cards render`, n1 >= 24, n1);
    const cnt1 = await p.textContent('#cd-count');
    const imgs = await p.$$eval('.cd-card img', e => e.filter(i => i.complete && i.naturalWidth > 0).length);
    if (!process.env.LOCAL) ok(`${w} card media loaded`, imgs > 0, imgs + ' images');
    const r2 = await p.$$eval('.cd-card img[src]', e => e.filter(i => i.src.includes('r2.dev')).length);
    if (!process.env.LOCAL) ok(`${w} media from R2`, r2 > 0, r2);
    if (w === 1440) {
      const fr = await p.$('.cd-fr[data-v]');
      if (fr && !process.env.LOCAL) { await fr.hover(); await p.waitForTimeout(4000);
        const st = await p.evaluate(() => { const v = document.querySelector('.cd-fr video'); return v ? { rs: v.readyState, t: v.currentTime, src: v.currentSrc.slice(0, 60) } : null; });
        ok('1440 hover plays video', st && st.rs >= 2, JSON.stringify(st));
        const head = await p.evaluate(async () => { const u = document.querySelector('.cd-fr[data-v]').dataset.v; const r = await fetch(u, { headers: { Range: 'bytes=0-1023' } }); return r.status + ' ' + r.headers.get('content-type'); });
        ok('1440 video file served', /^20[06] video/.test(head), head);
        await p.mouse.move(5, 5); await p.waitForTimeout(300);
        ok('1440 video removed on leave', !(await p.$('.cd-fr video')));
      }
      const auto = await p.evaluate(() => [...document.querySelectorAll('video')].filter(v => !v.paused).length);
      ok('1440 no autoplay', auto === 0, auto);
      const bc = await p.$$eval('#cd-vfq button', b => b.length);
      ok('1440 benefit chips', bc >= 5, bc);
      const c0 = await p.textContent('#cd-count'); await p.click('#cd-vfq button'); await p.waitForTimeout(500);
      const c1 = await p.textContent('#cd-count'); ok('1440 benefit chip filters', c0 !== c1, `${c0} -> ${c1}`);
      await p.click('#cd-vfq button'); await p.waitForTimeout(400);
      await p.$eval('#cd-auto', e => e.click()); await p.waitForTimeout(1500);
      const ap = await p.$$eval('video.ap', v => v.length);
      ok('1440 autoplay on plays videos', ap > 0 && ap <= 6, ap);
      await p.$eval('#cd-auto', e => e.click()); await p.waitForTimeout(300);
    }
    await p.screenshot({ path: `${out}/discover_${w}.png` });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(900);
    const n2 = await p.$$eval('.cd-card', e => e.length);
    ok(`${w} lazy batch`, n2 > n1, `${n1} -> ${n2}`);
    await p.click('#cd-fbtn'); await p.waitForSelector('.cd-fdp');
    await p.click('.cd-opt[data-k="match"][data-v="Meno"]');
    await p.screenshot({ path: `${out}/filters_${w}.png` });
    await p.click('[data-fapply]'); await p.waitForTimeout(500);
    const cnt2 = await p.textContent('#cd-count');
    ok(`${w} filter changes count`, cnt1 !== cnt2, `${cnt1} -> ${cnt2}`);
    await p.click('#cd-fbtn'); await p.waitForSelector('.cd-fdp');
    await p.click('[data-fclear]'); await p.click('.cd-opt[data-k="market"][data-v="UK"]'); await p.click('[data-fapply]'); await p.waitForTimeout(500);
    const cnt3 = await p.textContent('#cd-count');
    ok(`${w} market filter changes count`, cnt3 !== cnt2 && cnt3 !== cnt1, `${cnt1} -> UK ${cnt3}`);
    const allUK = await p.evaluate(() => [...document.querySelectorAll('.cd-card')].every(e => { const c = window.CD.state.byId[e.dataset.open]; return c && c.market === 'UK'; }));
    ok(`${w} market filter shows only that market`, allUK);
    await p.fill('#cd-q', 'magnesium'); await p.waitForTimeout(600);
    ok(`${w} search`, (await p.textContent('#cd-count')) !== cnt2, await p.textContent('#cd-count'));
    const id = await p.evaluate(() => window.CD.state.cards.find(c => c.fmt === 'video').id);
    await p.goto(base + '#ad/' + id); await p.waitForSelector('.cd-vwp', { timeout: 10000 });
    ok(`${w} viewer from #ad link`, true, id);
    const cc = await p.evaluate(() => { const c = window.CD.state.cards.find(c => c.conceptCount > 2); return c && c.id; });
    if (cc) { await p.goto(base + '#ad/' + cc); await p.waitForSelector('.cd-vwp', { timeout: 10000 }); await p.waitForTimeout(300);
      const t = await p.textContent('.cd-vwp'); ok(`${w} viewer shows Same copy, N creatives`, /Same copy, \d+ creatives/.test(t), (t.match(/Same copy, \d+ creatives/) || [''])[0]);
      await p.screenshot({ path: `${out}/viewer_samecopy_${w}.png` }); }
    await p.screenshot({ path: `${out}/viewer_${w}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(`${w} viewer closes`, await p.$eval('#cd-vw', e => e.hidden));
    for (const t of ['brands', 'brands/happy-mammoth', 'hooks', 'trending', 'gaps']) {
      await p.goto(base + '#' + t); await p.waitForTimeout(900);
      const txt = await p.textContent('#cd-main');
      ok(`${w} ${t} renders`, txt.length > 200 && !/NaN|undefined/.test(txt), (txt.match(/NaN|undefined/) || [''])[0]);
      await p.screenshot({ path: `${out}/${t.replace('/', '_')}_${w}.png`, fullPage: t === 'gaps' && w === 1440 ? false : false });
    }
    const gapN = await p.$$eval('.cd-gap', e => e.length);
    ok(`${w} gap list`, gapN > 0, gapN);
    for (const mk of ['IE', 'UK', 'NA', 'AU']) {
      const btn = await p.$(`[data-gm="${mk}"]`);
      if (!btn) { ok(`${w} gap market ${mk}`, false, 'no button'); continue; }
      await btn.click(); await p.waitForTimeout(500);
      const tx = await p.textContent('#cd-main');
      ok(`${w} gap market ${mk} renders`, /Herology vs /.test(tx) && !/NaN|undefined/.test(tx) && (await p.$$eval('.cd-gap', e => e.length)) > 0, (tx.match(/Herology vs [A-Za-z ]+/) || [''])[0]);
      if (mk === 'UK') await p.screenshot({ path: `${out}/gaps_uk_${w}.png` });
    }
    await p.click('[data-gm="ALL"]'); await p.waitForTimeout(300);
    const hs = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`${w} no horizontal scroll`, hs <= 1, hs);
    const body = await p.evaluate(() => document.body.innerText);
    ok(`${w} no NaN/undefined anywhere`, !/\bNaN\b|\bundefined\b/.test(body));
    ok(`${w} no JS errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
    await p.close();
  }
  await b.close();
  res.forEach(r => console.log(r.join('  ')));
  console.log(`${res.filter(r => r[0] === 'PASS').length}/${res.length} passed`);
  require('fs').writeFileSync(`${out}/results.json`, JSON.stringify(res, null, 1));
})();
