import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {decodePNG,encodePNG} from './skins/png.mjs';
const h=await harness('folder-ui',5481),p=h.page,checks=[];
try{
 const rootURL='http://127.0.0.1:5481';
 assert.equal((await fetch(rootURL+'/api/skins/folder-scan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(rootURL+'/api/skins/folder-status',{headers:{Origin:'https://example.org'}})).status,403);
 checks.push('Folder endpoints reject missing session token and foreign origins');
 await p.setViewportSize({width:1440,height:1080});await p.goto(rootURL+'/?empty=1&diagnostics=1');
 await p.waitForFunction(()=>__V05?.inspect().ready);
 await p.getByRole('button',{name:'Dancers',exact:true}).click();
 await p.locator('#skin-folder summary').click();
 await p.waitForFunction(()=>document.querySelector('#folder-config')?.dataset.loaded);
 const status=await (await fetch(rootURL+'/api/skins/folder-status')).json();
 for(const [name,source] of [['batch-classic.png','coral'],['slim/batch-slim.png','nova']]){
  const b=decodePNG(await fs.readFile('public/integration/skins/'+source+'.png'));b[0]^=31;
  await fs.writeFile(path.join(status.path,name),encodePNG(b));
 }
 await fs.writeFile(path.join(status.path,'bad.png'),'bad');
 for(const [key,value]of Object.entries({author:'LiveDance',source:'Original built-in fixtures',license:'Internal original'}))await p.locator('#folder-config [name="'+key+'"]').fill(value);
 await p.locator('#folder-config [name="authorized"]').check();
 await p.getByRole('button',{name:'Guardar ajustes del lote'}).click();
 await p.waitForFunction(()=>document.querySelector('#folder-config button')?.disabled===false);
 await p.locator('#folder-scan').click();
 await p.waitForFunction(()=>document.querySelector('#folder-results')?.textContent.includes('bad.png: rechazado'));
 assert.equal(await p.locator('#skin-cards .skin-card').count(),5);
 await p.screenshot({path:'docs/v069/evidence/BIBLIOTECA-CARPETA.png',fullPage:true});
 checks.push('UI saves metadata, imports classic/slim together, shows invalid PNG error and five library cards');
 await p.locator('#folder-config [name="enabled"]').check();await p.getByRole('button',{name:'Guardar ajustes del lote'}).click();
 const b=decodePNG(await fs.readFile('public/integration/skins/coral.png'));b[0]^=63;await fs.writeFile(path.join(status.path,'auto.png'),encodePNG(b));
 await p.waitForFunction(()=>document.querySelectorAll('#skin-cards .skin-card').length===6,{},{timeout:20000});
 await p.reload();await p.waitForFunction(()=>__V05?.inspect().ready);await p.getByRole('button',{name:'Dancers',exact:true}).click();await p.locator('#skin-folder summary').click();
 await p.waitForFunction(()=>document.querySelector('#folder-config')?.dataset.loaded);
 assert(await p.locator('#folder-config [name="enabled"]').isChecked());
 await p.locator('#folder-stop').click();await p.waitForFunction(()=>!document.querySelector('#folder-config [name="enabled"]')?.checked);
 checks.push('Automatic folder import refreshes library; configuration survives reload; automatic mode can be disabled');
 assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v069/folder-ui.json',JSON.stringify({checks,errors:h.errors},null,2));await h.close();console.log({checks,errors:h.errors});}
