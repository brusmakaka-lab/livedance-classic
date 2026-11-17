import {harness} from './v05-harness.mjs';
const h=await harness('entrance-preview');
try{
 await h.page.evaluate(()=>__V05.configure({idleDance:false,likeDance:false,groupDance:false}));await h.fill(10);
 await h.page.evaluate(()=>__V05.reviewControl(true));
 await h.send('FOLLOW','viewer-8',{username:'Valentina'});
 for(const seconds of [.3,.7,1,1,1.3,4]){
  await h.page.evaluate(s=>{for(let i=0;i<s*60;i++)__V05.reviewFrame(1/60);},seconds);
  console.log(await h.page.evaluate(()=>({event:__V05.inspect().event,framing:__V05.framing().find(p=>p.id==='viewer-8')})));
  await h.page.screenshot({path:'docs/v065/evidence/preview-'+seconds+'.png'});
 }
}finally{await h.close();}
