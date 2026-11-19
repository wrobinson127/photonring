const k=require('./kerr.js'); const {K}=k; K.M=.5; K.a=0;
const unit=a=>{ const l=Math.hypot(...a); return a.map(x=>x/l); }, cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
for(const r of [2,1,.7,.5]){ const d=unit([.8,.25,.55]), x=d.map(v=>v*r), be=Math.sqrt(1/r), v=-be*(1+be)/(1+be+be*be), vv=d.map(c=>c*v), ut=k.kut(x,vv), U=[ut,...vv.map(c=>c*ut)];
  const f=d.map(c=>-c), u=unit([-f[0]*f[1],1-f[1]*f[1],-f[2]*f[1]]), E=k.kframe(x,U,[cross(f,u),u,f]);
  const ed=k.kedge(x,6).map(e=>k.kseen(E,e.pt,e.p)); const ang=ed.map(s=>Math.acos(s.d[2])*180/Math.PI);
  const F=1-1/r, c=6.75/(r*r), kr=(r>1.5?1:-1)*Math.sqrt(Math.max(0,1-F*c)), kT=Math.abs(F)<1e-9?.5+be*c/2:(1+be*kr)/F, rain=Math.acos((kr+be*kT)/kT)*180/Math.PI;
  // trace: direction at angle th from forward, in the plane of forward and right
  const cap=th=>{ const dd=[Math.sin(th),0,Math.cos(th)], p=[0,0,0]; let pt=k.kphoton(x,E,dd,p); const s=1/Math.hypot(...p); p[0]*=s;p[1]*=s;p[2]*=s; pt*=s; if(pt>-1e-9) return 'noE'; const y=x.slice(); let prev=-1, rmax=0;
    for(let i=0;i<200000;i++){ const rr=k.kr(y); rmax=Math.max(rmax,rr); if(rr<prev&&rr<k.kcap()) return 'cap(rmax '+rmax.toFixed(2)+')'; if(rr>40) return 'open'; prev=rr; const D=new Float64Array(7); k.kderiv(y,p,pt,D); k.kstep(y,p,pt,-.002/Math.hypot(D[0],D[1],D[2])); } return 'stuck'; };
  let lo=0, hi=Math.PI*.6; for(let i=0;i<24;i++){ const m=.5*(lo+hi); if(cap(m)==='open') hi=m; else lo=m; }
  console.log(`r ${r}: exact outline ${ang[0].toFixed(2)}..${Math.max(...ang).toFixed(2)} deg, rain formula ${rain.toFixed(2)}, fine-step traced edge ${(lo*180/Math.PI).toFixed(2)}; at 5 deg: ${cap(.09)}, at edge-3deg: ${cap(lo-.05)}`); }
