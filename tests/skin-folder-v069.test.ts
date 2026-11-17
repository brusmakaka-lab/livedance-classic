import {it,expect} from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import {SkinFolder} from "../scripts/skins/folder.mjs";
import {Store} from "../scripts/skins/store.mjs";
import {decodePNG,encodePNG} from "../scripts/skins/png.mjs";
const meta={enabled:false,authorized:true,author:"LiveDance",source:"Original test fixture",license:"Internal original"};
async function setup(){
 await fs.mkdir("temp",{recursive:true});const dir=await fs.mkdtemp(path.resolve("temp/folder-"));
 const store=new Store(path.join(dir,"store"),path.resolve("public/integration/skins"));await store.init();
 const folder=new SkinFolder(path.join(dir,"inbox"),store,path.join(dir,"folder.json"));await folder.init();await folder.configure(meta);
 return{dir,store,folder};
}
async function fixture(name="coral"){
 const pixels=decodePNG(await fs.readFile("public/integration/skins/"+name+".png"));
 pixels[0]=pixels[0]^31;return encodePNG(pixels);
}
it("imports a mixed classic/slim batch, rejects invalid files, retains originals and deduplicates",async()=>{
 const {store,folder}=await setup(),before=store.state.records.length;
 const png=await fixture();await fs.writeFile(path.join(folder.root,"classic.png"),png);await fs.writeFile(path.join(folder.root,"duplicate.png"),png);
 await fs.writeFile(path.join(folder.root,"slim/thin.png"),await fixture("nova"));
 await fs.writeFile(path.join(folder.root,"broken.png"),"fake");await fs.writeFile(path.join(folder.root,"large.png"),Buffer.alloc(1048577));
 const result=await folder.scan();expect(result.results.filter(r=>r.status==="rechazado")).toHaveLength(2);
 expect(store.state.records).toHaveLength(before+2);
 expect(await fs.readFile(path.join(folder.root,"classic.png"))).toEqual(png);
 const revision=store.state.revision;await folder.scan();expect(store.state.revision).toBe(revision);
});
it("preserves viewer assignment and remembers processed files across restart and removal",async()=>{
 const {dir,store,folder}=await setup();const viewer=await store.assign("stable","Stable");
 await fs.writeFile(path.join(folder.root,"new.png"),await fixture());const result=await folder.scan();
 expect((await store.assign("stable","Stable")).skinId).toBe(viewer.skinId);
 const id=result.results[0].id;await store.remove(id);
 const restarted=new SkinFolder(folder.root,store,path.join(dir,"folder.json"));await restarted.init();
 await restarted.scan(true);expect(store.state.records.some(r=>r.id===id)).toBe(false);
 expect(restarted.config.author).toBe(meta.author);
});
it("requires batch permission and serializes concurrent configuration and scans",async()=>{
 const {folder}=await setup();await folder.configure({...meta,authorized:false});
 await expect(folder.scan()).rejects.toThrow("autorización");
 await expect(folder.configure({...meta,enabled:true,author:""})).rejects.toThrow("autor");
 await fs.writeFile(path.join(folder.root,"new.png"),await fixture());
 await Promise.all([folder.configure(meta),folder.scan(),folder.scan(),folder.configure({...meta,enabled:true})]);
 const state=JSON.parse(await fs.readFile(folder.stateFile,"utf8"));expect(state.config.enabled).toBe(true);expect(Object.keys(state.seen)).toHaveLength(1);
 folder.stop();
});
it("does not traverse directory links or accept a linked root",async()=>{
 const {dir,folder}=await setup();const external=path.join(dir,"outside");await fs.mkdir(external);
 await fs.symlink(external,path.join(folder.root,"linked.png"),"junction");
 const result=await folder.scan();expect(result.results[0].status).toBe("rechazado");
 const linked=path.join(dir,"linked");await fs.symlink(external,linked,"junction");
 const unsafe=new SkinFolder(linked,folder.store,path.join(dir,"unsafe.json"));await expect(unsafe.init()).rejects.toThrow("enlace");
 expect(await fs.readdir(external)).toHaveLength(0);
});
it("recovers from invalid folder configuration without enabling automatic imports",async()=>{
 const {folder,dir}=await setup();await fs.writeFile(folder.stateFile,"invalid");
 const restarted=new SkinFolder(folder.root,folder.store,path.join(dir,"folder.json"));await restarted.init();
 expect(restarted.config.enabled).toBe(false);expect(restarted.error).toContain("inválida");
});
