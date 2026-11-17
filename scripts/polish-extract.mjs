import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';
const out=path.resolve('docs/rowshow-polish'),ffmpeg=process.env.LIVEDANCE_FFMPEG||path.join(process.env.LOCALAPPDATA,'ms-playwright/ffmpeg-1013/ffmpeg-win64.exe'),video=path.join(out,'COMPARACION-ANTES-DESPUES.webm');
const result=JSON.parse(await fs.readFile(path.join(out,'recording-results.json'),'utf8'));
const run=args=>new Promise((resolve,reject)=>{const child=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let log='';child.stderr.on('data',data=>log+=data);child.on('exit',code=>code===0?resolve():reject(Error(log)));child.on('error',reject);});
for(const capture of result.captures){
 const time=(result.leadSeconds+capture.time).toFixed(3);
 await run(['-nostdin','-y','-ss',time,'-i',video,'-frames:v','1',path.join(out,'COMPARACION-'+capture.label+'.png')]);
 for(const [side,x]of [['before',10],['after',570]])await run(['-nostdin','-y','-ss',time,'-i',video,'-vf',`crop=540:960:${x}:120`,'-frames:v','1',path.join(out,side+'-'+capture.label+'.png')]);
 console.log('Captured',capture.label,time);
}
await run(['-nostdin','-y','-i',video,'-vf','crop=540:960:570:120','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8','-b:v','1800k','-threads','4',path.join(out,'SIMULACION-LIMPIA-POLISH.webm')]);
await fs.writeFile(path.join(out,'media-extraction.json'),JSON.stringify({status:'PASS',source:'COMPARACION-ANTES-DESPUES.webm',clean:'SIMULACION-LIMPIA-POLISH.webm',dimensions:[540,960],crop:[570,120,540,960],captures:result.captures.map(c=>({...c,videoSeconds:result.leadSeconds+c.time})),scope:'Frames and clean video cropped from the actual recorded comparison; no generated or retouched images.'},null,2));console.log('Clean recording and timestamped evidence extracted.');
