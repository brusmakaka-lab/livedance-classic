import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const base='E:/LiveDance/LiveDance-v0.6.13.1-GroupCamera',out='docs/grouprotation',manifest=JSON.parse(await fs.readFile(out+'/base-hashes.json','utf8'));
const hash=async p=>{try{return createHash('sha256').update(await fs.readFile(p)).digest('hex');}catch{return null;}};
const allowed=['src/integration/show-director.ts','src/integration/show.ts','src/integration/config.ts','src/main.ts'],originalChanges=[],protectedChanges=[],modified=[];let protectedFiles=0;
for(const [p,h]of Object.entries(manifest)){if(await hash(base+'/'+p)!==h)originalChanges.push(p);const target=await hash(p);if(target!==h)modified.push(p);if(/^(public|connector)\//.test(p)||p.startsWith('src/')&&!allowed.includes(p)){protectedFiles++;if(target!==h)protectedChanges.push(p);}}
const camera=s=>s.slice(s.indexOf('  initialize('),s.indexOf('  inspect()'));
const cameraUnchanged=camera(await fs.readFile(base+'/src/integration/show-director.ts','utf8'))===camera(await fs.readFile('src/integration/show-director.ts','utf8'));
const result={status:originalChanges.length||protectedChanges.length||!cameraUnchanged?'FAIL':'PASS',base,originalFiles:Object.keys(manifest).length,originalChanges,protectedFiles,protectedChanges,cameraUnchanged,modified};await fs.writeFile(out+'/preservation.json',JSON.stringify(result,null,2));assert.equal(result.status,'PASS');console.log(JSON.stringify(result));
