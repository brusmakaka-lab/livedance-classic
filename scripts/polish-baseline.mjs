import fs from 'node:fs/promises';
import path from 'node:path';

export async function comparisonBaseline(project) {
  const source=path.resolve(process.env.LIVEDANCE_POLISH_SOURCE||'E:/LiveDance/LiveDance-v0.6.14-RowShow');
  const target=path.resolve(process.env.LIVEDANCE_POLISH_BASELINE||path.join(project,'work/polish-baseline'));
  const inside=(a,b)=>a.toLowerCase()===b.toLowerCase()||a.toLowerCase().startsWith(b.toLowerCase()+path.sep);
  if(inside(target,source)||inside(source,target)||inside(project,target))throw Error('La comparación necesita una copia aislada, fuera de la versión original y de la raíz de esta versión.');
  if(!process.env.LIVEDANCE_POLISH_BASELINE){
    await fs.mkdir(target,{recursive:true});
    for(const name of ['dist','scripts','connector','public','package.json'])await fs.cp(path.join(source,name),path.join(target,name),{recursive:true,filter:p=>path.basename(p)!=='node_modules'});
    try{await fs.symlink(path.join(project,'node_modules'),path.join(target,'node_modules'),'junction');}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  await fs.access(path.join(target,'dist/index.html'));
  return target;
}
