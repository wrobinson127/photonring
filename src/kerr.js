// Kerr geometry in Kerr-Schild coordinates, spin axis along +y. Units: r_s = 1, so M = 1/2.
// K.a is the spin length a = (spin fraction) * M. State: position x[3] and covariant momentum p[3]; pt = p_t = -E is conserved.
/*<kerr>*/
const K={a:0,M:.5};
const kdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function kr(x){ const a2=K.a*K.a, w=kdot(x,x)-a2; return Math.sqrt(.5*(w+Math.sqrt(w*w+4*a2*x[1]*x[1]))); }
function khor(){ return K.M+Math.sqrt(Math.max(0,K.M*K.M-K.a*K.a)); }
// the metric is g = eta + f l l, with l_mu = (1, l). Returns r and fills l.
function kfl(x,l){ const a=K.a, r=kr(x), B=r*r+a*a;
  l[0]=(r*x[0]-a*x[2])/B; l[1]=x[1]/r; l[2]=(r*x[2]+a*x[0])/B;
  return r; }
function kf(x,r){ return 2*K.M*r*r*r/(r*r*r*r+K.a*K.a*x[1]*x[1]); }
// Hamilton's equations for H = (1/2) g^{mu nu} p_mu p_nu. d = [dx0,dx1,dx2, dp0,dp1,dp2, dt]
const _l=[0,0,0];
function kderiv(x,p,pt,d){
  const a=K.a, a2=a*a, r=kfl(x,_l), r2=r*r, B=r2+a2, y=x[1], den=r2*r2+a2*y*y, f=2*K.M*r2*r/den;
  const L=kdot(_l,p)-pt;
  d[0]=p[0]-f*L*_l[0]; d[1]=p[1]-f*L*_l[1]; d[2]=p[2]-f*L*_l[2]; d[6]=-pt+f*L;
  const q=r*(2*r2-kdot(x,x)+a2), g0=x[0]*r2/q, g1=(y*r2+a2*y)/q, g2=x[2]*r2/q;       // grad r
  const c1=2*K.M*(3*r2*den-4*r2*r2*r2)/(den*den), c2=-2*K.M*r2*r*2*a2*y/(den*den);    // grad f = c1 grad r + c2 yhat
  const S=x[0]*p[0]+x[2]*p[2], A=r*S+a*(x[0]*p[2]-x[2]*p[0]), e=-2*A*r/(B*B), py=p[1];
  const G0=(g0*S+r*p[0]+a*p[2])/B+e*g0-py*y*g0/r2;
  const G1=(g1*S)/B+e*g1+py*(1/r-y*g1/r2);
  const G2=(g2*S+r*p[2]-a*p[0])/B+e*g2-py*y*g2/r2;
  const h=.5*L*L, k=f*L;
  d[3]=h*c1*g0+k*G0; d[4]=h*(c1*g1+c2)+k*G1; d[5]=h*c1*g2+k*G2;
}
// one fourth-order Runge-Kutta step of size h in the path parameter; returns the change in time
const _k1=new Float64Array(7), _k2=new Float64Array(7), _k3=new Float64Array(7), _k4=new Float64Array(7), _x=[0,0,0], _p=[0,0,0];
function kstep(x,p,pt,h){
  kderiv(x,p,pt,_k1);
  for(let i=0;i<3;i++){ _x[i]=x[i]+.5*h*_k1[i]; _p[i]=p[i]+.5*h*_k1[i+3]; } kderiv(_x,_p,pt,_k2);
  for(let i=0;i<3;i++){ _x[i]=x[i]+.5*h*_k2[i]; _p[i]=p[i]+.5*h*_k2[i+3]; } kderiv(_x,_p,pt,_k3);
  for(let i=0;i<3;i++){ _x[i]=x[i]+h*_k3[i]; _p[i]=p[i]+h*_k3[i+3]; } kderiv(_x,_p,pt,_k4);
  for(let i=0;i<3;i++){ x[i]+=h/6*(_k1[i]+2*_k2[i]+2*_k3[i]+_k4[i]); p[i]+=h/6*(_k1[i+3]+2*_k2[i+3]+2*_k3[i+3]+_k4[i+3]); }
  return h/6*(_k1[6]+2*_k2[6]+2*_k3[6]+_k4[6]);
}
function kH(x,p,pt){ const r=kfl(x,_l), f=kf(x,r), L=kdot(_l,p)-pt; return .5*(kdot(p,p)-pt*pt)-.5*f*L*L; }
// lower an index: four-velocity (ut, u) to covariant momentum per unit mass. Returns pt, fills p.
function klower(x,ut,u,p){ const l=[0,0,0], r=kfl(x,l), f=kf(x,r), s=f*(ut+kdot(l,u));
  p[0]=u[0]+s*l[0]; p[1]=u[1]+s*l[1]; p[2]=u[2]+s*l[2]; return -ut+s; }
// inner product of two four-vectors [t,x,y,z] at x
function kip(x,A,B){ const l=[0,0,0], r=kfl(x,l), f=kf(x,r);
  return -A[0]*B[0]+A[1]*B[1]+A[2]*B[2]+A[3]*B[3]+f*(A[0]+l[0]*A[1]+l[1]*A[2]+l[2]*A[3])*(B[0]+l[0]*B[1]+l[1]*B[2]+l[2]*B[3]); }
// time component that makes a coordinate velocity v = dx/dt into a four-velocity (0 if no such observer)
function kut(x,v){ const n=kip(x,[1,v[0],v[1],v[2]],[1,v[0],v[1],v[2]]); return n<0?1/Math.sqrt(-n):0; }
// gas on a prograde circular orbit in the equatorial plane: angular velocity, innermost stable orbit, energy
function komega(r){ return Math.sqrt(K.M)/(Math.pow(r,1.5)+K.a*Math.sqrt(K.M)); }
function kisco(){ const s=K.a/K.M, z1=1+Math.cbrt(1-s*s)*(Math.cbrt(1+s)+Math.cbrt(1-s)), z2=Math.sqrt(3*s*s+z1*z1);
  return K.M*(3+z2-Math.sqrt((3-z1)*(3+z1+2*z2))); }
// velocity dx/dt of that gas at an equatorial point x (the hole and the disk both turn about +y)
function kgas(x){ const r=kr(x), om=komega(r); return [om*x[2],0,-om*x[0]]; }
// an observer's frame: four-velocity U and three unit four-vectors along the space directions w[0..2], made orthonormal in the metric
function kframe(x,U,w){ const E=[U.slice()];
  for(let i=0;i<3;i++){ let e=[0,w[i][0],w[i][1],w[i][2]]; const c0=kip(x,e,U); e=e.map((v,j)=>v+c0*U[j]);
    for(let j=1;j<E.length;j++){ const c=kip(x,e,E[j]); e=e.map((v,m)=>v-c*E[j][m]); }
    const n=Math.sqrt(kip(x,e,e)); E.push(e.map(v=>v/n)); }
  return E; }
// four-velocity of an observer hovering at x (none exists inside the ergosphere)
function khover(x){ const ut=kut(x,[0,0,0]); return ut?[ut,0,0,0]:null; }
// photon reaching the observer from direction d of its frame (d along right, up, forward): fills covariant p, returns pt. The observer measures frequency 1.
function kphoton(x,E,d,p){ const k=[0,1,2,3].map(m=>E[0][m]-d[0]*E[1][m]-d[1]*E[2][m]-d[2]*E[3][m]); return klower(x,k[0],[k[1],k[2],k[3]],p); }
// the direction in the observer's frame from which it sees a photon with covariant momentum (pt, p), and the frequency it measures
function kseen(E,pt,p){ const c=e=>pt*e[0]+p[0]*e[1]+p[1]*e[2]+p[2]*e[3], om=-c(E[0]); return {om,d:[-c(E[1])/om,-c(E[2])/om,-c(E[3])/om]}; }
// The exact edge of the shadow (Bardeen 1973): photons that just graze the unstable spherical light orbits of radius rp.
// Returns their covariant momenta at x, with energy 1. Spin 0 is the single orbit at 1.5 r_s.
function kedge(x,n){ const a=K.a, M=K.M, r=kr(x), out=[], ct=x[1]/r, st=Math.sqrt(Math.max(1e-12,1-ct*ct)), D=r*r-2*M*r+a*a;
  const s=a/M, r1=a?2*M*(1+Math.cos(2/3*Math.acos(-s))):3*M, r2=a?2*M*(1+Math.cos(2/3*Math.acos(s))):3*M;
  // gradients of r, theta and the Kerr-Schild angle, by differences
  const ph=q=>Math.atan2(q[0],q[2])-Math.atan2(a,kr(q)), th=q=>Math.acos(q[1]/kr(q)), h=1e-5*Math.max(1,r), gr=[0,0,0], gt=[0,0,0], gp=[0,0,0];
  for(let i=0;i<3;i++){ const u=x.slice(), v=x.slice(); u[i]+=h; v[i]-=h; gr[i]=(kr(u)-kr(v))/(2*h); gt[i]=(th(u)-th(v))/(2*h);
    let dp=ph(u)-ph(v); if(dp>Math.PI) dp-=2*Math.PI; if(dp<-Math.PI) dp+=2*Math.PI; gp[i]=dp/(2*h); }
  for(let i=0;i<n;i++){ for(const sg of [1,-1]){
    const rp=a?r1+(r2-r1)*(.5-.5*Math.cos(Math.PI*(i+.5)/n)):r1;
    let xi, eta;
    if(a){ xi=-(rp*rp*rp-3*M*rp*rp+a*a*rp+a*a*M)/(a*(rp-M)); eta=rp*rp*rp*(4*M*a*a-rp*(rp-3*M)*(rp-3*M))/(a*a*(rp-M)*(rp-M)); }
    else { const an=Math.PI*(i+.5)/n; xi=Math.sqrt(27)*M*st*Math.cos(an); eta=27*M*M-xi*xi; } // spin 0: any split of the total with xi^2 + eta = 27 M^2
    const Th=eta+a*a*ct*ct-xi*xi*ct*ct/(st*st); if(Th<0) continue;
    const R=Math.max(0,Math.pow(r*r+a*a-a*xi,2)-D*(eta+(xi-a)*(xi-a)));
    const prBL=(r>rp?1:-1)*Math.sqrt(R)/D, prKS=prBL+(2*M*r-a*xi)/D, pth=sg*Math.sqrt(Th);
    out.push({pt:-1,p:[0,1,2].map(j=>prKS*gr[j]+pth*gt[j]+xi*gp[j]),rp,sg}); } }
  return out; }
// Radius below which a light ray heading inward cannot come back: a little inside the innermost light orbit.
// (Rays traced backward toward the hole pile up at the horizon in these coordinates, so they are stopped here.)
function kcap(){ const s=K.a/K.M, rp=2*K.M*(1+Math.cos(2/3*Math.acos(-s))), rh=khor(); return rh+.35*(rp-rh); }
// Energy a thin disk radiates per unit area at radius r, up to a constant (Page and Thorne 1974): zero at the
// innermost stable orbit, and the Newtonian r^-3 (1 - sqrt(r_in/r)) far out.
function kflux(r){ const s=K.a/K.M, x=Math.sqrt(r/K.M), x0=Math.sqrt(kisco()/K.M); if(x<=x0) return 0;
  const c=Math.acos(s)/3, x1=2*Math.cos(c-Math.PI/3), x2=2*Math.cos(c+Math.PI/3), x3=-2*Math.cos(c);
  const t=(xa,xb,xc)=>3*(xa-s)*(xa-s)/(xa*(xa-xb)*(xa-xc))*Math.log((x-xa)/(x0-xa));
  return (x-x0-1.5*s*Math.log(x/x0)-t(x1,x2,x3)-t(x2,x1,x3)-t(x3,x1,x2))/(x*x*x*x*(x*x*x-3*x+2*s)); }
/*</kerr>*/
if(typeof module!=='undefined') module.exports={kflux,kcap,kframe,khover,kphoton,kseen,kedge,K,kdot,kr,khor,kfl,kf,kderiv,kstep,kH,klower,kip,kut,komega,kisco,kgas};
