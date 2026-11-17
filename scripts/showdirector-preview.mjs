import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
const h=await harness('showdirector-preview',5562,true),p=h.page,out='docs/showdirector';
const tick=n=>p.evaluate(n=>{for(let i=0;i<n;i++)__V05.reviewFrame(1/60);},n);
async function capture(name){await p.evaluate(()=>{__V05.reviewControl(false);document.querySelector('#toast').hidden=true;});await p.waitForTimeout(100);await p.locator('#stage').screenshot({path:out+'/'+name+'.png'});await p.evaluate(()=>__V05.reviewControl(true));}
try{
 await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});});
 for(let i=0;i<5;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:['Río','Luna','Sol','Nova','Álex'][i]});
 for(let i=0;i<80;i++){await tick(6);if(await p.evaluate(()=>__V05.inspect().actors.length===5))break;await p.waitForTimeout(50);}
 await tick(180);await capture('HERO-first');await tick(1600);await capture('WIDE');
 await h.send('GIFT','viewer-4',{username:'Álex',metadata:{tier:'HIGH'},giftName:'VIP'});await tick(240);await capture('VIP-rear');
 await tick(360);await h.send('SIMULATED','viewer-0',{username:'Río',giftId:'fever-demo'});await tick(240);await capture('FEVER');
 await fs.writeFile(out+'/preview.json',JSON.stringify({state:await p.evaluate(()=>__V05.inspect()),errors:h.errors},null,2));console.log(h.errors);
}finally{await h.close();}
