import {chromium} from '@playwright/test';import fs from'node:fs/promises';import path from'node:path';import{pathToFileURL}from'node:url';import assert from'node:assert/strict';
const root=path.resolve('docs/rowshow-polish'),html=await fs.readFile(path.join(root,'INFORME.html'),'utf8'),missing=[];
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){const value=match[1];if(value.startsWith('#')||value.startsWith('http'))continue;try{await fs.access(path.resolve(root,value));}catch{missing.push(value);}}
assert.deepEqual(missing,[]);
const browser=await chromium.launch({channel:'msedge',headless:true}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(pathToFileURL(path.join(root,'INFORME.html')).href);
 for(const id of ['comparison','hallazgos','filas','fps','evidencia']){await p.locator('#'+id).scrollIntoViewIfNeeded();await p.waitForTimeout(100);}
 await p.evaluate(()=>{for(const img of document.images)img.loading='eager';});
 await p.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0),{},{timeout:15000});
 assert.equal(await p.locator('article[id^="H"]').count(),8);assert.equal(await p.evaluate(()=>[...document.images].filter(i=>!i.naturalWidth).length),0);
 const media=await p.evaluate(async()=>{const results=[];for(const v of document.querySelectorAll('video')){await new Promise((resolve,reject)=>{if(v.readyState>=1){resolve();return;}const timer=setTimeout(()=>reject(Error('Video metadata timeout')),15000);v.onloadedmetadata=()=>{clearTimeout(timer);resolve();};v.onerror=()=>{clearTimeout(timer);reject(Error('Video metadata failed'));};v.load();});results.push({src:v.getAttribute('src'),width:v.videoWidth,height:v.videoHeight,duration:v.duration});}return results;});
 assert.equal(media[0].width,1120);assert.equal(media[1].width,540);assert.equal(media[1].height,960);assert(media.every(v=>v.duration>121));
 await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(root,'INFORME-VISTA.png')});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(root,'report-check.json'),JSON.stringify({status:'PASS',missing,images:await p.locator('img').count(),media,errors,responsiveWidth390:true},null,2));console.log('Report PASS',media);
}finally{await browser.close();}
