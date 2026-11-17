export function safeProfilePhoto(value: unknown): string | undefined {
  if(typeof value!=='string'||value.length>2048)return;
  try {
    const u=new URL(value), allowed=['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','byteoversea.com','ibytedtos.com'];
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return;
    if(allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return u.href;
  }catch{}
}
type Entry={promise:Promise<string|undefined>;expires:number};
/** Bounded cache, failed-image cooldown and at most four concurrent requests. */
export class ProfilePhotoCache {
  entries=new Map<string,Entry>();
  private tasks:(()=>void)[]=[];
  private running=0;
  private bindings=new WeakMap<HTMLElement,string>();
  get(value:unknown):Promise<string|undefined>{
    const url=safeProfilePhoto(value);if(!url)return Promise.resolve(undefined);
    const found=this.entries.get(url);if(found&&found.expires>Date.now())return found.promise;
    if(this.entries.size>=64){const key=[...this.entries].find(([,e])=>e.expires!==Infinity)?.[0];if(key)this.entries.delete(key);else return Promise.resolve(undefined);}
    const entry={} as Entry;entry.expires=Infinity;
    entry.promise=new Promise(resolve=>{
      this.tasks.push(()=>{
        this.running++;
        const img=new Image();img.referrerPolicy='no-referrer';img.decoding='async';
        const done=(ok:boolean)=>{clearTimeout(timer);img.onload=img.onerror=null;entry.expires=Date.now()+(ok?300000:30000);this.running--;resolve(ok?url:undefined);this.pump();};
        const timer=setTimeout(()=>{img.onload=img.onerror=null;img.src='';done(false);},4000);
        img.onload=()=>done(true);img.onerror=()=>done(false);img.src=url;
      });
    });
    this.entries.set(url,entry);this.pump();return entry.promise;
  }
  private pump(){while(this.running<4&&this.tasks.length)this.tasks.shift()!();}
  bind(label:HTMLElement,url:unknown,enabled:boolean,name:string){
    const key=`${enabled}:${safeProfilePhoto(url)||''}:${name.slice(0,1)}`;
    if(this.bindings.get(label)===key&&(!enabled||label.querySelector('.name-avatar')))return;
    this.bindings.set(label,key);
    label.querySelector('.name-avatar')?.remove();
    if(!enabled)return;
    const badge=document.createElement('span');badge.className='name-avatar';badge.textContent=Array.from(name)[0]||'?';badge.setAttribute('aria-hidden','true');label.prepend(badge);
    void this.get(url).then(src=>{
      if(!src||this.bindings.get(label)!==key)return;
      const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';
      img.onerror=()=>{if(this.bindings.get(label)===key)badge.textContent=Array.from(name)[0]||'?';};
      img.src=src;badge.replaceChildren(img);
    });
  }
}
