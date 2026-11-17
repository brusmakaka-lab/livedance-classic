import {harness} from './v05-harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const h=await harness('studio');const {page}=h;
try {
 await page.setViewportSize({width:1440,height:1080});await h.fill(10);
 await page.evaluate(()=>document.body.classList.remove('clean'));await page.waitForTimeout(700);
 await page.screenshot({path:'docs/v06/evidence/studio.png'});
 await page.locator('nav').getByRole('button',{name:'Simulator',exact:true}).click();
 await page.locator('[data-v05=demo]').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 const stage=await page.locator('#stage').boundingBox();assert.ok(stage.y>=0&&stage.y+stage.height<=1080,'sticky stage remains visible');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 await h.send('GIFT','viewer-9',{username:'Nova VIP',giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});await page.waitForTimeout(3500);
 await page.screenshot({path:'docs/v06/evidence/simulator.png'});
 await page.keyboard.press('F8');await page.getByRole('button',{name:'Reanudar',exact:true}).click();
 await page.locator('nav').getByRole('button',{name:'Dancers',exact:true}).click();await page.waitForSelector('[data-skin-preview]');
 await page.locator('[data-skin-preview]').first().click();await page.waitForFunction(()=>window.__V05.inspect().actors.some(a=>a.id==='__preview__'));await page.waitForTimeout(3500);
 const libraryStage=await page.locator('#stage').boundingBox();assert.ok(libraryStage.y>=0&&libraryStage.y+libraryStage.height<=1080);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'library fits viewport');
 await page.screenshot({path:'docs/v06/evidence/library.png'});
 await fs.writeFile('docs/v06/studio-ui.json',JSON.stringify({gate:'PASS',stage,libraryStage,errors:h.errors},null,2));
}finally{await h.close()}
