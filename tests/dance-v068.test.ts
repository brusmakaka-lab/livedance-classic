import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {integrationConfig} from '../src/integration/config';
import {VisualQueue} from '../src/integration/cast';
const data=JSON.parse(fs.readFileSync('public/integration/dance-catalog.json','utf8'));
describe('DanceLab catalogue and entrance',()=>{
 it('defaults to Boxing for seven seconds and validates controls',()=>{
  expect(integrationConfig({})).toMatchObject({followSeconds:7,entranceDance:'MixamoBoxingLoop',backgroundDance:'AUTO'});
  for(const n of [3.5,5,7])expect(integrationConfig({followSeconds:n}).followSeconds).toBe(n);
  expect(integrationConfig({followSeconds:NaN,entranceDance:'<script>'})).toMatchObject({followSeconds:7,entranceDance:'MixamoBoxingLoop'});
 });
 it('plays queued seven-second introductions without automatic rotation',()=>{
  const q=new VisualQueue();q.push('follow','a','','',7);q.push('follow','b','','',7);
  for(let i=0;i<69;i++)q.update(.1);expect(q.active?.id).toBe('a');
  for(let i=0;i<3;i++)q.update(.1);expect(q.active?.id).toBe('b');
  for(let i=0;i<80;i++)q.update(.1);expect(q.active).toBeUndefined();expect(q.queue).toHaveLength(0);
 });
 it('ships five approved candidates for both models and excludes the unsafe acrobatics',()=>{
  expect(data.catalog).toHaveLength(5);expect(data.catalog.map((d:any)=>d.label)).not.toContain('Flair');
  expect(data.catalog.map((d:any)=>d.label)).not.toContain('Swing To Land');
  for(const model of ['classic','slim']){
   expect(data[model].clips.map((c:any)=>c.name)).toEqual(data.catalog.map((c:any)=>c.id));
   for(const clip of data[model].clips){expect(clip.duration).toBeGreaterThan(1);expect(clip.tracks).toHaveLength(23);for(const t of clip.tracks)expect(t.values.every(Number.isFinite)).toBe(true);}
  }
 });
});
