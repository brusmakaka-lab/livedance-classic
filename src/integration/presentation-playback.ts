import type {Player} from './player';
/** Animation memory is independent of camera targets and scheduling ticks. */
export class PresentationPlayback {
  current=new Map<string,string>();
  records=new Map<string,{clip:string;time:number;starts:number}>();
  apply(id:string,player:Player,clip:string,presentationId?:string){
    const key=JSON.stringify([id,presentationId||'dance',clip]),previous=this.current.get(id);
    if(previous!==key){
      if(previous){const old=this.records.get(previous);if(old)old.time=player.actions[player.state].time;}
      const saved=this.records.get(key);
      if(saved){player.set(clip);player.actions[clip].time=saved.time;player.mixer.update(0);}
      else{player.set(clip,false,!!presentationId);this.records.set(key,{clip,time:0,starts:1});}
      this.current.set(id,key);
      if(this.records.size>2048){const inactive=[...this.records.keys()].find(k=>![...this.current.values()].includes(k));if(inactive)this.records.delete(inactive);}
    }
  }
  remove(id:string){this.current.delete(id);for(const key of this.records.keys())if(JSON.parse(key)[0]===id)this.records.delete(key);}
  reset(){this.current.clear();this.records.clear();}
  inspect(){return [...this.records].map(([key,value])=>({key,...value}));}
}
