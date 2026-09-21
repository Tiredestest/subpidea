"use client";
import {useState} from 'react';
export function StarInput({value,disabled,onChange}:{value:number;disabled:boolean;onChange:(value:number)=>void}) {
 const [hover,setHover]=useState<number|null>(null);
 return <div className="star-input" onMouseLeave={()=>setHover(null)} role="group" aria-label="내 별점 · 같은 점수를 다시 선택하면 취소">
 {[1,2,3,4,5].map(n=><span className="star-input-cell" key={n}>
 <span aria-hidden="true" className="star-input-art" style={{backgroundImage:`linear-gradient(90deg,#eeb957 ${Math.max(0,Math.min(1,(hover??value)-n+1))*100}%,#dde4f0 0)`}}>★</span>
 {[n-0.5,n].map(score=><button key={score} type="button" disabled={disabled} aria-label={`${score.toFixed(1)}점${value===score?' 취소':''}`} aria-pressed={value===score} onMouseEnter={()=>setHover(score)} onFocus={()=>setHover(score)} onBlur={()=>setHover(null)} onClick={()=>{setHover(null);onChange(value===score?0:score);}} />)}
 </span>)}
 <span className="star-input-value">{value?`${value.toFixed(1)}점`:'미평가'}</span>
 </div>;
}
