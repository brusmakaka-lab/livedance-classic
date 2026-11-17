import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';
const ffmpeg=process.env.LIVEDANCE_FFMPEG || 'C:/Users/Usuario/AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe';
const h=await harness('art-video'),{page}=h,out='docs/v064/evidence/',traces={};page.setDefaultTimeout(30000);
try {
 await page.addStyleTag({content:'*{transition:none!important;animation:none!important}'});
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({featured:10,idleDance:false,likeDance:false,groupDance:false});});
 for(const artMode of ['BASE','CONCERT']) {
  await page.evaluate(()=>__V05.reviewControl(false));await h.fill(30);
  await page.evaluate(artMode=>{
   __V05.configure({artMode});__V05.reviewControl(true);const s=__V05.show;s.manual='WIDE';s.events.clear();s.waiting=[];
   s.actors=new Map([...s.actors].sort(([a],[b])=>Number(a.split('-')[1])-Number(b.split('-')[1])));
   for(let i=0;i<360;i++)__V05.reviewFrame(1/60);
   s.time=0;s.director.initialized=false;
   [...s.actors.values()].forEach((a,i)=>{a.born=-100;a.player.set(i%3===2?'MixamoDance2Loop':'MixamoHipHopLoop',true);a.player.seek((i%5)*.27);});
   __V05.reviewFrame(0);
  },artMode);
  const video=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-c:v','mjpeg','-framerate','30','-i','pipe:0','-an','-c:v','libvpx','-b:v','2000k','-deadline','realtime','-cpu-used','4',out+artMode+'-WIDE-VIP-WIDE.webm'],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let errors='';video.stderr.on('data',x=>errors+=x);video.stdin.on('error',()=>{});const done=once(video,'close');const trace=[];
  for(let f=0;f<960;f++) {
   if(f===240)await h.send('GIFT','viewer-29',{username:'Álex 29',giftId:'galaxy',giftName:'Galaxia · SIMULATOR',metadata:{tier:'HIGH'}});
   await page.evaluate(dt=>__V05.reviewFrame(dt),f?1/30:0);
   if(f%30===0)trace.push(await page.evaluate(()=>{const s=__V05.inspect();return {time:__V05.show.time,event:s.event,registered:s.registered,actors:s.actors.map(a=>({id:a.id,skinId:a.skinId,dance:a.dance,t:a.danceTime})),framing:__V05.framing()};}));
   if([120,345,450,720].includes(f))await page.screenshot({path:out+artMode+'-t'+f/30+'.png'});
   const jpeg=await page.screenshot({type:'jpeg',quality:91});if(!video.stdin.write(jpeg))await once(video.stdin,'drain');
   if(f%240===0)console.log(artMode+' '+f+'/960 frames');
  }
  video.stdin.end();const [code]=await done;if(code!==0)throw Error(errors);traces[artMode]=trace;
 }
 for(let i=0;i<traces.BASE.length;i++){
  const a=traces.BASE[i],b=traces.CONCERT[i];assert.deepEqual(a.registered,b.registered);
  assert.deepEqual(a.actors.map(({t,...v})=>v),b.actors.map(({t,...v})=>v),'skin/clip mismatch at second '+i);
  assert(a.actors.every((v,j)=>Math.abs(v.t-b.actors[j].t)<1e-6),'clip phase mismatch at second '+i);
 }
 await fs.writeFile('docs/v064/comparison.json',JSON.stringify({fps:30,seconds:32,resolution:[365,648],offline:true,description:'Fixed-step 1/30s. Same skins, phases, participants and event at t8. CSS transitions disabled equally; cue envelopes and camera simulation remain active. Not a performance or real capture test.',traces,errors:h.errors},null,2));
 assert.deepEqual(h.errors,[]);
} finally {await h.close();}
