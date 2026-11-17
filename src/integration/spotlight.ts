import type { LiveEvent } from '../domain';
import type { Cue } from './cast';
type Welcome = { id: string; name: string; waited: number; cue: Cue };
/** Visual scheduling only. Never changes contributions, likes, VIP or audio. */
export class ArrivalSpotlight {
  readonly duration = 5;
  readonly capacity = 12;
  readonly maxWait = 75;
  readonly maxPriorityHold = 12;
  known = new Set<string>();
  queue: Welcome[] = [];
  active?: Welcome;
  visible?: Cue;
  blockedFor = 0;
  forceTurn = false;
  started = 0; completed = 0; expired = 0; overflow = 0;
  startedId?: string;
  observe(e: LiveEvent) {
    if (!['VIEWER_JOIN','COMMENT','FOLLOW','GIFT','LIKE_MILESTONE'].includes(e.eventType)) return false;
    const key = `${e.source}:${e.sessionId || 'local'}:${e.viewerId}`;
    if (this.known.has(key)) return false;
    this.known.add(key);
    // Bound identity memory to the same scale as event deduplication.
    if (this.known.size > 4096) this.known.delete(this.known.values().next().value!);
    if (this.active?.id === e.viewerId || this.queue.some(w => w.id === e.viewerId)) return false;
    if (this.queue.length >= this.capacity) { this.overflow++; return true; }
    this.queue.push({id:e.viewerId,name:e.username,waited:0,
      cue:{kind:'welcome',id:e.viewerId,name:e.username,gift:'',age:0,duration:this.duration,priority:1}});
    return true;
  }
  update(dt: number, registered: Set<string>, ready: Set<string>, priority: boolean) {
    const step = Math.max(0, Math.min(.25, dt));
    this.startedId = undefined; this.visible = undefined;
    for (const w of this.queue) w.waited += step;
    this.queue = this.queue.filter(w => {if(w.waited <= this.maxWait)return true;this.expired++;return false;});
    if(this.active && !registered.has(this.active.id)){this.active=undefined;this.forceTurn=false;}
    const waiting = !!this.active || this.queue.some(w=>ready.has(w.id));
    this.blockedFor = priority && waiting ? this.blockedFor + step : 0;
    if(this.blockedFor >= this.maxPriorityHold) this.forceTurn = true;
    if(priority && !this.forceTurn) return undefined;
    if(!this.active){
      const index=this.queue.findIndex(w=>ready.has(w.id));
      if(index<0)return undefined;
      this.active=this.queue.splice(index,1)[0];this.started++;this.startedId=this.active.id;
    }
    if(!ready.has(this.active.id))return undefined;
    this.active.cue.age += step;
    if(this.active.cue.age >= this.duration){this.completed++;this.active=undefined;this.forceTurn=false;this.blockedFor=0;return undefined;}
    return this.visible=this.active.cue;
  }
  pause(){this.queue=[];this.active=undefined;this.visible=undefined;this.blockedFor=0;this.forceTurn=false;}
  reset(){this.pause();this.known.clear();this.started=this.completed=this.expired=this.overflow=0;}
  inspect(){return {active:this.visible,queued:this.queue.map(w=>({id:w.id,waited:w.waited})),started:this.started,completed:this.completed,expired:this.expired,overflow:this.overflow,blockedFor:this.blockedFor,duration:this.duration,maxWait:this.maxWait};}
}
