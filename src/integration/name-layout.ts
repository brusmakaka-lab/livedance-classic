export type NameCandidate = { id:string; x:number; y:number; width:number; height:number; priority?:number };
/** Stable front-to-back order; bounded shift rather than a stack of detached names. */
export function placeNames(candidates:NameCandidate[],width:number,height:number,top=.15){
  const placed:NameCandidate[]=[];
  for(const c of [...candidates].sort((a,b)=>(b.priority||0)-(a.priority||0))){
    const x=Math.max(width*.12+c.width/2,Math.min(width*.88-c.width/2,c.x));
    for(const shift of [0,5,-5,10,-10,18,-18,28,-28,40,-40]){
      const y=c.y-shift*width/365;
      if(y-c.height<height*top || y>height*.84)continue;
      const next={...c,x,y};
      const hit=placed.some(p=>Math.abs(p.x-x)<(p.width+c.width)/2+3*width/365 && y>p.y-p.height-3*width/365 && y-c.height<p.y+3*width/365);
      if(!hit){placed.push(next);break;}
    }
  }
  return placed;
}
export function nameAccent(id:string){let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))|0;return ['#84dfd2','#edb776','#c7b3ef','#91c7f0'][Math.abs(hash)%4];}
