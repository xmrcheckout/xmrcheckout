const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const fixture = process.argv[3] || 'http://127.0.0.1:8035';
const id = '00000000-0000-4000-8000-000000000456';
async function state(invoiceStatus,checkoutStyle='standard') {
  assert.equal((await fetch(fixture+'/__fixture',{method:'POST',body:JSON.stringify({invoiceStatus,checkoutStyle,invoiceResponseStatus:200})})).status,200);
}
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    for(const width of [320,390,768,1440]) {
      const page = await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
      await state('pending');
      for(const route of ['/invoice/','/i/']) {
        await page.goto(base+route+id,{waitUntil:'networkidle'});
        const wallet = page.getByRole('link',{name:'Open wallet',exact:true});
        assert.ok((await wallet.boundingBox()).y<844,'wallet action before fold');
        await page.getByText(/Status retrieved:/).first().waitFor();
        await page.getByAltText('Payment request QR',{exact:true}).waitFor();
        if(route==='/invoice/') { await page.getByText(/^Merchant price: /).waitFor(); assert.match(await page.getByText(/Converted to XMR at/).textContent(),/ at \d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC\./); }
      }
      await page.close();
    }
    for(const invoiceStatus of ['confirmed','invalid','expired','payment_detected']) {
      await state(invoiceStatus);
      const page = await browser.newPage();
      await page.clock.install();
      await page.goto(base+'/i/'+id,{waitUntil:'networkidle'});
      let checks = 0;
      page.on('request',request=>{if(request.headers().rsc==='1') checks++;});
      if(['confirmed','invalid'].includes(invoiceStatus)) {
        await page.getByText('Automatic checks stopped.',{exact:true}).waitFor();
        await page.clock.fastForward(61000);await page.waitForTimeout(100);
        assert.equal(checks,0,invoiceStatus+' should stop checking');
      } else {
        const refreshed = page.waitForRequest(request=>request.headers().rsc==='1');
        await page.clock.fastForward(31000);await refreshed;
        assert.ok(checks>0,invoiceStatus+' should keep checking');
      }
      if(invoiceStatus==='expired') assert.equal((await page.getByRole('main').innerText()).match(/Do not send payment/g)?.length,1);
      assert.equal(await page.getByRole('link',{name:'Open wallet',exact:true}).count(),0);
      await page.close();
    }
    // A live till sale shows its address with a copy button for buyers who cannot scan.
    const till = await browser.newPage({viewport:{width:390,height:844}});
    await till.goto(base+'/terminal#k=fixture-key',{waitUntil:'networkidle'});
    await till.getByRole('button',{name:'5',exact:true}).click();
    await till.getByRole('button',{name:'Charge',exact:true}).click();
    await till.getByRole('button',{name:'Copy payment address',exact:true}).waitFor();
    assert.ok((await till.getByRole('main').innerText()).includes('4'+'1'.repeat(94)),'till shows the payment address');
    await till.close();
    console.log('Checkout placement, timestamps, state copy, and terminal polling passed.');
  } finally {await state('pending');await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
