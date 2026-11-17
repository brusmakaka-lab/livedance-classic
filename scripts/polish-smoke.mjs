import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';
const h=await harness('polish-smoke',5603,true),p=h.page,out='docs/rowshow-polish';
const tick=async(seconds,audit=false)=>p.evaluate(({seconds,audit})=>{const failures=[];for(let i=0;i<seconds*30;i++){__V05.reviewFrame(1/30);if(audit){const s=__V05.show,c=__V04.debug.scene.camera,owner=s.banner.hidden?'':s.banner.dataset.viewerId;if(owner){const a=s.actors.get(owner),b=s.screenBounds(owner,c);if(!a?.rig.root.visible||!b||b.x1<0||b.x0>1||b.y1<0||b.y0>1)failures.push({kind:'empty-announcement',owner,b});if(a?.label.hidden)failures.push({kind:'missing-label',owner});}}}return failures;},{seconds,audit});
try{
 await p.setViewportSize({width:540,height:960});await p.waitForTimeout(100);await p.evaluate(()=>__V05.reviewControl(true));
 for(let i=0;i<5;i++)await h.send('COMMENT','viewer-'+i,{username:['mila.wave','nico.groove','luna.moves','cami.sun','vale.beat'][i]});
 for(let i=0;i<200;i++){await tick(.1);if(await p.evaluate(()=>__V05.inspect().actors.length===5))break;await p.waitForTimeout(30);}
 await tick(25);console.log('group',await p.evaluate(()=>({state:__V05.inspect().showDirector,framing:__V05.framing()})));await p.locator('#stage').screenshot({path:out+'/SMOKE-GROUP.png'});
 await h.send('GIFT','viewer-1',{username:'nico.groove',giftName:'VIP',metadata:{tier:'HIGH'}});const failures=await tick(3,true);
 await p.locator('#stage').screenshot({path:out+'/SMOKE-VIP.png'});const state=await p.evaluate(()=>__V05.inspect());console.log(JSON.stringify({failures,active:state.effectiveCue,framing:await p.evaluate(()=>__V05.framing()),errors:h.errors}));
 await fs.writeFile(out+'/smoke.json',JSON.stringify({failures,state,errors:h.errors},null,2));
}finally{await h.close();}
