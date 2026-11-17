import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/stage-recovery',base=JSON.parse(await fs.readFile(out+'/before.json','utf8')).observations[0].camera;
const h=await harness('recovery-camera',5556,true);
try{
 await h.send('VIEWER_JOIN','viewer-0',{username:'Río'});await h.page.waitForFunction(()=>__V05.inspect().actors.length===1);await h.page.waitForTimeout(300);
 const recovery=await h.page.evaluate(()=>__V05.inspect().camera);assert.deepEqual(recovery,base);
 const video=JSON.parse(await fs.readFile(out+'/recording-results.json','utf8')).state.camera;
 // Exact original StageAlive formula at 540/960 (slightly different from 365/648).
 const expectedDistance=Math.max(14.2,14.2*(365/648)/(540/960));
 assert(Math.abs(video.position[2]-expectedDistance)<1e-10);assert.deepEqual(video.target,base.target);
 await fs.writeFile(out+'/camera-comparison.json',JSON.stringify({status:'PASS',viewport:[365,648],base,recovery,recording:{viewport:[540,960],camera:video,originalExpectedDistance:expectedDistance},sourceFilesUnchanged:['src/integration/camera.ts','src/integration/lineup.ts']},null,2));console.log('Original camera comparison PASS');
}finally{await h.close();}
