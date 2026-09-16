const path = require('path');
const { pathToFileURL } = require('url');

const playwrightPath = process.env.DAZZY_PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error('DAZZY_PLAYWRIGHT_PATH is required');
const { chromium } = require(playwrightPath);

const root = __dirname;
const cases = [
  { html: '01-friendly-bento.html', png: '01-friendly-bento.png' },
  { html: '02-things-taskboard.html', png: '02-things-taskboard.png' },
  { html: '03-ive-gallery.html', png: '03-ive-gallery.png' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });

  try {
    for (const item of cases) {
      const page = await browser.newPage({ viewport: { width: 620, height: 1080 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });

      await page.goto(pathToFileURL(path.join(root, item.html)).href, {
        waitUntil: 'networkidle',
        timeout: 45000,
      });
      await page.waitForSelector('.app');

      const phone = page.locator('.app');
      await phone.locator('.switch, .toggle').click();
      await phone.locator('.switch, .toggle').click();
      await phone.locator('.next button').click();
      await phone.locator('.toast.show').waitFor();
      await phone.locator('.tab').nth(1).click();
      await phone.locator('.toast.show').waitFor();
      await page.waitForTimeout(1450);

      if (errors.length) throw new Error(`${item.html}: ${errors.join(' | ')}`);

      await page.screenshot({ path: path.join(root, item.png), fullPage: true });
      console.log(`PASS ${item.html}: render, status toggle, order action, tab action, screenshot`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
