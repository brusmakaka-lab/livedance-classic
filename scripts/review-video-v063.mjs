import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:365,height:648}});
 page.setDefaultTimeout(15000);
 await page.goto('file:///E:/LiveDance/LiveDance-v0.6.3-VisualPolish/docs/v063/evidence/SHOW-SIMULATOR.webm');
 await page.locator('video').evaluate(async v=>{v.pause();v.controls=false;v.style.cssText='width:365px;height:648px;object-fit:contain';document.body.style.cssText='margin:0;background:#000';if(v.readyState<2)await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));});
 const info=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,readyState:v.readyState}));
 for(const time of [4,15]){await page.locator('video').evaluate(async(v,t)=>{const ready=new Promise(r=>v.addEventListener('seeked',r,{once:true}));v.currentTime=t;await ready;},time);await page.screenshot({path:'docs/v063/evidence/video-frame-'+time+'.png'});}
 await fs.writeFile('docs/v063/video-check.json',JSON.stringify(info,null,2));console.log(info);
}finally{await browser.close();}
