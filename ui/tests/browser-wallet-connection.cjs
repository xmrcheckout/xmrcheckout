const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:3336';
(async()=>{
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    for(const width of [320,390,768,1440]) {
      const context = await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      const page = await context.newPage();
      await page.goto(base+'/dashboard?tab=invoices',{waitUntil:'networkidle'});
      assert.equal(new URL(page.url()).searchParams.get('next'),'/dashboard?tab=invoices');
      const address = page.getByLabel('Primary address',{exact:true});
      const key = page.getByLabel('Private view key',{exact:true});
      const submit = page.getByRole('dialog').getByRole('button',{name:'Connect view-only wallet',exact:true});
      assert.equal(await submit.isDisabled(),true);
      await address.fill('8'+'1'.repeat(94));
      await page.getByText(/Subaddresses starting with 8 cannot connect/).waitFor();
      assert.equal(await address.getAttribute('aria-invalid'),'true');
      assert.equal(await page.locator('#address-format').getAttribute('role'),null);
      await address.fill('4'+'1'.repeat(93));
      await page.getByText('The primary address must contain 95 characters.',{exact:true}).waitFor();
      await address.fill('4'+'1'.repeat(94));await key.fill('a'.repeat(63));
      await page.getByText('The private view key must contain 64 hexadecimal characters.',{exact:true}).waitFor();
      assert.equal(await key.getAttribute('aria-invalid'),'true');
      await key.fill('a'.repeat(64));
      await page.getByText('Address and view key match',{exact:true}).waitFor();
      assert.equal(await submit.isEnabled(),true);
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await submit.click();await page.waitForURL(base+'/dashboard?tab=invoices');
      assert.equal(new URL(page.url()).searchParams.has('view_key'),false);
      await context.close();
      console.log('Wallet format guidance and dashboard return passed:',width);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
