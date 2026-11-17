import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const text=(x,n)=>typeof x==='string'?x.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,n):'';
export class SkinFolder {
 constructor(root,store,stateFile){this.root=path.resolve(root);this.store=store;this.stateFile=stateFile;this.config={enabled:false,authorized:false,author:'',source:'',license:'',normalizeAlpha:false};this.seen={};this.results=[];this.busy=null;this.error='';this.lastScan=null;this.tail=Promise.resolve();}
 async init(){
  for(const d of ['', 'classic','slim']){
   const dir=path.join(this.root,d);
   try{const st=await fs.lstat(dir);if(st.isSymbolicLink()||!st.isDirectory())throw Error('La carpeta de skins no puede ser un enlace');}
   catch(e){if(e.code!=='ENOENT')throw e;await fs.mkdir(dir,{recursive:true});}
  }
  try{const state=JSON.parse(await fs.readFile(this.stateFile,'utf8'));this.config=this.validate(state.config);this.seen=state.seen&&typeof state.seen==='object'&&!Array.isArray(state.seen)?state.seen:{};}
  catch(e){if(e.code!=='ENOENT')this.error='Configuración de carpeta inválida; importación automática desactivada. Revisá y guardá los datos.';}
  return this.status();
 }
 validate(raw={}){
  const c={enabled:raw.enabled===true,authorized:raw.authorized===true,normalizeAlpha:raw.normalizeAlpha===true,author:text(raw.author,96),source:text(raw.source,256),license:text(raw.license,256)};
  if((c.enabled||c.authorized)&&(!c.authorized||!c.author||!c.source||!c.license))throw Error('Completá autor, procedencia y permiso del lote y confirmá autorización.');
  return c;
 }
 async save(){await fs.mkdir(path.dirname(this.stateFile),{recursive:true});await fs.writeFile(this.stateFile+'.tmp',JSON.stringify({version:1,config:this.config,seen:this.seen},null,2));await fs.rename(this.stateFile+'.tmp',this.stateFile);}
 serialize(fn){const task=this.tail.then(fn);this.tail=task.catch(()=>{});return task;}
 configure(raw){return this.serialize(async()=>{const next=this.validate(raw),previous=this.config;this.config=next;try{await this.save();}catch(e){this.config=previous;throw e;}this.error='';return this.status();});}
 status(){return{path:this.root,config:this.config,busy:!!this.busy,lastScan:this.lastScan,error:this.error,results:this.results,limit:200,intervalSeconds:10};}
 start(){this.timer=setInterval(()=>{if(this.config.enabled)void this.scan().catch(e=>{this.error=String(e);});},10000);this.timer.unref();if(this.config.enabled)void this.scan().catch(e=>{this.error=String(e);});}
 stop(){clearInterval(this.timer);}
 scan(retry=false){if(this.busy)return this.busy;this.busy=this.serialize(()=>this.run(retry)).finally(()=>{this.busy=null;});return this.busy;}
 async run(retry){
  if(!this.config.authorized)throw Error('Configurá la procedencia y autorización del lote primero.');
  this.error='';this.results=[];const nextSeen={};let count=0;
  const rootStat=await fs.lstat(this.root);if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw Error('La carpeta de entrada debe ser una carpeta local, no un enlace.');
  const rootReal=await fs.realpath(this.root);
  for(const sub of ['', 'classic','slim']){
   const dir=path.join(this.root,sub),stat=await fs.lstat(dir);
   if(stat.isSymbolicLink()||!stat.isDirectory()){this.results.push({file:sub,status:'rechazado',message:'No se siguen enlaces de carpetas'});continue;}
   const entries=await fs.readdir(dir,{withFileTypes:true});
   for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
    if(!/\.png$/i.test(entry.name))continue;
    if(++count>200){this.results.push({file:'',status:'límite',message:'Máximo 200 PNG por revisión. Retirá los lotes ya procesados de Mis-skins para continuar.'});break;}
    const file=path.join(dir,entry.name),relative=path.join(sub,entry.name),model=sub==='slim'?'slim':'classic';
    let key;
    try{
     const info=await fs.lstat(file);if(info.isSymbolicLink()||!info.isFile())throw Error('No se admiten enlaces ni directorios');
     const real=await fs.realpath(file);if(!real.startsWith(rootReal+path.sep))throw Error('Ruta fuera de la carpeta autorizada');
     if(info.size>1048576||info.size===0)throw Error('PNG máximo 1 MiB');
     // A handle and a bounded read also protect against a file growing while being copied.
     const h=await fs.open(file,'r');let bytes;
     try{const b=Buffer.alloc(1048577);const {bytesRead}=await h.read(b,0,b.length,0);if(bytesRead>1048576)throw Error('PNG máximo 1 MiB');bytes=b.subarray(0,bytesRead);}finally{await h.close();}
     key=model+':'+createHash('sha256').update(bytes).digest('hex');
     const previous=this.seen[key]||nextSeen[key];
     if(previous&&(!retry||previous.status!=='rechazado')){nextSeen[key]=previous;this.results.push({...previous,file:relative,cached:true});continue;}
     const result=await this.store.import({...this.config,model,name:entry.name.replace(/\.png$/i,'')},bytes);
     const item={file:relative,status:result.duplicate?'ya existente':'importada',id:result.id};
     nextSeen[key]=item;this.results.push(item);
    }catch(e){const item={file:relative,status:'rechazado',message:String(e.message||e)};if(key)nextSeen[key]=item;this.results.push(item);}
   }
   if(count>200)break;
  }
  this.seen=nextSeen;this.lastScan=new Date().toISOString();await this.save();return this.status();
 }
}
