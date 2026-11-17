import {it,expect} from 'vitest';
import {ProceduralAvatar} from '../src/avatars';
import {World,defaults,type Dancer} from '../src/domain';
import {dances} from '../src/presentation';
import {validateEntertainment,HypeMeter} from '../src/entertainment';
import {SlideDirector} from '../src/slides';
function dancer():Dancer {
 const w=new World({...defaults});
 w.bus.emit({schemaVersion:1,eventId:'a',viewerId:'a',username:'A',source:'simulator',eventType:'VIEWER_JOIN',giftCount:1,timestamp:1,metadata:{}});
 for(let i=0;i<200;i++)w.update(.05);
 return {...w.spawn.dancers.get('a')!,state:'DANCING',animationState:'Groove',effectState:[]};
}
it('procedural catalog produces sixteen distinct finite moving poses',()=>{
 const d=dancer(),signatures=[];
 for(const name of dances){const a=new ProceduralAvatar('a');a.danceOverride=name;for(let i=1;i<=30;i++)a.update(d,i/30,1/30);const before=a.pose.slice();a.update(d,1.1,.1);expect(a.pose.every(Number.isFinite)).toBe(true);expect(a.pose).not.toEqual(before);signatures.push(a.pose.map(n=>n.toFixed(3)).join(','));a.dispose();}
 expect(new Set(signatures).size).toBe(16);
});
it('reaction blends back to underlying dance instead of freezing',()=>{
 const d=dancer(),a=new ProceduralAvatar('a'),b=new ProceduralAvatar('a');a.reaction={kind:'HEART',start:0,end:1};
 for(let i=1;i<=90;i++){a.update(d,i/30,1/30);b.update(d,i/30,1/30);}
 expect(Math.max(...a.pose.map((v,i)=>Math.abs(v-b.pose[i])))).toBeLessThan(.001);a.dispose();b.dispose();
});
it('persisted config validates thresholds, Fever and invalid numeric values',()=>{
 const c=validateEntertainment({feverDuration:900,cooldown:0,grooveThreshold:90,hypeThreshold:2,hypePlusThreshold:1,nameSize:NaN});
 expect(c.feverDuration).toBe(30);expect(c.cooldown).toBe(10);expect(c.hypeThreshold).toBe(91);expect(c.hypePlusThreshold).toBe(92);expect(c.nameSize).toBe(1);
 const h=new HypeMeter(c);h.add(91,1);expect(h.getState(1)).toBe('HYPE');
});
it('LOW for the same viewer cannot replace an active VIP slide',()=>{
 const s=new SlideDirector();s.show({key:'a',priority:5,title:'VIP',subtitle:'',duration:4},0);s.show({key:'a',priority:1,title:'LOW',subtitle:'',duration:4},1);expect(s.active?.title).toBe('VIP');expect(s.queue).toHaveLength(1);s.update(5);expect(s.active?.title).toBe('LOW');
});
