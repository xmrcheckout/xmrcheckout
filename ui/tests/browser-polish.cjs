const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const axePath = require.resolve('axe-core/axe.min.js');
const { contrast } = require('./browser-contrast.cjs');
(async()=>{
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    for (const width of [320,390,768,1440]) {
      const context = await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      await context.addCookies([{name:'xmrcheckout_api_key',value:'fixture-only-api-key',url:base}]);
      const page = await context.newPage();
      for (const path of ['/','/docs','/docs/integrations','/guides/monero-payment-buttons','/guides/self-hosted-monero-checkout','/guides/monero-payment-api-webhooks','/missing-page','/invoice/bad-id','/pay/dead-token','/i/00000000-0000-4000-8000-000000000456']) {
        await page.goto(base+path,{waitUntil:'networkidle'});
        await page.getByRole('main').waitFor();
        await page.keyboard.press('Tab');
        const skip = page.getByRole('link',{name:'Skip to main content',exact:true});
        await skip.focus();assert.ok((await skip.boundingBox()).y>=0,'skip link appears on focus');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
        for (const details of await page.locator('main details').all()) await details.evaluate(e=>e.open=true);
        for (const code of await page.locator('main pre').all()) {
          assert.equal(await code.getAttribute('tabindex'),'0');
          assert.ok(await code.getAttribute('aria-label'));
          await code.focus();
          assert.ok(await code.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
        }
        await page.addScriptTag({path:axePath});
        const report = await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
        const violations=report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
        console.log(JSON.stringify({width,path,violations,incomplete:report.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))}));
        assert.deepEqual(violations,[],path);
        assert.deepEqual(report.incomplete.filter(v=>v.id!=='color-contrast').map(v=>v.id),[],path+' unresolved non-contrast checks');
        console.log(JSON.stringify({resolvedContrast:path,width,samples:await contrast(page)}));
        await page.evaluate(()=>document.documentElement.style.fontSize='200%');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' enlarged overflow');
      }
      if(width===1440) {
        for (const [path,label] of [['/docs','Monero Payment API Documentation'],['/docs/integrations','Monero Checkout Integration Recipes'],['/faq','Monero Checkout FAQ'],['/guides','Monero Checkout Guides'],['/tour','Monero Checkout Demo'],['/invoice','Monero Invoice Status Lookup']]) {
          await page.goto(base+path,{waitUntil:'networkidle'});
          assert.equal(await page.title(),label+' | XMR Checkout',path+' title');
        }
      }
      await page.goto(base+'/',{waitUntil:'networkidle'});
      if(width<768) {
        const menu=page.locator('.mobile-nav > summary');await menu.click();
        await page.locator('#mobile-navigation a').first().focus();
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'),'false');
        assert.ok(await menu.evaluate(e=>e===document.activeElement));
      }
      for (const tab of ['overview','invoices','payment-links','webhooks','profile','health']) {
        await page.goto(base+'/dashboard?tab='+tab,{waitUntil:'networkidle'});
        assert.equal(await page.getByRole('main').getByRole('heading',{level:1}).count(),1,tab+' h1');
        assert.equal(await page.getByRole('navigation',{name:'Dashboard sections'}).getByRole('link').first().innerText(),'Overview\nActivity and connectivity'.replace(width<1024?'\nActivity and connectivity':'',''));
        assert.equal(await page.title(),'Dashboard | XMR Checkout');
        assert.ok((await page.locator('footer').innerText()).includes('XMR Checkout · Open source. Self-hostable.'));
        assert.equal((await page.locator('footer').innerText()).includes('xmrcheckout.com'),false);
        if(tab==='overview') {
          await page.getByText('Fixture order description',{exact:true}).waitFor();
          await page.getByText('00000000-0000-4000-8000-000000000000',{exact:true}).waitFor();
        }
      }
      await context.close();
      console.log('Polish and page semantics passed:',width);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
