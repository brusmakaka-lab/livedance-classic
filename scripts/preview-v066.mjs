import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
const h=await harness('lineup-preview'),{page}=h;
try{
 await page.evaluate(()=>{__V05.configure({lineup:true,featured:10,idleDance:false,likeDance:false,groupDance:false});});
 await h.fill(10);await page.evaluate(()=>__V05.reviewControl(true));
 await page.screenshot({path:'docs/v066/evidence/preview-normal.png'});
 await h.send('FOLLOW','viewer-8',{username:'Valentina'});
 for(let i=0;i<65;i++){
  await page.evaluate(()=>{for(let i=0;i<6;i++)__V05.reviewFrame(1/60);});
  if([2,12,29,59].includes(i))await page.screenshot({path:'docs/v066/evidence/preview-'+i+'.png'});
 }
 console.log(await page.evaluate(()=>({state:__V05.inspect(),frame:__V05.framing()})));
 await fs.writeFile('docs/v066/preview.json',JSON.stringify(await page.evaluate(()=>({state:__V05.inspect(),frame:__V05.framing()})),null,2));
}finally{await h.close();}
