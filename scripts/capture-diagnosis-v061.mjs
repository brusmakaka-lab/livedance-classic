import {harness} from './v05-harness.mjs';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const h=await harness('capture-v061');await h.browser.close();
const rows=[];
try{
 for(const mitigation of [false,true]){
  const flags=['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'];if(mitigation)flags.push('--disable-features=CalculateNativeWinOcclusion');
  const browser=await chromium.launch({channel:'msedge',headless:false,args:flags});
  try{
   const context=await browser.newContext({viewport:null});const page=await context.newPage();
   await page.goto('http://127.0.0.1:5392/?empty=1&clean=1&diagnostics=1');await page.waitForFunction(()=>window.__V05?.inspect().ready);
   await page.evaluate(()=>{const w=window.__V05.world;w.config.afk=false;w.config.adaptive=false;});
   for(let i=0;i<10;i++)await page.evaluate(i=>window.__V05.submit({schemaVersion:1,source:'simulator',eventId:'capture-'+i,viewerId:'capture-'+i,username:'FIXTURE '+i,eventType:'VIEWER_JOIN',giftCount:1,timestamp:Date.now(),metadata:{}}),i);
   await page.waitForFunction(()=>window.__V05.inspect().actors.length===10);await page.waitForTimeout(4000);
   const cdp=await context.newCDPSession(page),{windowId}=await cdp.send('Browser.getWindowForTarget');
   await cdp.send('Browser.setWindowBounds',{windowId,bounds:{left:50,top:50,width:700,height:750,windowState:'normal'}});
   const sample=async(label)=>{const before=await page.evaluate(()=>window.__LiveDance.capture());await new Promise(r=>setTimeout(r,7000));const after=await page.evaluate(()=>({capture:window.__LiveDance.capture(),snapshot:window.__LiveDance.snapshot()}));rows.push({mitigation,label,frameDelta:after.capture.frames-before.frames,...after});console.log(JSON.stringify({mitigation,label,frameDelta:rows.at(-1).frameDelta,visibility:after.capture.visibility,size:after.capture.cssSize}));};
   await page.bringToFront();await sample('clean-visible');
   const coverContext=await browser.newContext({viewport:null});const cover=await coverContext.newPage();await cover.setContent('<body style="background:#182230;color:white;font:30px sans-serif">LiveDance: prueba local de superposición (no TikTok LIVE)</body>');
   const coverCDP=await coverContext.newCDPSession(cover),coverWindow=await coverCDP.send('Browser.getWindowForTarget');
   if(coverWindow.windowId===windowId)throw Error('Expected separate windows');
   await coverCDP.send('Browser.setWindowBounds',{windowId:coverWindow.windowId,bounds:{windowState:'maximized'}});await cover.bringToFront();await sample('clean-covered');
   await page.evaluate(()=>document.body.classList.remove('clean'));await sample('dashboard-covered');
   await coverContext.close();await page.bringToFront();await sample('dashboard-visible');
   await page.evaluate(()=>document.body.classList.add('clean'));await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});await sample('minimized');
   await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await page.bringToFront();await page.waitForTimeout(1000);await page.screenshot({path:'docs/v061/evidence/capture-restored-'+mitigation+'.png'});
   rows.push({mitigation,label:'restored',capture:await page.evaluate(()=>window.__LiveDance.capture())});
  }finally{await browser.close();}
 }
 await fs.writeFile('docs/v061/capture-diagnosis.json',JSON.stringify({note:'Headful Edge; one physical 1536x864 screen; controlled browser overlay, not TikTok Studio capture. Playwright defaults also apply.',rows},null,2));
}finally{h.server.kill();}
