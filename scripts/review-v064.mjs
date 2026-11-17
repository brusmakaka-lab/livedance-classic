import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 const page=await browser.newPage({viewport:{width:365,height:648}});page.setDefaultTimeout(20000);
 for(const mode of ['BASE','CONCERT']){
  await page.goto('file:///E:/LiveDance/LiveDance-v0.6.4-ArtDirectionLab/docs/v064/evidence/'+mode+'-WIDE-VIP-WIDE.webm');
  await page.locator('video').evaluate(async v=>{v.pause();v.controls=false;v.muted=true;v.style.cssText='width:365px;height:648px;object-fit:contain';document.body.style.cssText='margin:0;background:#000';if(v.readyState<2)await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));});
  const info=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration}));assert.equal(info.width,365);assert.equal(info.height,648);assert(Math.abs(info.duration-32)<.1);
  for(const t of [4,8.5,10,11.5,14,16,20,28]){
   await page.locator('video').evaluate(async(v,t)=>{const seeked=new Promise(r=>v.addEventListener('seeked',r,{once:true}));v.currentTime=t;await seeked;},t);
   await page.screenshot({path:'docs/v064/evidence/'+mode+'-decoded-'+t+'.png'});
  }
  const playback=await page.locator('video').evaluate(async v=>{v.currentTime=0;const ended=new Promise((resolve,reject)=>{v.addEventListener('ended',resolve,{once:true});v.addEventListener('error',()=>reject(v.error?.message),{once:true});});await v.play();await ended;const q=v.getVideoPlaybackQuality();return {decodedFrames:q.totalVideoFrames,droppedFrames:q.droppedVideoFrames,error:v.error?.message||null};});
  results.push({mode,...info,...playback,sampledSeconds:[4,8.5,10,11.5,14,16,20,28]});console.log(JSON.stringify(results.at(-1)));
 }
 await fs.writeFile('docs/v064/video-review.json',JSON.stringify({results,note:'Decoded screenshots and complete playback checked. Artistic approval remains with the user; offline videos do not certify Live Studio capture.'},null,2));
}finally{await browser.close();}
