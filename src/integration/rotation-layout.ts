import {Vector3} from 'three';
import {settledPlacement} from './lineup';
/** The default stage retains its five original positions. Larger layouts are evaluation presets. */
export function rotationPlacement(slot:number,capacity:number,layout:'ROWS'|'ARC'){
  if(capacity===5)return settledPlacement(slot);
  if(layout==='ARC'){
    const perRow=Math.ceil(capacity/2),row=Math.floor(slot/perRow),count=Math.min(perRow,capacity-row*perRow),column=slot%perRow;
    const x=(column-(count-1)/2)*2.05;return new Vector3(x,0,-4.2-row*5-Math.abs(x)*.6);
  }
  const row=Math.floor(slot/3),count=Math.min(3,capacity-row*3),column=slot%3;
  return new Vector3((column-(count-1)/2)*2.8,0,-4.2-row*3.6);
}

/** Twenty permanent horizontal seats; subsequent rows advance towards the audience. */
export function rowPlacement(slot:number){
 const row=Math.floor(Math.max(0,slot)/20),column=Math.max(0,slot)%20;
 return new Vector3((column-9.5)*2.8,0,-4.2+row*5.2);
}
