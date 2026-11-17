import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/preview-patch',h=await harness('layout',5527),p=h.page,checks=[];
try {
 await p.setViewportSize({width:1100,height:800});await p.goto('http://127.0.0.1:5527/?empty=1&diagnostics=1');
 await p.waitForFunction(()=>__V05?.inspect().ready);
 for(const size of [{width:1100,height:800},{width:1101,height:800},{width:1280,height:720},{width:1366,height:768},{width:1440,height:1080}]){
  await p.setViewportSize(size);
  for(const open of [true,false]){
   await p.locator('.live-connector details').evaluate((e,open)=>e.open=open,open);
   for(const section of ['Dashboard','Simulator','Audio']){
    await p.locator('[data-nav="'+section+'"]').first().click();await p.waitForTimeout(90);
    const layout=await p.evaluate(()=>{
     const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
     const pane=document.querySelector('.studio-controls'),before=box('.stage');pane.scrollTop=pane.scrollHeight;
     const after=box('.stage');
     return {stage:after,preview:box('.preview-card'),pane:box('.studio-controls'),ratio:after.width/after.height,shift:after.y-before.y,scroll:pane.scrollTop,scrollable:pane.scrollHeight>pane.clientHeight,documentHeight:document.documentElement.scrollHeight};
    });
    assert(layout.stage.y>=0&&layout.stage.bottom<=size.height&&layout.stage.x>=0&&layout.stage.right<=size.width,JSON.stringify({size,open,section,layout}));
    assert(layout.preview.bottom<=size.height,JSON.stringify(layout));
    assert(Math.abs(layout.ratio-9/16)<.002);assert.equal(layout.shift,0);assert(layout.scrollable&&layout.scroll>0);
    assert(layout.documentHeight<=size.height+1,JSON.stringify(layout));
    checks.push({size,open,section,layout});
   }
  }
  await p.locator('[data-nav="Dashboard"]').first().click();
  await p.locator('.live-connector details').evaluate(e=>e.open=true);
  await p.locator('.studio-controls').evaluate(e=>e.scrollTop=0);await p.waitForTimeout(100);
  await p.screenshot({path:out+'/evidence/AFTER-'+size.width+'.png'});
 }
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await p.setViewportSize(size);await p.waitForTimeout(100);
  assert.equal(await p.locator('.studio-controls').count(),0);
  assert(await p.evaluate(()=>document.documentElement.scrollHeight>innerHeight));
  await p.locator('[data-action="clean"]').first().click();await p.waitForTimeout(100);
  const b=await p.locator('.stage').boundingBox();assert(Math.abs(b.width/b.height-9/16)<.002&&b.y>=0&&b.y+b.height<=size.height+1);
  assert.equal(await p.locator('.integration-status').isVisible(),false);
  await p.locator('.exit-clean').click();
  checks.push({size,mobileFlow:true,cleanStage:b});
 }
 assert.deepEqual(h.errors,[]);
}finally{
 await fs.writeFile(out+'/layout-check.json',JSON.stringify({checks,errors:h.errors},null,2));await h.close();console.log({cases:checks.length,errors:h.errors});
}
