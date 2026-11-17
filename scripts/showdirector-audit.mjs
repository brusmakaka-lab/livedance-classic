export async function installAudit(page){await page.evaluate(()=>{
 window.sdAudit={frames:0,failures:[],shots:{},maxTravel:0,maxAngle:0,animations:{},skins:{},previous:null,tag:'initial',bodySamples:0};
 window.checkDirector=function(dt=1/60){
  const a=sdAudit,s=__V05.inspect(),d=s.showDirector,e=d.active,show=__V05.show,visible=s.actors.filter(x=>x.visible),banner=show.banner;
  const fail=message=>{if(a.failures.length<40)a.failures.push({frame:a.frames,tag:a.tag,message,cue:e?.presentationId});};
  a.frames++;a.shots[d.shot]=(a.shots[d.shot]||0)+1;
  if([e,...d.queue,...d.history].filter(p=>p?.state==='active').length>(e?1:0))fail('Multiple active presentations');
  if(visible.length>5||(s.actors.length>=5&&visible.length!==5))fail('Visible actor capacity');
  for(const actor of s.actors){if(a.skins[actor.id]&&a.skins[actor.id]!==actor.skinId)fail('Skin identity changed');a.skins[actor.id]=actor.skinId;}
  for(const actor of visible){if(actor.scale!==1)fail('Miniature');const old=a.previous?.actors[actor.id];
   if(old&&old.slot===visible.indexOf(actor)&&Math.hypot(...actor.position.map((x,i)=>x-old.position[i]))>.001)fail('Actor moved to simulate camera');
   if(old&&actor.danceTime!==old.danceTime)a.animations[actor.id]=(a.animations[actor.id]||0)+1;
  }
  if(e){
   if(e.activations!==1||e.state!=='active')fail('Invalid activation');
   if(banner.hidden||Number(banner.style.opacity)<.99||banner.dataset.presentationId!==e.presentationId||banner.dataset.viewerId!==e.id)fail('Principal label missing or wrong ID');
   const title=banner.querySelector('strong')?.cloneNode(true);title?.querySelector('.name-avatar')?.remove();
   if(title?.textContent!==e.name)fail('Principal text mismatch');
   if(e.id&&!visible.some(x=>x.id===e.id))fail('Principal actor absent');
   if(Math.abs(banner.offsetTop/show.container.clientHeight-.12)>.003)fail('Principal name moved on screen');
   if(e.kind==='vip'){
    const owner=visible.find(x=>x.id===e.id),stage=show.stage;
    if(stage.halo.userData.viewerId!==e.id||stage.crown.userData.viewerId!==e.id||!owner)fail('VIP ID binding');
    else if(stage.crown.position.toArray().some((x,i)=>Math.abs(x-owner.position[i])>1e-7))fail('VIP effects detached');
   }
   if(e.id&&e.age>3&&a.frames%30===0){const f=__V05.framing().find(x=>x.id===e.id);a.bodySamples++;if(!f||f.x0<-.02||f.x1>1.02||f.y0<.15||f.y1>.92)fail('Principal model cropped after camera transition');}
  }else if(!banner.hidden)fail('Stale principal label');
  for(const [id,actor]of show.actors){if(actor.label.hidden)continue;const l=actor.label;if(l.dataset.viewerId!==id)fail('Secondary name identity');if(id===e?.id)fail('Duplicated main label');if(!Number.isFinite(parseFloat(l.style.left)+parseFloat(l.style.top)))fail('Invalid name projection');}
  if(a.previous){const travel=Math.hypot(...s.camera.position.map((x,i)=>x-a.previous.camera.position[i])),dot=Math.abs(s.camera.quaternion.reduce((sum,x,i)=>sum+x*a.previous.camera.quaternion[i],0)),angle=2*Math.acos(Math.min(1,dot));a.maxTravel=Math.max(a.maxTravel,travel);a.maxAngle=Math.max(a.maxAngle,angle);if(travel>9*Math.min(.1,dt)+.002)fail('Camera position jump');if(angle>.85*Math.min(.1,dt)+.0001)fail('Camera rotation jump');}
  a.previous={camera:s.camera,actors:Object.fromEntries(visible.map((x,i)=>[x.id,{...x,slot:i}]))};
 };
});}
