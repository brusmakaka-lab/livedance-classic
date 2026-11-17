import {installAudit} from './showdirector-audit.mjs';
// Reuse the identity, camera, animation and model checks; replace the old
// unconditional five-cast assumption with explicit slot ownership.
export async function installRotationAudit(page){
 await installAudit(page);
 await page.evaluate(()=>{
  const original=window.checkDirector.toString()
   .replace("if(visible.length>5||(s.actors.length>=5&&visible.length!==5))fail('Visible actor capacity');", "const slots=d.rotation.slots.filter(slot=>slot.id&&s.actors.some(actor=>actor.id===slot.id));if(visible.length!==slots.length||visible.length>d.rotation.capacity)fail('Visible slot capacity');if(new Set(visible.map(a=>a.id)).size!==visible.length)fail('Duplicate actor identity');for(const slot of slots){if(!visible.some(a=>a.id===slot.id&&a.slot===slot.slot))fail('Slot identity mismatch');}")
   .replace('old.slot===visible.indexOf(actor)','old.slot===actor.slot')
   .replace('slot:i','slot:x.slot');
  window.checkDirector=(0,eval)('('+original+')');
 });
}
