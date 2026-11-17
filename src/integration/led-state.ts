import type { LiveEvent } from '../domain';
export class LEDState {
  follow?: {name:string;source:string};
  gift?: {name:string;gift:string;source:string};
  revision=0;
  receive(e:LiveEvent) {
    const clean=(v:string)=>String(v||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,64);
    const source=e.source==='tiktok'?'LIVE':'SIMULATOR';
    if(e.eventType==='FOLLOW')this.follow={name:clean(e.username),source};
    else if(e.eventType==='GIFT')this.gift={name:clean(e.username),gift:clean(e.giftName||'Regalo')+' ×'+e.giftCount,source};
    else return;
    this.revision++;
  }
  reset(){this.follow=undefined;this.gift=undefined;this.revision++;}
}
