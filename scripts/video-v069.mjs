import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';
const h=await harness('polish-video',5479),{page}=h,out='docs/v069/evidence/',traces={};
const ffmpeg='C:/Users/Usuario/AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe';
try{
 await page.addStyleTag({content:'*{transition:none!important;animation:none!important}'});
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({artMode:'CONCERT',featured:10,idleDance:false,likeDance:false,groupDance:false});});
 for(const polish of [false,true]){
  const mode=polish?'DESPUES':'ANTES';await page.evaluate(()=>__V05.reviewControl(false));await h.fill(30);
  await page.evaluate(polish=>{
   __V05.configure({lineup:true,materialize:true,entrance:true,stagePolish:polish});__V05.reviewControl(true);const s=__V05.show;s.events.clear();s.waiting=[];
   s.actors=new Map([...s.actors].sort(([a],[b])=>Number(a.split('-')[1])-Number(b.split('-')[1])));
   for(let i=0;i<360;i++)__V05.reviewFrame(1/60);
   s.time=0;s.director.initialized=false;
   [...s.actors.values()].forEach((a,i)=>{a.born=-100;a.player.set(i%3===2?'MixamoDance2Loop':'MixamoHipHopLoop',true);a.player.seek((i%5)*.27);});__V05.reviewFrame(0);
  },polish);
  const video=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-c:v','mjpeg','-framerate','30','-i','pipe:0','-an','-c:v','libvpx','-b:v','2100k','-deadline','realtime','-cpu-used','4',out+mode+'.webm'],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let errors='';video.stderr.on('data',x=>errors+=x);video.stdin.on('error',()=>{});const done=once(video,'close');const trace=[];
  for(let f=0;f<540;f++){
   if(f===60)await h.send('FOLLOW','viewer-29',{username:'Valentina'});
   if(f===285)await h.send('GIFT','viewer-28',{username:'Mateo',giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});
   if(f===390){await page.evaluate(()=>__V05.show.events.clear());await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});}
   await page.evaluate(dt=>__V05.reviewFrame(dt),f?1/30:0);
   if(f%60===0)trace.push(await page.evaluate(()=>__V05.inspect()));
   if([30,105,180,330,480].includes(f))await page.screenshot({path:out+mode+'-t'+f/30+'.png'});
   const jpeg=await page.screenshot({type:'jpeg',quality:91});if(!video.stdin.write(jpeg))await once(video.stdin,'drain');
   if(f%180===0)console.log(mode+' '+f+'/540');
  }
  video.stdin.end();const [code]=await done;if(code!==0)throw Error(errors);traces[mode]=trace;
 }
 assert.deepEqual(h.errors,[]);
 await fs.writeFile('docs/v069/comparison.json',JSON.stringify({seconds:18,fps:30,resolution:[365,648],offline:true,description:'Same camera, cast, clips and scripted simulator events. Feature flag OFF/ON compares stage only. Follow t2, VIP t9.5, Fever t13 (VIP explicitly cleared to demonstrate Fever within short video). 30 registered, five visible plus exit. Offline recording is not performance evidence.',traces,errors:h.errors},null,2));
}finally{await h.close();}
