const k=require('./kerr.js'); const {K}=k; const M=.5;
const unit=a=>{ const l=Math.hypot(...a); return a.map(x=>x/l); }, cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function cam(dist,el,az){ const x=[dist*Math.cos(el)*Math.cos(az),dist*Math.sin(el),dist*Math.cos(el)*Math.sin(az)], f=x.map(v=>-v/dist); const r=unit([-f[2],0,f[0]]), u=cross(r,f); return {x,E:k.kframe(x,k.khover(x),[r,u,f])}; }
// is the ray seen in frame direction d captured? traced backward
function captured(C,d){ const p=[0,0,0]; let pt=k.kphoton(C.x,C.E,d,p); const x=C.x.slice(), rc=k.kcap(), rh=k.khor(); const s=1/Math.hypot(...p); p[0]*=s;p[1]*=s;p[2]*=s; pt*=s; let prev=k.kr(x);
  for(let i=0;i<6000;i++){ const r=k.kr(x); if(r<rc && r<prev) return true; if(r>Math.max(40,k.kr(C.x)*1.3)) return false; prev=r; k.kstep(x,p,pt,-Math.max(.01,.06*(r-rh*.9))); } return true; }
for(const [s,dist,el] of [[0,30,.14],[0,5,.5],[.9,30,.14],[.9,30,1.2],[.9,6,.3],[.9,3,.05],[.5,10,-.6],[.99,15,.02]]){ K.a=s*M; const C=cam(dist,el,.9);
  const ed=k.kedge(C.x,24); let worstH=0, worst=0, n=0; const dirs=ed.map(e=>{ worstH=Math.max(worstH,Math.abs(k.kH(C.x,e.p,e.pt))); return k.kseen(C.E,e.pt,e.p).d; });
  // centre of the outline on the screen, then for each edge point bisect along the line from the centre
  const sc=dirs.map(d=>[d[0]/d[2],d[1]/d[2]]); const c=[0,1].map(i=>sc.reduce((t,q)=>t+q[i],0)/sc.length);
  for(const q of sc){ let lo=0, hi=2; for(let i=0;i<26;i++){ const m=.5*(lo+hi), pt=[c[0]+(q[0]-c[0])*m,c[1]+(q[1]-c[1])*m]; if(captured(C,unit([pt[0],pt[1],1]))) lo=m; else hi=m; } worst=Math.max(worst,Math.abs(.5*(lo+hi)-1)); n++; }
  const xs=sc.map(q=>q[0]), ys=sc.map(q=>q[1]);
  console.log(`spin ${s}, camera ${dist} r_s, ${ (el*180/Math.PI).toFixed(0)} deg up: ${n} edge points, null to ${worstH.toExponential(1)}, traced edge within ${(worst*100).toFixed(3)}% of exact; outline x ${Math.min(...xs).toFixed(4)}..${Math.max(...xs).toFixed(4)}, y ${Math.min(...ys).toFixed(4)}..${Math.max(...ys).toFixed(4)}`); }
