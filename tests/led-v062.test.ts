import {it,expect} from 'vitest';
import {LEDState} from '../src/integration/led-state';
import {EventBus} from '../src/domain';
import {EventIngress} from '../src/ingress';
import {integrationConfig} from '../src/integration/config';
it('LED follows delivered events, preserves source, ignores duplicates and F8 rejects new events',()=>{
 const s=new LEDState(),bus=new EventBus(),ingress=new EventIngress(bus);bus.subscribe(e=>s.receive(e));
 const e={schemaVersion:1,source:'tiktok',eventId:'one',viewerId:'v',username:'Río',eventType:'FOLLOW',giftCount:1,timestamp:Date.now(),metadata:{}};
 ingress.submit(e);ingress.drain();expect(s.follow).toEqual({name:'Río',source:'LIVE'});const revision=s.revision;ingress.submit(e);ingress.drain();expect(s.revision).toBe(revision);
 ingress.submit({...e,source:'simulator',eventId:'two',eventType:'GIFT',giftName:'Rose',giftCount:5});ingress.drain();expect(s.gift).toEqual({name:'Río',source:'SIMULATOR',gift:'Rose ×5'});
 ingress.pause();ingress.submit({...e,eventId:'blocked',username:'Blocked'});ingress.drain();expect(s.follow?.name).toBe('Río');ingress.resume();ingress.submit({...e,eventId:'recovery',username:'Recovered'});ingress.drain();expect(s.follow?.name).toBe('Recovered');
 s.reset();expect(s.follow).toBeUndefined();expect(s.gift).toBeUndefined();
});
it('old settings enable LEDs; explicit OFF is preserved',()=>{expect(integrationConfig({}).ledWall).toBe(true);expect(integrationConfig({ledWall:false}).ledWall).toBe(false);});
