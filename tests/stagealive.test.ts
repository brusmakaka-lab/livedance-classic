import {it,expect,vi,afterEach} from 'vitest';
import {ArrivalSpotlight} from '../src/integration/spotlight';
import {placeNames} from '../src/integration/name-layout';
import {settledPlacement,lineupPlacement} from '../src/integration/lineup';
import {safeProfilePhoto,ProfilePhotoCache} from '../src/integration/profile-photo';
import {normalizeTikTok} from '../connector/normalize.mjs';
import {normalizeEvent,type LiveEvent} from '../src/domain';
const event=(id:string,type:LiveEvent['eventType']='VIEWER_JOIN')=>({schemaVersion:1,source:'simulator',viewerId:id,username:id,eventId:Math.random().toString(),eventType:type,giftCount:1,timestamp:1,metadata:{}} as LiveEvent);
const step=(s:ArrivalSpotlight,n:number,ids:string[],priority=false)=>{let c;for(let i=0;i<n;i++)c=s.update(.1,new Set(ids),new Set(ids),priority);return c;};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('first identifiable activity gets one welcome; repeated likes and nicknames cannot extend it',()=>{
 const s=new ArrivalSpotlight();expect(s.observe(event('a','LIKE_MILESTONE'))).toBe(true);
 expect(step(s,10,['a'])?.id).toBe('a');
 for(let i=0;i<100;i++)expect(s.observe({...event('a','LIKE_MILESTONE'),username:'changed'})).toBe(false);
 step(s,41,['a']);expect(s.visible).toBeUndefined();expect(s.started).toBe(1);expect(s.completed).toBe(1);
});
it('simultaneous arrivals are FIFO when ready, five seconds each, no duplicate viewer',()=>{
 const s=new ArrivalSpotlight();['a','b','c'].forEach(id=>s.observe(event(id)));s.observe(event('a','COMMENT'));
 const seen=new Set<string>();for(let i=0;i<160;i++){const c=s.update(.1,new Set(['a','b','c']),new Set(['a','b','c']),false);if(c)seen.add(c.id);}
 expect([...seen]).toEqual(['a','b','c']);expect(s.completed).toBe(3);
});
it('loading a missing skin does not block other ready arrivals',()=>{
 const s=new ArrivalSpotlight();s.observe(event('missing'));s.observe(event('ready'));
 expect(s.update(.1,new Set(['missing','ready']),new Set(['ready']),false)?.id).toBe('ready');
});
it('VIP/gifts defer and pause welcome, but a continuous priority flood has a finite hold',()=>{
 const s=new ArrivalSpotlight();s.observe(event('a'));expect(step(s,10,['a'],true)).toBeUndefined();
 expect(step(s,111,['a'],true)?.id).toBe('a');expect(s.forceTurn).toBe(true);
 step(s,50,['a'],true);expect(s.completed).toBe(1);
 const t=new ArrivalSpotlight();t.observe(event('a'));step(t,20,['a']);const age=t.active!.cue.age;
 step(t,10,['a'],true);expect(t.active!.cue.age).toBe(age);expect(t.visible).toBeUndefined();
});
it('queue capacity, expiration, removed actors and F8 cannot create permanent locks',()=>{
 const s=new ArrivalSpotlight();for(let i=0;i<20;i++)s.observe(event('v'+i));expect(s.queue.length).toBe(12);expect(s.overflow).toBe(8);
 step(s,751,[]);expect(s.queue.length).toBe(0);expect(s.expired).toBe(12);
 s.observe(event('a'));step(s,1,['a']);s.update(.1,new Set(),new Set(),false);expect(s.active).toBeUndefined();
 s.observe(event('b'));s.pause();expect(s.queue).toHaveLength(0);expect(s.observe(event('b'))).toBe(false);
 s.reset();expect(s.observe(event('b'))).toBe(true);
});
it('neutral stage positions return every dancer behind the reserved foreground without collisions',()=>{
 const points=Array.from({length:5},(_,i)=>settledPlacement(i));expect(points.every(p=>p.z<0)).toBe(true);
 expect(new Set(points.map(p=>p.toArray().join(','))).size).toBe(5);expect(lineupPlacement(0).z).toBe(0);
});
it.each([[365,648],[540,960],[1080,1920]])('protagonist label wins collisions at %sx%s', (w,h)=>{
 const names=Array.from({length:12},(_,i)=>({id:String(i),x:w*.5,y:h*.46,width:w*.3,height:w*.06,priority:i===11?10:0}));
 const placed=placeNames(names,w,h,.235);expect(placed[0].id).toBe('11');
 for(const [i,a]of placed.entries()){expect(a.y-a.height).toBeGreaterThanOrEqual(h*.235);for(const b of placed.slice(i+1))expect(Math.abs(a.x-b.x)>=(a.width+b.width)/2||a.y<=b.y-b.height||b.y<=a.y-a.height).toBe(true);}
});
it('optional avatars use validated CDN HTTPS, reject local URLs and retain safe identity',()=>{
 const good='https://p16.tiktokcdn.com/avatar.png';expect(safeProfilePhoto(good)).toBe(good);
 for(const value of ['http://p16.tiktokcdn.com/a','https://localhost/a','https://tiktokcdn.com.evil.test/a','https://user:pass@p16.tiktokcdn.com/a','data:image/png,test','https://p16.tiktokcdn.com:444/a'])expect(safeProfilePhoto(value)).toBeUndefined();
 const raw={common:{msgId:'1'},user:{id:'123',nickname:'Luna',avatarThumb:{urlList:[good]}}};
 const e=normalizeTikTok('member',raw,'900').event;expect(normalizeEvent(e).avatarUrl).toBe(good);
 expect(()=>normalizeTikTok('member',{...raw,user:{...raw.user,avatarThumb:{urlList:42}}},'900')).not.toThrow();
});
it('photo cache coalesces pending requests, limits concurrency and caches failures',async()=>{
 const images:any[]=[];class ImageStub{onload:any;onerror:any;src='';constructor(){images.push(this);}}
 vi.stubGlobal('Image',ImageStub);
 const c=new ProfilePhotoCache(),url='https://p16.tiktokcdn.com/a';const p=c.get(url);expect(c.get(url)).toBe(p);
 for(let i=0;i<5;i++)void c.get(url+i);expect(images).toHaveLength(4);
 images[0].onerror();expect(await p).toBeUndefined();expect(images).toHaveLength(5);expect(c.get(url)).toBe(p);
 for(let i=1;i<images.length;i++)images[i].onerror?.();
});
