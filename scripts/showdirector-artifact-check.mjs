import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=path.resolve('docs/showdirector'),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'INFORME.html')).href);
 await page.locator('video').evaluate(v=>new Promise((resolve,reject)=>{if(v.readyState>=1)return resolve();v.onloadedmetadata=()=>resolve();v.onerror=()=>reject(Error('Invalid recording'));}));
 const video=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));assert(video.duration>107&&video.width===540&&video.height===960);
 const refs=await page.locator('[href],[src]').evaluateAll(elements=>elements.flatMap(e=>[e.getAttribute('href'),e.getAttribute('src')]).filter(Boolean));for(const ref of refs)await fs.access(path.join(root,ref));
 await page.screenshot({path:path.join(root,'INFORME-VISTA.png')});assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(root,'artifact-results.json'),JSON.stringify({status:'PASS',video,localReferences:refs.length,errors},null,2));console.log(JSON.stringify({status:'PASS',video,localReferences:refs.length}));
}finally{await browser.close();}
