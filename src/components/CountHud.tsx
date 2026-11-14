import { useEffect,useState } from 'react';
import { Hud } from './Hud';
import type { HudState } from '../game/engine/GameEngine';
import { loadCountRecord,saveCountPeak } from '../game/count/records';

export function CountHud({hud,onPause}:{hud:HudState|null;onPause:()=>void}){
 const [best,setBest]=useState(()=>loadCountRecord().best),count=hud?.count;
 useEffect(()=>{if(count&&count.peak>best)setBest(saveCountPeak(count.peak).best);},[count?.peak,best]);
 return <Hud hud={hud} onPause={onPause} mode="classic" countBest={Math.max(best,count?.peak??0)}/>;
}
