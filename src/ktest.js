const k=require('./kerr.js'); const {K}=k; const M=.5;
// null ray arriving from far away along -x direction... we shoot it inward: start at (-D, 0, b) moving +x, in the equatorial plane; b>0 or <0 picks the side
function shoot(b,incl){ // returns {captured, deflection, Hdrift, steps}
  const D=400; const x=[-D,0,b], dir=[1,0,0];
  if(incl){ x[1]=incl; }
  // photon: four-velocity direction (1,dir) made null: far away metric is flat to 1/D; solve for covariant momentum with pt=-1
  let p=[0,0,0]; const l=[0,0,0], r=k.kfl(x,l), f=k.kf(x,r);
  // null condition for k^mu=(kt,dir*s): choose spatial unit, solve kt from g(k,k)=0
  const ld=k.kdot(l,dir); // g = -kt^2 + 1 + f (kt + ld)^2 = 0 -> (f-1)kt^2 + 2 f ld kt + 1 + f ld^2 = 0
  const A=f-1, B=2*f*ld, C=1+f*ld*ld; const kt=(-B-Math.sqrt(B*B-4*A*C))/(2*A);
  let pt=k.klower(x,kt,dir,p); const s=-1/pt; p=p.map(v=>v*s); pt=-1;
  const H0=k.kH(x,p,pt), rh=k.khor(); let steps=0, Hd=0;
  for(;steps<200000;steps++){
    const rr=k.kr(x); if(rr<rh*1.0005) return {captured:true,steps};
    if(rr>D+1 && steps>10) break;
    const h=Math.max(.01,.05*(rr-rh*.9)); k.kstep(x,p,pt,h);
    if(steps%50===0) Hd=Math.max(Hd,Math.abs(k.kH(x,p,pt)-H0));
  }
  const d=[0,0,0,0,0,0,0]; k.kderiv(x,p,pt,d);
  return {captured:false,deflection:Math.abs(Math.atan2(d[2],d[0])),Hdrift:Hd,steps,Ly:x[2]*p[0]-x[0]*p[2]};
}
function crit(sign){ let lo=1, hi=5; for(let i=0;i<40;i++){ const m=.5*(lo+hi); if(shoot(sign*m).captured) lo=m; else hi=m; } return .5*(lo+hi); }
function exactB(sense){ const s=K.a/M; if(s===0) return Math.sqrt(27)/2; const r=2*M*(1+Math.cos(2/3*Math.acos(-sense*s))); return Math.abs(-(r*r*r-3*M*r*r+K.a*K.a*r+K.a*K.a*M)/(K.a*(r-M))); }
K.a=0; console.log('spin 0: critical b',crit(1).toFixed(4),'exact 2.5981; bending at b=20',(shoot(20).deflection*180/Math.PI).toFixed(3),'deg, exact 6.194; H drift',shoot(20).Hdrift.toExponential(1));
for(const s of [.5,.9,.998]){ K.a=s*M; const bp=crit(1), bm=crit(-1); const L=shoot(6).Ly;
  console.log(`spin ${s}: critical b on +z side ${bp.toFixed(4)}, on -z side ${bm.toFixed(4)}; exact prograde ${exactB(1).toFixed(4)}, retrograde ${exactB(-1).toFixed(4)}; Ly of +z ray ${L.toFixed(2)}`); }
// circular orbits: gas velocity from kgas; check radius holds, energy matches the closed form, and which sense is prograde
function circ(r0,sense,turns){ const x=[r0?Math.sqrt(r0*r0+K.a*K.a):0,0,0]; const om=k.komega(r0)*sense; const v=[om*x[2],0,-om*x[0]]; // +y angular momentum for sense=1
  const omr=sense>0?k.komega(r0):Math.sqrt(M)/(Math.pow(r0,1.5)-K.a*Math.sqrt(M)); const vv=[0,0,-omr*x[0]*sense];
  const ut=k.kut(x,vv), u=vv.map(c=>c*ut), p=[0,0,0], pt=k.klower(x,ut,u,p);
  let rmin=9e9, rmax=0, t=0; const T=2*Math.PI/omr*turns; let n=0;
  while(t<T && n<4e6){ const rr=k.kr(x); if(rr<k.khor()*1.001){ rmin=0; break; } rmin=Math.min(rmin,rr); rmax=Math.max(rmax,rr); t+=k.kstep(x,p,pt,.02); n++; }
  return {E:-pt,rmin,rmax,H:k.kH(x,p,pt)}; }
function exactE(r,sense){ const a=K.a*sense, sM=Math.sqrt(M); return (Math.pow(r,1.5)-2*M*Math.sqrt(r)+a*sM)/(Math.pow(r,.75)*Math.sqrt(Math.pow(r,1.5)-3*M*Math.sqrt(r)+2*a*sM)); }
for(const s of [0,.9]){ K.a=s*M; const ri=k.kisco(); console.log(`spin ${s}: innermost stable orbit ${ri.toFixed(4)} (in M: ${(ri/M).toFixed(4)}), horizon ${k.khor().toFixed(4)}`);
  for(const r0 of [6*M*1.0, ri*1.3, ri*1.02]){ const c=circ(r0,1,6); console.log(`   prograde orbit at ${r0.toFixed(3)}: r stays in [${c.rmin.toFixed(4)}, ${c.rmax.toFixed(4)}], E ${c.E.toFixed(6)} exact ${exactE(r0,1).toFixed(6)}, H ${c.H.toFixed(6)}`); }
  if(s){ const r0=6*M; const c=circ(r0,-1,6); console.log(`   retrograde formula at ${r0}: r in [${c.rmin.toFixed(4)}, ${c.rmax.toFixed(4)}], E ${c.E.toFixed(6)} exact ${exactE(r0,-1).toFixed(6)}`); } }
// stability either side of the innermost stable orbit: nudge the speed down 0.5%
K.a=.9*M; { const ri=k.kisco(); for(const fct of [.97,1.08]){ const r0=ri*fct, x=[Math.sqrt(r0*r0+K.a*K.a),0,0], om=k.komega(r0)*.997, vv=[0,0,-om*x[0]], ut=k.kut(x,vv), u=vv.map(c=>c*ut), p=[0,0,0], pt=k.klower(x,ut,u,p); let t=0, fell=false, n=0; while(t<600&&n<2e6){ if(k.kr(x)<k.khor()*1.01){ fell=true; break; } t+=k.kstep(x,p,pt,.02); n++; } console.log(`spin 0.9, start at ${fct} x innermost orbit, speed 0.3% low: ${fell?'falls in':'stays out'}`); } }
