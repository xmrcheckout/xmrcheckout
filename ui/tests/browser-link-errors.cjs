const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
const fixture = process.argv[3] || 'http://127.0.0.1:8035';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    for (const width of [320,390,768,1440]) {
      const page = await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
      await page.clock.install();
      for (const [path,heading,code] of [
        ['/i/bad-id','Invalid invoice ID',200],
        ['/i/00000000-0000-4000-8000-000000000999','Invoice not found',200],
        ['/invoice/bad-id','Invalid invoice ID',404],
        ['/invoice/00000000-0000-4000-8000-000000000999','Invoice not found',404],
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
  } finally {
    await fetch(fixture+'/__fixture',{method:'POST',body:JSON.stringify({invoiceResponseStatus:200})});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
