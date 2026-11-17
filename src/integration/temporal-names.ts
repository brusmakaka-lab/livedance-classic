import type {NameCandidate} from './name-layout';
type Memory={offset:number;target:number};
/** Identity-owned correction only; the projected anchor follows the model directly.
 * No per-frame body-avoidance search, no reassigning a label to another slot. */
export class TemporalNames {
  private memory=new Map<string,Memory>();
  forget(id:string){this.memory.delete(id);}
  clear(){this.memory.clear();}
  place(candidates:NameCandidate[],width:number,height:number,dt:number,top=.235){
    const scale=width/365,limit=22*scale,gap=3*scale,placed:NameCandidate[]=[];
    for(const c of [...candidates].sort((a,b)=>(b.priority||0)-(a.priority||0)||a.id.localeCompare(b.id))){
      if(!Number.isFinite(c.x+c.y+c.width+c.height))continue;
      const x=Math.max(width*.04+c.width/2,Math.min(width*.96-c.width/2,c.x));
      const lower=Math.max(height*top+c.height,c.y-limit),upper=Math.min(height*.84,c.y+limit);
      // A visible body at the frame edge still has a readable caption; do not drop it.
      const clamp=(y:number)=>Math.max(lower,Math.min(Math.max(lower,upper),y));
      const old=this.memory.get(c.id);
      const overlap=(y:number)=>placed.reduce((sum,p)=>sum+
        Math.max(0,Math.min(x+c.width/2,p.x+p.width/2)-Math.max(x-c.width/2,p.x-p.width/2)+gap)*
        Math.max(0,Math.min(y,p.y)-Math.max(y-c.height,p.y-p.height)+gap),0);
      const neutral=clamp(c.y);
      const hold=clamp(c.y+(old?.target||0)*scale);
      const options=[hold,clamp(c.y),lower,upper,...placed.flatMap(p=>[p.y-p.height-gap,p.y+c.height+gap])]
        .filter(y=>y>=lower&&y<=upper);
      // Keep an existing lane while it fits. Only resolve an actual collision.
      const target=overlap(neutral)<.01 ? neutral : options.sort((a,b)=>
        overlap(a)-overlap(b)||Math.abs(a-neutral)-Math.abs(b-neutral))[0]??hold;
      const desired=(target-c.y)/scale;
      const maxStep=55*Math.max(0,Math.min(.1,dt));
      const offset=old ? old.offset+Math.max(-maxStep,Math.min(maxStep,desired-old.offset)) : desired;
      this.memory.set(c.id,{offset,target:desired});
      placed.push({...c,x,y:clamp(c.y+offset*scale)});
    }
    return placed;
  }
}
