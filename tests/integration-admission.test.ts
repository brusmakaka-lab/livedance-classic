import { LEDState } from "../src/integration/led-state";
import { FreeDanceDirector } from "../src/integration/free-dance";
import { ShowDirector } from '../src/integration/show-director';
import { it, expect, vi } from "vitest";
import { IntegrationShow } from "../src/integration/show";
it('changing legacy presentation settings while paused cannot replace the director cast',()=>{
  const visible=['a','b','c','d','e'],adapter={config:{enabled:true},cast:{visible},paused:true,ready:true,freeDance:{cancel:vi.fn()},world:{spawn:{retainParticipants:false},bus:{error:vi.fn()}},syncClass:vi.fn()};
  IntegrationShow.prototype.configure.call(adapter as any,{featured:30,lineup:false,backgroundNames:'COMPACT'});
  expect(adapter.cast.visible).toBe(visible);expect(adapter.cast.visible).toHaveLength(5);
});
it("skin preview cannot replace an active viewer event", async () => {
  const remove=vi.fn(), adapter={director:{active:{kind:"vip"}},remove,previewId:undefined};
  await expect(IntegrationShow.prototype.preview.call(adapter as any,"skin")).rejects.toThrow("prioridad");
  expect(remove).not.toHaveBeenCalled();expect(adapter.previewId).toBeUndefined();
});
it('skin preview cannot replace a new arrival welcome', async()=>{
  const remove=vi.fn(), adapter={director:{active:{kind:'welcome'}},remove};
  await expect(IntegrationShow.prototype.preview.call(adapter as any,'skin')).rejects.toThrow('prioridad');
  expect(remove).not.toHaveBeenCalled();
});
it("pending unknown viewers cannot block a visual event for a loaded participant", () => {
  const adapter = {
    director: new ShowDirector(),
    ledState: new LEDState(), freeDance: new FreeDanceDirector(), config: { enabled: true },
    paused: false,
    actors: new Map([["known", {}]]),
    world: { now: 0 },
  };
  const e = {
    schemaVersion:1,source:'simulator',eventId:'loaded-vip',username:'Known',giftCount:1,timestamp:0,
    eventType: "GIFT",
    viewerId: "known",
    metadata: { tier: "HIGH" },
  };
  for(let i=0;i<adapter.director.capacity;i++)adapter.director.receive({...e,eventId:'pending-'+i,viewerId:'unknown-'+i,metadata:{tier:'LOW'}} as any);
  IntegrationShow.prototype.receive.call(adapter as any, e as any);
  adapter.director.update(.016,new Set(['known']),new Set(['known']));
  expect(adapter.director.active?.id).toBe('known');
  expect(adapter.director.queue).toHaveLength(adapter.director.capacity-1);
  expect(adapter.director.dropped).toBe(1);
  expect(adapter.director.log.some(l=>l.reason==='Replaced by higher priority')).toBe(true);
});
