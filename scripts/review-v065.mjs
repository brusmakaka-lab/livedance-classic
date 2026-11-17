import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 const page=await browser.newPage({viewport:{width:365,height:648}});page.setDefaultTimeout(20000);
 for(const mode of ['ANTERIOR','ENTRADA']){
  await page.goto('file:///E:/LiveDance/LiveDance-v0.6.5-EntranceLab/docs/v065/evidence/'+mode+'-FOLLOW-VIP.webm');
  await page.locator('video').evaluate(async v=>{v.pause();v.controls=false;v.muted=true;v.style.cssText='width:365px;height:648px;object-fit:contain';document.body.style.cssText='margin:0;background:#000';if(v.readyState<2)await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));});
  const info=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration}));assert.equal(info.width,365);assert.equal(info.height,648);assert(Math.abs(info.duration-22)<.1);
  for(const t of [2.3,3.2,3.8,5,7,10,12,14,21]){
   await page.locator('video').evaluate(async(v,t)=>{const seeked=new Promise(r=>v.addEventListener('seeked',r,{once:true}));v.currentTime=t;await seeked;},t);
   await page.screenshot({path:'docs/v065/evidence/'+mode+'-decoded-'+t+'.png'});
  }
  const playback=await page.locator('video').evaluate(async v=>{v.currentTime=0;const ended=new Promise((resolve,reject)=>{v.addEventListener('ended',resolve,{once:true});v.addEventListener('error',()=>reject(v.error?.message),{once:true});});await v.play();await ended;const q=v.getVideoPlaybackQuality();return{decodedFrames:q.totalVideoFrames,droppedFrames:q.droppedVideoFrames,error:v.error?.message||null};});
  results.push({mode,...info,...playback});console.log(results.at(-1));
 }
 await fs.writeFile('docs/v065/video-review.json',JSON.stringify({results,note:'Decoded frames and full playback checked; offline recordings are not Live Studio capture measurements.'},null,2));
}finally{await browser.close();}
