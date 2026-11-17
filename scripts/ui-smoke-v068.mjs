import {harness} from './v05-harness.mjs';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const h=await harness('dance-ui',5470),checks=[];
try{
 await h.page.setViewportSize({width:1440,height:1080});await h.page.goto('http://127.0.0.1:5470/?empty=1&diagnostics=1');
 await h.page.waitForFunction(()=>__V05?.inspect().ready);
 const entry=h.page.locator('[data-integration="entranceDance"]'),duration=h.page.locator('[data-integration="followSeconds"]');
 await entry.waitFor();await h.page.waitForFunction(()=>document.querySelector('[data-integration="entranceDance"]')?.querySelectorAll('option').length===7);
 assert.equal(await entry.inputValue(),'MixamoBoxingLoop');assert.equal(await duration.inputValue(),'7');
 await entry.selectOption('MixamoRumbaDancingLoop');await duration.selectOption('5');
 await h.page.reload();await h.page.waitForFunction(()=>__V05?.inspect().ready);
 assert.equal(await entry.inputValue(),'MixamoRumbaDancingLoop');assert.equal(await duration.inputValue(),'5');
 checks.push('Catalog populates on first load without navigating; Boxing/7s default; UI selection persists across reload');
 assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v068/ui-smoke.json',JSON.stringify({checks,errors:h.errors},null,2));await h.close();console.log({checks,errors:h.errors});}
