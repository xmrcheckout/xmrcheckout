const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const axePath = require.resolve('axe-core/axe.min.js');
const base = process.argv[2] || 'http://127.0.0.1:3336';
async function contrast(page, edge = "top") {
  await page.evaluate(edge => {
    for(const element of document.querySelectorAll('[role=dialog], [role=dialog] *')) {
      if(element.scrollHeight>element.clientHeight && ['auto','scroll'].includes(getComputedStyle(element).overflowY)) element.scrollTop=edge==='top'?0:element.scrollHeight;
    }
  },edge);
  const samples=await page.evaluate(()=>{
    const root=document.querySelector('[role=dialog]') || document.body;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const samples=[];
    while(walker.nextNode()) {
      const node=walker.currentNode, element=node.parentElement;
      if(!node.textContent.trim() || !element || element.closest('script,style,option,[disabled],[inert]') || !(element instanceof HTMLElement)) continue;
      const style=getComputedStyle(element); if(!element.checkVisibility({visibilityProperty:true,opacityProperty:true})) continue;
      if([...document.querySelectorAll('details:not([open])')].some(detail=>detail.contains(element) && !detail.querySelector('summary')?.contains(element))) continue;
      const range=document.createRange();range.selectNodeContents(node);
      const color=style.color.match(/[\d.]+/g)?.map(Number);if(!color || color.length<3) continue;
      let alpha=color[3]??1;for(let e=element;e;e=e.parentElement) alpha*=Number(getComputedStyle(e).opacity);
      const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700);
      for(const rect of range.getClientRects()) if(rect.width>1 && rect.height>1 && (!element.closest("[role=dialog]") || (rect.y>=0 && rect.bottom<=innerHeight)) && !Array.from((function*(e){for(;e;e=e.parentElement)yield e;})(element)).some(e=>{
        const bounds=e.getBoundingClientRect();return ['auto','scroll','hidden','clip'].includes(getComputedStyle(e).overflowY) && (rect.y<bounds.y || rect.bottom>bounds.bottom);
      })) samples.push({text:node.textContent.trim().slice(0,70),color:color.slice(0,3),alpha,required:large?3:4.5,points:[.1,.5,.9].map(x=>[rect.x+scrollX+rect.width*x,rect.y+scrollY+rect.height/2])});
    }
    for(const element of root.querySelectorAll('input:not([disabled]),textarea,select')) {
      const rect=element.getBoundingClientRect(); if(!rect.width || !rect.height || !element.checkVisibility() || (element.closest('[role=dialog]') && (rect.y<0 || rect.bottom>innerHeight))) continue;
      if([...document.querySelectorAll('details:not([open])')].some(detail=>detail.contains(element) && !detail.querySelector('summary')?.contains(element))) continue;
      const color=getComputedStyle(element).borderTopColor.match(/[\d.]+/g)?.map(Number);
      if(color) samples.push({text:'Control boundary: '+(element.id || element.tagName),color:color.slice(0,3),alpha:color[3]??1,required:3,points:[[rect.x+scrollX+rect.width/2,rect.y+scrollY+rect.height/2]]});
    }
    return samples;
  });
  const hidden=await page.addStyleTag({content:'* {color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} ::placeholder {color:transparent!important}'});
  const file=path.join(os.tmpdir(),`xmr-contrast-${process.pid}.png`);
  await page.screenshot({path:file,fullPage:!(await page.locator("[role=dialog]").count())});await hidden.evaluate(e=>e.remove());
  const result=spawnSync(process.env.CONTRAST_PYTHON || 'python3',[path.join(__dirname,'contrast-samples.py'),file],{input:JSON.stringify(samples),encoding:'utf8'});
  fs.unlinkSync(file);assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);assert.ok(report.checked>0);assert.deepEqual(report.failures,[],'rendered text contrast');
  return report.checked + (edge === "top" && await page.locator("[role=dialog]").count() ? await contrast(page,"bottom") : 0);
}
async function scan(page, name) {
  await page.addScriptTag({path:axePath});
  const result = await page.evaluate(async()=>window.axe.run(document.querySelector('[role=dialog]') || document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  console.log(JSON.stringify({scan:name,violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:result.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))}));
  assert.deepEqual(result.violations.map(v=>v.id),[],name);
  assert.deepEqual(result.incomplete.filter(v=>v.id!=='color-contrast').map(v=>v.id),[],name+' unresolved checks');
  console.log(JSON.stringify({resolvedContrast:name,samples:await contrast(page)}));
}
async function keyboard(page, dialog) {
  const controls=dialog.locator('summary,a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"]').filter({visible:true});
  const first=controls.first(), last=controls.last();
  await first.focus();await page.keyboard.press('Shift+Tab');assert.ok(await last.evaluate(e=>e===document.activeElement),'backward wrap');
  await page.keyboard.press('Tab');assert.ok(await first.evaluate(e=>e===document.activeElement),'forward wrap');
  for(let n=0;n<await controls.count();n++) {
    const control=controls.nth(n);await control.focus();
    assert.ok(await control.evaluate(e=>{const s=getComputedStyle(e);return (s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0) || s.boxShadow!=='none';}),'visible focus '+await control.evaluate(e=>e.outerHTML.slice(0,80)));
  }
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  for(const width of (process.env.A11Y_WIDTHS || '320,390,768,1440').split(',').map(Number)) {
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
   await page.goto(base+'/tour?tab=invoice',{waitUntil:'networkidle'});
   const preview=page.getByRole('region',{name:'Simulated checkout preview'});
   assert.equal(await preview.getByLabel('Preview payment state').inputValue(),'payment_detected');
   for(const [status,count,events] of [['pending','0/2',['Invoice created']],['payment_detected','1/2',['Invoice created','Payment detected']],['confirmed','2/2',['Invoice created','Payment detected','Payment confirmed']],['expired','0/2',['Invoice created','Invoice expired']],['invalid','0/2',['Invoice created','Invoice marked invalid']]]) {
    await preview.getByLabel('Preview payment state').selectOption(status);
    assert.equal(await page.getByTestId('context-confirmations').innerText(),count);
    assert.deepEqual((await page.locator('#tour-invoice-timeline + ol li > p:first-child').allTextContents()).reverse(),events);
    await scan(page,`tour ${width} ${status}`);
   }
   assert.match(await preview.ariaSnapshot(),/Simulated—no payment requested/);
   await page.goto(base+'/tour?tab=invoices',{waitUntil:'networkidle'});
   await scan(page,`invoices ${width}`);
   const create=page.getByRole('button',{name:'Create invoice',exact:true});
   for(const close of ['Escape','Close','Cancel','Done']) {
    await create.focus();await create.click();const dialog=page.getByRole('dialog');
    await page.locator('#wizard_amount_mode').waitFor();assert.equal(await page.locator('#wizard_amount_mode').evaluate(e=>e===document.activeElement),true);
    await dialog.locator('summary').first().click();await keyboard(page,dialog);
    await dialog.locator('summary').first().click();await keyboard(page,dialog);
    await scan(page,`create ${width} ${close}`);
    if(close==='Done') {
     const target=width===320?0:width===390?1:2;
     await dialog.locator('summary').first().click();
     await page.locator('#wizard_confirmation_mode').selectOption('custom');
     await page.locator('#wizard_confirmation_target').fill(String(target));
     await dialog.getByLabel('Amount (XMR)',{exact:true}).fill('0.125');await dialog.locator('button[type=submit]').click();
     await page.getByText('Simulated invoice ready. Nothing was saved.',{exact:true}).waitFor();await keyboard(page,dialog);await scan(page,`success ${width}`);
     const state=dialog.getByLabel('Preview payment state');
     assert.equal(await state.locator('option[value=payment_detected]').count(),target===0?0:1);
     await state.selectOption('confirmed');await dialog.getByText(`Example confirmations: ${target}/${target}`,{exact:true}).waitFor();
    }
    if(close==='Escape') await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:close,exact:true}).click();
    await dialog.waitFor({state:'detached'});assert.ok(await create.evaluate(e=>e===document.activeElement),'creation focus return');
   }
   await page.goto(base,{waitUntil:'networkidle'});await scan(page,`home ${width}`);
   const trigger=page.getByRole('button',{name:'Connect view-only wallet',exact:true}).filter({visible:true}).first();
   for(const close of ['Escape','Close login modal']) {
    await trigger.focus();await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
    await page.waitForFunction(()=>document.activeElement?.id==='payment_address');
    await page.getByText('Where do I find these?',{exact:true}).click();
    await page.locator('summary').filter({hasText:/^Cake Wallet$/}).click();
    await keyboard(page,dialog);await scan(page,`wallet ${width}`);
    const size=await dialog.locator('button[type=submit]').evaluate(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));assert.ok(size.w>=44 && size.h>=44);
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'enlarged wallet overflow');
    await dialog.getByRole('button',{name:'Close login modal'}).scrollIntoViewIfNeeded();
    if(close==='Escape') await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:close}).click();
    await dialog.waitFor({state:'detached'});assert.ok(await trigger.evaluate(e=>e===document.activeElement),'wallet focus return');
    await page.evaluate(()=>document.documentElement.style.fontSize='');
   }
   await page.close();console.log('Accessibility completed',width);
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
