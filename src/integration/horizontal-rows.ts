import {GroupRotation, type Occupancy} from './group-rotation';
import type {LiveEvent} from '../domain';

/** Permanent logical seats. GPU retirement never releases a seat or identity. */
export class HorizontalRows extends GroupRotation {
  override capacity=20;
  private seats:string[]=[];
  retired=new Set<string>();
  fading=new Map<string,number>();
  budget=60;
  batch:5|10=5;
  override snapshot():Occupancy{return this.seats.map((id,slot)=>({slot,id,name:this.participants.get(id)?.name||id}));}
  override observe(e:LiveEvent,time:number){
    if(e.eventType==='SIMULATED'||!e.viewerId)return;
    super.observe(e,time);
    const p=this.participants.get(e.viewerId)!;
    if(p.slot===null){p.slot=this.seats.length;p.visibleOrder=p.joinedOrder;this.seats.push(p.id);}
  }
  override configure(_capacity:number,_protected:Set<string>,_time:number){}
  override sync(registered:Set<string>,vip:Set<string>,active:any,queue:any[],_time:number){
    for(const p of this.participants.values()){
      p.registered=registered.has(p.id);p.everRegistered ||= p.registered;
      p.vip=vip.has(p.id)||active?.id===p.id&&active.kind==='vip'||queue.some(q=>q.id===p.id&&q.kind==='vip');
    }
  }
  override canAdmit(id:string,_protected:Set<string>){return this.participants.has(id);}
  override admit(id:string,_protected:Set<string>,_time:number,_eventId?:string,_reason?:string){
    if(!this.participants.has(id))return false;
    this.retired.delete(id);this.fading.delete(id);return true;
  }
  override refill(_ready:Set<string>,_protected:Set<string>,_time:number){}
  override next(_ready:Set<string>,_protected:Set<string>,_time:number){}
  override visible(ready:Set<string>){return this.seats.filter(id=>ready.has(id)&&!this.retired.has(id));}
  wants(id:string){return this.participants.has(id)&&!this.retired.has(id);}
  opacity(id:string,time:number){const start=this.fading.get(id);return start===undefined?1:Math.max(0,1-(time-start)/1.5);}
  trim(loaded:Set<string>,protectedIds:Set<string>,time:number){
    for(const [id,start] of this.fading){
      if(protectedIds.has(id)){this.fading.delete(id);continue;}
      if(time-start>=1.5){this.fading.delete(id);this.retired.add(id);}
    }
    // One full batch at a time, with hysteresis; never one eviction per arrival.
    if(this.fading.size||[...loaded].filter(id=>this.wants(id)).length<=this.budget)return;
    const candidates=[...this.participants.values()].filter(p=>loaded.has(p.id)&&this.wants(p.id)&&!protectedIds.has(p.id)).sort((a,b)=>a.visibleOrder-b.visibleOrder);
    if(candidates.length<this.batch)return;
    const before=this.snapshot();
    for(const p of candidates.slice(0,this.batch))this.fading.set(p.id,time);
    this.log.push({sequence:this.log.length+1,time,action:'gpu-retire-batch',reason:String(this.batch),before,after:this.snapshot()});
    if(this.log.length>4096)this.log.shift();
  }
  override reset(){super.reset();this.seats=[];this.retired.clear();this.fading.clear();}
  override inspect(){return {...super.inspect(),rowSize:20,budget:this.budget,batch:this.batch,retired:[...this.retired],fading:[...this.fading.keys()]};}
}
