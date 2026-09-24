// Isolated renderer fixture: synthetic pillars, no server, accounts or API calls.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      await context.route('**/*', r => r.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent('<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--tx:#322e29;--tx2:#60594e;--tx3:#7b7367;--gold:#a57d34;--gold-l:#896421;--bd:#dacfb9}body{margin:0;background:#faf6eb;font-family:system-ui}main{box-sizing:border-box;width:100%;max-width:760px;margin:auto;padding:16px}</style><main><div id="patternAnalysis"></div><div id="yongJiAnalysis"></div></main></html>');
      for (const f of ['bazi.js', 'result.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'js', f), 'utf8') });
      for (const text of ['壬午 辛亥 癸巳 戊午', '丙戌 丙申 丙申 戊戌']) {
        await page.evaluate(text => {
          const p = Object.fromEntries(text.split(' ').map((s,i) => [['year','month','day','hour'][i], { gan:s[0], zhi:s[1] }]));
          const b = BaZiCalculator.buildFromPillars(p, 'female');
          const facts = BaZiCalculator.getProfessionalReportFacts(b, 'female');
          renderPattern(b, facts); renderYongJi(b, facts);
        }, text);
        if (text.startsWith('壬午')) {
          const heading = await page.locator('#patternAnalysis > p').first().innerText();
          assert.doesNotMatch(heading, /羊刃/);
          assert.equal(await page.locator('[data-water-carrier-review]').count(), 0);
        } else {
          assert.match(await page.locator('#yongJiAnalysis').innerText(), /水有润燥之利，也有克火之弊/);
          await page.locator('#yongJiAnalysis > div > details > summary').click();
          const detail = await page.locator('[data-water-carrier-review]').innerText();
          for (const term of ['壬为七杀', '癸为正官', '戊癸合', '申子半合', '申亥害', '辰戌冲']) assert.ok(detail.includes(term), term);
          assert.ok(await page.locator('[data-water-carrier-review]').isVisible());
          if (width === 390 && process.env.CARRIER_SCREENSHOT) await page.screenshot({ path: process.env.CARRIER_SCREENSHOT, fullPage: true });
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('320/390/1280: corrected pattern, dual-role water and six carrier explanations visible; no overflow or page errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
