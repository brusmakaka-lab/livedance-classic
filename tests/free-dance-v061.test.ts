import { it, expect } from 'vitest';
import { FreeDanceDirector } from '../src/integration/free-dance';
import { integrationDefaults as config, integrationConfig } from '../src/integration/config';
import { EventBus } from '../src/domain';
import { EventIngress } from '../src/ingress';
import { normalizeTikTok } from '../connector/normalize.mjs';
import { LiveAdapter } from '../connector/adapter.mjs';
const packet=(id:string,count:number,room='900')=>normalizeTikTok('like',{common:{msgId:id,roomId:room},user:{id:'123',nickname:'Fixture'},count,total:'999999'},room);
const tick=(d:FreeDanceDirector,seconds:number,blocked=false,c=config)=>{for(let i=0;i<seconds*10;i++)d.update(.1,blocked,c);};
it('sums delivered like units, ignores provider room total and duplicate event',()=>{
 const d=new FreeDanceDirector(),bus=new EventBus(),ingress=new EventIngress(bus);bus.subscribe(e=>d.receive(e,config));
 for(const p of [packet('1',36),packet('2',64),packet('2',64)]){ingress.submit(p);ingress.drain();}
 expect(d.likes).toBe(100); expect(d.pending).toBe('single');tick(d,16);expect(d.revision).toBe(1);
});
it('500 group wins over 100; a huge batch is one cue, never 1000 animations',()=>{
 const d=new FreeDanceDirector();d.receive(packet('3',100000).event,config);tick(d,16);expect(d.groupRevision).toBe(1);expect(d.revision).toBe(0);tick(d,40);expect(d.groupRevision).toBe(1);
});
it('VIP/Fever block and expire pending work; F8 discards work while retaining counts',()=>{
 const d=new FreeDanceDirector();d.receive(packet('4',500).event,config);tick(d,31,true);expect(d.groupRevision).toBe(0);expect(d.pending).toBeUndefined();
 d.receive(packet('5',500).event,config);d.cancel();tick(d,20);expect(d.groupRevision).toBe(0);expect(d.likes).toBe(1000);
});
it('60 active seconds without highlights changes dance, highlight restarts idle, cooldown coalesces',()=>{
 const d=new FreeDanceDirector();tick(d,59);expect(d.revision).toBe(0);tick(d,2);expect(d.revision).toBe(1);tick(d,59,true);tick(d,59);expect(d.revision).toBe(1);tick(d,2);expect(d.revision).toBe(2);
 d.receive(packet('6',100).event,config);tick(d,1);expect(d.revision).toBe(2);tick(d,15);expect(d.revision).toBe(3);
});
it('settings disable all automatic changes and round-trip with older config',()=>{
 const c=integrationConfig({likeDance:false,groupDance:false,idleDance:false});const d=new FreeDanceDirector();d.receive(packet('7',500).event,c);tick(d,120,false,c);expect(d.groupRevision+d.revision).toBe(0);expect(integrationConfig({}).likeDance).toBe(true);
});
it('different rooms and Simulator never combine thresholds; returning room retains its observed count',()=>{
 const d=new FreeDanceDirector();d.receive(packet('8',90).event,config);d.receive(packet('9',20,'901').event,config);expect(d.likes).toBe(20);expect(d.pending).toBeUndefined();d.receive(packet('10',10).event,config);expect(d.likes).toBe(100);expect(d.pending).toBe('single');
});
it('adapter labels message count separately from summed units, after validation and dedup',async()=>{
 const a=new LiveAdapter();a.roomId='900';const raw={common:{msgId:'20',roomId:'900'},user:{id:'123',nickname:'Fixture'},count:36,total:'8000'};
 try{a.receive('like',raw);a.receive('like',raw);a.receive('like',{...raw,common:{...raw.common,msgId:'21'},count:64});expect(a.counts.like).toBe(2);expect(a.counts.likeUnits).toBe(100);expect(a.counts.duplicate).toBe(1);}finally{await a.dispose();}
});
