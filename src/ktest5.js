const k=require('./kerr.js'); const {K}=k; const M=.5;
for(const s of [0,.9]){ K.a=s*M; const ri=k.kisco(); let peak=0, rpk=0; for(let r=ri;r<30;r+=.002){ const f=k.kflux(r); if(f>peak){ peak=f; rpk=r; } }
  // far-field: compare with the Newtonian form, scaled to match at r = 2000
  const N=r=>(1-Math.sqrt(ri/r))/(r*r*r), sc=k.kflux(2000)/N(2000);
  console.log(`spin ${s}: inner edge ${ri.toFixed(4)}, flux at edge ${k.kflux(ri*1.0001).toExponential(1)}, peak at ${rpk.toFixed(3)} r_s (${(rpk/ri).toFixed(3)} x inner edge); ratio to Newtonian at 500, 100, 20 r_s: ${[500,100,20].map(r=>(k.kflux(r)/(sc*N(r))).toFixed(3)).join(', ')}; all positive: ${[1.01,1.2,2,5,50].every(q=>k.kflux(ri*q)>0)}`); }
// spin 0 cross-check against the Schwarzschild closed form: bracket = x - x0 + (sqrt3/2) ln[ (x+sqrt3)(x0-sqrt3) / ((x-sqrt3)(x0+sqrt3)) ]
K.a=0; { const s3=Math.sqrt(3), x0=Math.sqrt(6); let w=0; for(const r of [3.2,4,8,30]){ const x=Math.sqrt(r/M); const ex=(x-x0+s3/2*Math.log((x+s3)*(x0-s3)/((x-s3)*(x0+s3))))/(x*x*x*x*(x*x*x-3*x)); w=Math.max(w,Math.abs(k.kflux(r)/ex-1)); } console.log('spin 0 against the Schwarzschild closed form: worst relative difference',w.toExponential(1)); }
