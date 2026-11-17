import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';
const h=await harness('lineup-video',5444),{page}=h,out='docs/v066/evidence/',traces={};
const ffmpeg=process.env.LIVEDANCE_FFMPEG||'C:/Users/Usuario/AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe';
try{
 await page.addStyleTag({content:'*{transition:none!important;animation:none!important}'});
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({artMode:'CONCERT',featured:10,idleDance:false,likeDance:false,groupDance:false});});
 for(const lineup of [false,true]){
  const mode=lineup?'FILA':'ANTERIOR';await page.evaluate(()=>__V05.reviewControl(false));await h.fill(30);
  await page.evaluate(lineup=>{
   __V05.configure({lineup,entrance:true});__V05.reviewControl(true);const s=__V05.show;s.events.clear();s.waiting=[];
   s.actors=new Map([...s.actors].sort(([a],[b])=>Number(a.split('-')[1])-Number(b.split('-')[1])));
   for(let i=0;i<360;i++)__V05.reviewFrame(1/60);
   s.time=0;s.director.initialized=false;
   [...s.actors.values()].forEach((a,i)=>{a.born=-100;a.player.set(i%3===2?'MixamoDance2Loop':'MixamoHipHopLoop',true);a.player.seek((i%5)*.27);});__V05.reviewFrame(0);
  },lineup);
  const video=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-c:v','mjpeg','-framerate','30','-i','pipe:0','-an','-c:v','libvpx','-b:v','2000k','-deadline','realtime','-cpu-used','4',out+mode+'-INGRESOS.webm'],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let errors='';video.stderr.on('data',x=>errors+=x);video.stdin.on('error',()=>{});const done=once(video,'close');const trace=[];
  for(let f=0;f<660;f++){
   if(f===60)await h.send('FOLLOW','viewer-28',{username:'Valentina'});
   if(f===240)await h.send('FOLLOW','viewer-27',{username:'Mateo'});
   if(f===420)await h.send('FOLLOW','viewer-26',{username:'Álex'});
   await page.evaluate(dt=>__V05.reviewFrame(dt),f?1/30:0);
   if(f%30===0)trace.push(await page.evaluate(()=>__V05.inspect()));
   if([30,69,90,120,165,270,300,450,510,630].includes(f))await page.screenshot({path:out+mode+'-t'+f/30+'.png'});
   const jpeg=await page.screenshot({type:'jpeg',quality:91});if(!video.stdin.write(jpeg))await once(video.stdin,'drain');
   if(f%180===0)console.log(mode+' '+f+'/660');
  }
  video.stdin.end();const [code]=await done;if(code!==0)throw Error(errors);traces[mode]=trace;
 }
 for(let i=0;i<traces.ANTERIOR.length;i++)assert.deepEqual(traces.ANTERIOR[i].actors.map(a=>[a.id,a.skinId]),traces.FILA[i].actors.map(a=>[a.id,a.skinId]));
 assert.deepEqual(h.errors,[]);
 await fs.writeFile('docs/v066/comparison.json',JSON.stringify({seconds:22,fps:30,resolution:[365,648],offline:true,description:'Same lab lineup OFF/ON; previous v065 entrance versus fixed five-person lineup. Same initial skins/poses. Follow t2/t8/t14. Imported dances unchanged; no Salute in lineup. Offline rendering, not performance evidence.',traces,errors:h.errors},null,2));
}finally{await h.close();}
