const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
async function contrast(page, edge = "top") {
  // Transitions would report a fading color and alpha while the text is hidden or restored.
  const still=await page.addStyleTag({content:'* {transition:none!important}'});
  if (!await page.locator('[role=dialog]').count()) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
  }
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
      for(const rect of range.getClientRects()) {
        let left=rect.left, right=rect.right, top=rect.top, bottom=rect.bottom;
        // Sample the visible slice of a line inside nested scroll containers.
        // Offscreen code must never be clamped onto the page's light background.
        for(let ancestor=element;ancestor;ancestor=ancestor.parentElement) {
          const bounds=ancestor.getBoundingClientRect(), css=getComputedStyle(ancestor);
          if(['auto','scroll','hidden','clip'].includes(css.overflowX)) {
            left=Math.max(left,bounds.left+ancestor.clientLeft);
            right=Math.min(right,bounds.left+ancestor.clientLeft+ancestor.clientWidth);
          }
          if(['auto','scroll','hidden','clip'].includes(css.overflowY)) {
            top=Math.max(top,bounds.top+ancestor.clientTop);
            bottom=Math.min(bottom,bounds.top+ancestor.clientTop+ancestor.clientHeight);
          }
        }
        left=Math.max(left,-scrollX);
        right=Math.min(right,document.documentElement.clientWidth-scrollX);
        top=Math.max(top,-scrollY);
        bottom=Math.min(bottom,document.documentElement.scrollHeight-scrollY);
        if(right-left<=1 || bottom-top<=1) continue;
        if(element.closest('[role=dialog]') && (top<0 || bottom>innerHeight)) continue;
        samples.push({text:node.textContent.trim().slice(0,70),color:color.slice(0,3),alpha,required:large?3:4.5,
          points:[.1,.5,.9].map(x=>[left+scrollX+(right-left)*x,top+scrollY+(bottom-top)/2])});
      }
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
  await page.screenshot({path:file,fullPage:!(await page.locator("[role=dialog]").count())});await hidden.evaluate(e=>e.remove());await still.evaluate(e=>e.remove());
  const result=spawnSync(process.env.CONTRAST_PYTHON || 'python3',[path.join(__dirname,'contrast-samples.py'),file],{input:JSON.stringify(samples),encoding:'utf8'});
  fs.unlinkSync(file);assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);assert.ok(report.checked>0);assert.deepEqual(report.failures,[],'rendered text contrast');
  return report.checked + (edge === "top" && await page.locator("[role=dialog]").count() ? await contrast(page,"bottom") : 0);
}

module.exports = { contrast };
