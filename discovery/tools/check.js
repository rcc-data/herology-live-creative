const { chromium } = require('playwright');
// Creative Discovery page check: node discovery/tools/check.js <base url> <out dir>. Run by .github/workflows/cd-check.yml.
(async () => {
  const base = process.argv[2] || 'http://localhost:8765/discovery/';
  const out = process.argv[3] || '/tmp/claude-0/cdtest';
  const b = await chromium.launch();
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
    ok(`${w} card media loaded`, imgs > 0, imgs + ' images');
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
    await p.fill('#cd-q', 'hot flush'); await p.waitForTimeout(600);
    ok(`${w} search`, (await p.textContent('#cd-count')) !== cnt2, await p.textContent('#cd-count'));
    const id = await p.evaluate(() => window.CD.state.cards.find(c => c.fmt === 'video').id);
    await p.goto(base + '#ad/' + id); await p.waitForSelector('.cd-vwp', { timeout: 10000 });
    ok(`${w} viewer from #ad link`, true, id);
    await p.screenshot({ path: `${out}/viewer_${w}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(`${w} viewer closes`, await p.$eval('#cd-vw', e => e.hidden));
    for (const t of ['brands', 'brands/happy-mammoth', 'hooks', 'gaps']) {
      await p.goto(base + '#' + t); await p.waitForTimeout(900);
      const txt = await p.textContent('#cd-main');
      ok(`${w} ${t} renders`, txt.length > 200 && !/NaN|undefined/.test(txt), (txt.match(/NaN|undefined/) || [''])[0]);
      await p.screenshot({ path: `${out}/${t.replace('/', '_')}_${w}.png`, fullPage: t === 'gaps' && w === 1440 ? false : false });
    }
    const gapN = await p.$$eval('.cd-gap', e => e.length);
    ok(`${w} gap list`, gapN > 0, gapN);
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
