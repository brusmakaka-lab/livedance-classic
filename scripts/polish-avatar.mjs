import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {server,event,configure} from './polish-harness.mjs';
const s=await server(process.cwd(),'polish-avatar',5608),browser=await chromium.launch({channel:'msedge',headless:true}),p=await browser.newPage({viewport:{width:540,height:960}});
const url='https://p16.tiktokcdn.com/polish-local-fixture.png';
try{
 await p.route(url,r=>r.fulfill({contentType:'image/png',path:'public/integration/skins/coral.png'}));
 await p.goto(s.url);await configure(p);await p.evaluate(()=>__V05.reviewControl(true));
 const e=event(1,'COMMENT',0,{avatarUrl:url});await p.evaluate(e=>__V05.submit(e),e);
 for(let i=0;i<200;i++){await p.evaluate(()=>__V05.reviewFrame(.05));if(await p.evaluate(()=>__V05.inspect().actors.length===1))break;await p.waitForTimeout(30);}
 await p.evaluate(()=>{for(let i=0;i<60;i++)__V05.reviewFrame(1/30);});
 await p.waitForFunction(()=>__V05.show.banner.querySelector('.name-avatar img')?.complete);
 const original=(await p.evaluate(()=>__V05.inspect())).actors[0].slot;
 // Same event ID and same viewer: neither creates a second body or changes the logical seat.
 await p.evaluate(e=>{__V05.submit(e);__V05.submit({...e,eventId:'polish-new-event-same-viewer'});},e);
 await p.evaluate(()=>{for(let i=0;i<160;i++)__V05.reviewFrame(1/30);});
 const gift=event(3,'GIFT',0,{avatarUrl:url,giftName:'VIP',metadata:{tier:'HIGH'}});await p.evaluate(e=>__V05.submit(e),gift);
 await p.evaluate(()=>{for(let i=0;i<80;i++)__V05.reviewFrame(1/30);});
 const state=await p.evaluate(()=>({count:__V05.inspect().registered.length,actors:__V05.inspect().actors.length,slot:__V05.inspect().actors[0].slot,owner:__V05.show.banner.dataset.viewerId,image:__V05.show.banner.querySelector('.name-avatar img')?.getAttribute('src'),halo:__V05.show.stage.vipBinding?.id}));
 assert.equal(state.count,1);assert.equal(state.actors,1);assert.equal(state.slot,original);assert.equal(state.owner,'viewer-0');assert.equal(state.image,url);assert.equal(state.halo,'viewer-0');
 await p.locator('#stage').screenshot({path:'docs/rowshow-polish/AVATAR-VIP.png'});
 await p.evaluate(()=>__V05.configure({profilePhotos:false}));await p.evaluate(()=>__V05.reviewFrame(.05));assert.equal(await p.evaluate(()=>__V05.show.banner.querySelectorAll('.name-avatar').length),0);
 await fs.writeFile('docs/rowshow-polish/avatar-results.json',JSON.stringify({status:'PASS',state,profilePhotosOff:true,scope:'Synthetic HTTPS URL intercepted locally with an existing fixture PNG. Tests avatar binding, correct VIP ID, duplicate event/viewer and display option; no real TikTok request.'},null,2));console.log('Avatar / duplicados PASS',state);
}finally{await browser.close();s.close();}
