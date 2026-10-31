const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const fixture = process.argv[3] || 'http://127.0.0.1:8035';
async function setState(state) {
  const response = await fetch(fixture + '/__fixture', {method:'POST', body:JSON.stringify(state)});
  assert.equal(response.status, 200);
}
async function fits(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page must fit viewport');
}
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
  try {
    const context = await browser.newContext({reducedMotion:'reduce'});
    await context.addCookies([{name:'xmrcheckout_api_key', value:'fixture-only-api-key', url:base}]);
    const page = await context.newPage();
    for (const width of [320,390,768,1024,1280,1420,1422,1440]) {
      await setState({state:'ready', layoutFixture:true});
      await page.setViewportSize({width,height:1000});
      await page.goto(base+'/dashboard?tab=invoices&status=all&sort=confirmations', {waitUntil:'networkidle'});
      const panel = page.getByRole('region', {name:'Invoice address availability',exact:true});
      const summary = panel.locator('summary');
      assert.equal(await panel.locator('details').getAttribute('open'), null);
      await panel.getByRole('status').filter({hasText:'Needs review:'}).waitFor();
      await summary.focus(); await page.keyboard.press('Enter');
      await panel.getByText('Reserved addresses', {exact:true}).waitFor();
      await page.keyboard.press('Enter');
      await fits(page);
      const table = page.locator('.invoice-table');
      const workspaceWidth = await page.locator('.invoice-workspace').evaluate(e=>e.getBoundingClientRect().width);
      assert.equal(await table.isVisible(), workspaceWidth>=960, 'table uses available width');
      if(await table.isVisible()) {
        const amounts = table.locator('tbody tr td:nth-child(2)');
        assert.equal(await amounts.count(),5);
        assert.ok(await amounts.evaluateAll(es=>es.every(e=>{
          const cell=e.getBoundingClientRect();
          return [...e.querySelectorAll('span')].every(span=>{
            const r=span.getBoundingClientRect();return r.left>=cell.left && r.right<=cell.right;
          });
        })), 'exact amounts must stay inside their cells');
        assert.ok(await table.locator('th').filter({hasText:'Confirmations'}).evaluate(e=>e.scrollWidth<=e.clientWidth));
      } else {
        await page.getByLabel('Status',{exact:true}).selectOption('pending');
        for(const label of ['Status','Sort by']) assert.ok(await page.getByLabel(label,{exact:true}).evaluate(e=>{
          const s=getComputedStyle(e), c=document.createElement('canvas').getContext('2d');
          c.font=`${s.fontSize} ${s.fontFamily}`;
          return c.measureText(e.selectedOptions[0].text).width + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) + 24 <= e.clientWidth;
        }), 'selected filter text must fit');
      }
      await page.getByRole('button',{name:'Details',exact:true}).filter({visible:true}).first().click();
      await fits(page);
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      await fits(page);
      assert.equal(await table.isVisible(),false,'enlarged text uses cards');
      await page.evaluate(()=>document.documentElement.style.fontSize='');
      await page.goto(base+'/dashboard?tab=webhooks',{waitUntil:'networkidle'});
      await fits(page);
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      await fits(page);
      await page.evaluate(()=>document.documentElement.style.fontSize='');
      console.log('Layout checks passed:', width);
    }
    for(const state of ['exhausted','unavailable']) {
      await setState({state});
      await page.goto(base+'/dashboard?tab=invoices',{waitUntil:'networkidle'});
      await page.getByRole('status').filter({hasText:state==='exhausted'?'No invoice addresses':'Unavailable.'}).waitFor();
      await fits(page);
    }
  } finally {
    await setState({state:'ready',layoutFixture:false});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
