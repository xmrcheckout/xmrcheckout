const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
  const base = process.argv[2] || 'http://127.0.0.1:3335';
  try {
    for (const width of [320,390,768,1440]) {
      console.log('Checking UX width',width);
      const page = await browser.newPage({viewport:{width,height:844}, reducedMotion:'reduce'});
      const creations=[];
      page.on('request', request => { if(request.method()==='POST' && /\/invoices$/.test(request.url())) creations.push(request.url()); });
      await page.goto(base+'/tour?tab=invoices', {waitUntil:'networkidle'});
      await page.getByText('Order #1027',{exact:true}).filter({visible:true}).first().waitFor();
      if(width===390) assert.ok(await page.getByText('Order #1027',{exact:true}).filter({visible:true}).first().evaluate(e=>e.getBoundingClientRect().top)<844,'invoice context should begin in viewport');
      await page.getByLabel(/Sort by/).selectOption('amount_xmr');
      await page.waitForURL(/sort=amount_xmr/);
      await page.getByLabel(/Direction/).selectOption('asc');
      await page.waitForURL(/order=asc/);
      await page.getByRole('button',{name:'Create invoice',exact:true}).click();
      await page.getByRole('spinbutton',{name:'Amount (XMR)',exact:true}).fill('0.125');
      await page.locator('[role=dialog] button[type=submit]').click();
      await page.getByText('Simulated invoice ready. Nothing was saved.',{exact:true}).waitFor();
      const preview=page.getByRole('region',{name:'Simulated checkout preview'});
      for(const state of ['payment_detected','confirmed','expired','invalid','pending']) await preview.getByLabel('Preview payment state').selectOption(state);
      assert.equal(await preview.locator('a[href^="monero:"],img,canvas').count(),0);
      assert.equal(creations.length,0);
      for(let n=0;n<12;n++) {await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]')));}
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'detached'});
      await page.getByRole('button',{name:'Create invoice',exact:true}).click();
      assert.equal(await page.getByRole('spinbutton',{name:'Amount (XMR)',exact:true}).inputValue(),'');
      await page.keyboard.press('Escape');
      await page.goto(base+'/invoice',{waitUntil:'networkidle'});
      await page.getByLabel('Invoice ID or link',{exact:true}).fill('https://other.example/invoice/11111111-1111-4111-8111-111111111111');
      await page.getByRole('button',{name:'Check status',exact:true}).click();
      await page.getByText('Enter a complete invoice ID or an invoice link from this site.',{exact:true}).waitFor();
      await page.goto(base+'/?login=1',{waitUntil:'networkidle'});
      await page.getByText('Where do I find these?',{exact:true}).click();
      for(const wallet of ['Monero GUI','Feather','Cake Wallet']) await page.locator('summary').filter({hasText:new RegExp('^'+wallet+'$')}).click();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'detached'});
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'enlarged homepage overflow '+width);
      await page.goto(base+'/tour?tab=invoices',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'enlarged invoices overflow '+width);
      await page.close();
    }
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.context().addCookies([{name:'xmrcheckout_api_key',value:'fixture-only-api-key',url:base}]);
    await page.goto(base+'/dashboard?tab=invoices',{waitUntil:'networkidle'});
    await page.getByText('Fixture order description',{exact:true}).filter({visible:true}).waitFor();
    await page.getByText('Fixture product title',{exact:true}).filter({visible:true}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const state of ['pending','payment_detected','confirmed','expired','invalid']) {
      await fetch('http://127.0.0.1:8035/__fixture',{method:'POST',body:JSON.stringify({invoiceStatus:state})});
      await page.goto(base+'/invoice/00000000-0000-4000-8000-000000000456',{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('a[href^="monero:"]').count(),state==='pending'?1:0);
    }
    await page.close();
    console.log('UX browser checks passed at all four widths; fixture merchant context and payment states passed');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
