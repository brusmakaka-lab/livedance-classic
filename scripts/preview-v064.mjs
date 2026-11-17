import {harness} from './v05-harness.mjs';
const h=await harness('art-preview'),{page}=h;page.setDefaultTimeout(20000);
try{await h.fill(10);await page.waitForTimeout(3000);await page.screenshot({path:'docs/v064/evidence/draft-wide.png'});console.log(JSON.stringify(await page.evaluate(()=>({state:__V05.inspect(),framing:__V05.framing()}))));await h.send('GIFT','viewer-8',{giftId:'galaxy',giftName:'Galaxia · SIMULATOR',username:'Nova 8'});await page.waitForTimeout(4000);await page.screenshot({path:'docs/v064/evidence/draft-vip.png'});}finally{await h.close();}
