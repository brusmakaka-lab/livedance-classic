import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='E:/LiveDance/LiveDance-v0.6.13-ShowDirector',out='docs/groupcamera';
const manifest=JSON.parse(await fs.readFile(out+'/base-hashes.json','utf8'));
const hash=async p=>{try{return createHash('sha256').update(await fs.readFile(p)).digest('hex');}catch{return null;}};
const originalsChanged=[],protectedChanged=[],modified=[];let protectedFiles=0;
for(const [p,h]of Object.entries(manifest)){
 if(await hash(base+'/'+p)!==h)originalsChanged.push(p);
 const target=await hash(p);
 if(target!==h)modified.push(p);
 const protectedFile=/^(public|connector)\//.test(p)||p.startsWith('src/')&&!['src/integration/show-director.ts','src/integration/show.ts','src/main.ts'].includes(p);
 if(protectedFile){protectedFiles++;if(target!==h)protectedChanged.push(p);}
}
const result={status:originalsChanged.length||protectedChanged.length?'FAIL':'PASS',base,originalFiles:Object.keys(manifest).length,originalsChanged,protectedFiles,protectedChanged,modified};
await fs.writeFile(out+'/preservation.json',JSON.stringify(result,null,2));assert.equal(result.status,'PASS');console.log(JSON.stringify(result));
