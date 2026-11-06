const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const fixture = process.argv[3] || 'http://127.0.0.1:8035';
const assertBranded = async (page,label) => {
  await page.locator('.site-header .brand-logo').waitFor();
  await page.locator('.site-footer').waitFor();
  const background = await page.evaluate(()=>{const style=getComputedStyle(document.body);return style.backgroundImage+' '+style.backgroundColor});
  assert.match(background,/gradient|rgb\(248, 242, 233\)/,label+' background');
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    for (const width of [320,390,768,1440]) {
      const page = await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
      await page.clock.install();
      for (const [path,heading,code] of [
        ['/i/bad-id','Invalid invoice ID',404],
        ['/i/00000000-0000-4000-8000-000000000999','Invoice not found',404],
        ['/i/bad-id/receipt','Invalid invoice ID',404],
        ['/i/00000000-0000-4000-8000-000000000999/receipt','Invoice not found',404],
        ['/invoice/bad-id','Invoice link unavailable',404],
        ['/invoice/00000000-0000-4000-8000-000000000999','Invoice link unavailable',404],
        ['/pay/dead-token','Payment link unavailable',404],
        ['/missing-page','Page not found',404],
      ]) {
        let refreshes = 0;
        const onRequest = request => { if (request.headers().rsc === '1' && new URL(request.url()).pathname === path && !request.headers()['next-router-prefetch']) refreshes++; };
        page.on('request',onRequest);
        const response = await page.goto(base+path,{waitUntil:'networkidle'});
        assert.equal(response.status(),code,path);
        await page.getByRole('main').getByRole('heading',{name:heading,exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Retry',exact:true}).count(),0);
        await page.clock.fastForward(61000);
        await page.waitForTimeout(100);
        assert.equal(refreshes,0,path+' must not poll');
        if(path==='/missing-page') await assertBranded(page,path);
        if(path.startsWith('/invoice/')) await page.getByLabel('Invoice ID or link').waitFor();
        if(path.startsWith('/pay/')) assert.match(await page.getByRole('main').innerText(),/Do not send payment.*Contact the merchant/s);
        await page.evaluate(()=>document.documentElement.style.fontSize='200%');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' enlarged overflow');
        page.off('request',onRequest);
      }
      await fetch(fixture+'/__fixture',{method:'POST',body:JSON.stringify({invoiceResponseStatus:503})});
      await page.goto(base+'/i/00000000-0000-4000-8000-000000000456',{waitUntil:'networkidle'});
      await page.getByRole('heading',{name:'Status unavailable',exact:true}).waitFor();
      await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
      await fetch(fixture+'/__fixture',{method:'POST',body:JSON.stringify({invoiceResponseStatus:200})});
      await page.getByRole('button',{name:'Retry',exact:true}).click();
      await page.getByRole('heading',{name:'Payment request',exact:true}).waitFor();
      await page.close();
      console.log('Link errors, HTTP status, stopped polling, and recovery passed:',width);
    }
    const page = await browser.newPage();
    const linkEndpoint = fixture+'/api/core/payment-links/00000000-0000-4000-8000-000000000777';
    await fetch(linkEndpoint,{method:'PATCH',body:JSON.stringify({title:{internal:'internal-error-canary'}})});
    await page.goto(base+'/pay/fixture-token',{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Page unavailable',exact:true}).waitFor();
    assert.equal((await page.locator('body').innerText()).includes('internal-error-canary'),false);
    await assertBranded(page,'/pay/fixture-token error');
    await fetch(linkEndpoint,{method:'PATCH',body:JSON.stringify({title:'Fixture product'})});
    await page.getByRole('link',{name:'Skip to main content',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await page.getByRole('heading',{name:'Fixture product',exact:true}).waitFor();
    // Customer payment pages keep the brand but offer no site navigation, wallet connection or donation.
    for (const path of ['/pay/fixture-token',`/invoice/00000000-0000-4000-8000-000000000456`]) {
      await page.goto(base+path,{waitUntil:'networkidle'});
      await page.getByRole('heading',{name:'Fixture product',exact:true}).waitFor();
      await assertBranded(page,path);
      assert.equal(await page.getByRole('navigation',{name:'Primary navigation'}).count(),0,path+' navigation');
      assert.equal(await page.getByText('Connect view-only wallet').count(),0,path+' wallet connection');
      assert.equal(await page.getByRole('link',{name:'Donate'}).count(),0,path+' donation');
    }
    await page.getByText('Payment to Fixture shop',{exact:true}).waitFor();
    await page.close();
    const noScript = await browser.newContext({javaScriptEnabled:false});
    const staticPage = await noScript.newPage();
    for (const path of ['/i/bad-id', '/i/bad-id/receipt', '/i/00000000-0000-4000-8000-000000000999', '/i/00000000-0000-4000-8000-000000000999/receipt']) {
      assert.equal((await staticPage.goto(base+path)).status(),404);
      await staticPage.getByRole('heading',{name:path.includes('bad-id')?'Invalid invoice ID':'Invoice not found',exact:true}).waitFor();
      await assertBranded(staticPage,path+' without JavaScript');
    }
    assert.equal((await staticPage.goto(base+'/invoice/bad-id')).status(),404);
    await staticPage.getByRole('heading',{name:'Invoice link unavailable',exact:true}).waitFor();
    assert.equal((await staticPage.goto(base+'/missing-page')).status(),404);
    await staticPage.getByRole('main').getByRole('heading',{name:'Page not found',exact:true}).waitFor();
    await assertBranded(staticPage,'/missing-page without JavaScript');
    await noScript.close();
    const signedIn = await browser.newContext({viewport:{width:1440,height:844}});
    await signedIn.addCookies([{name:'xmrcheckout_api_key',value:'fixture-key',url:base}]);
    const signedInPage = await signedIn.newPage();
    assert.equal((await signedInPage.goto(base+'/missing-page')).status(),404);
    const nav = signedInPage.getByRole('navigation',{name:'Primary navigation'});
    await nav.getByRole('link',{name:'Dashboard',exact:true}).waitFor();
    await nav.getByRole('button',{name:'Log out',exact:true}).waitFor();
    assert.equal(await nav.getByText('Connect view-only wallet',{exact:true}).count(),0);
    await signedIn.close();
  } finally {
    await fetch(fixture+'/__fixture',{method:'POST',body:JSON.stringify({invoiceResponseStatus:200})});
    await fetch(fixture+'/api/core/payment-links/00000000-0000-4000-8000-000000000777',{method:'PATCH',body:JSON.stringify({title:'Fixture product'})});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
