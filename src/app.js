"use strict";
//@@KERR@@
//@@STARS@@
//@@NEBULAE@@
function main(){
const $=id=>document.getElementById(id);
const canvas=$('gl'), guide=$('guide'), g2=guide.getContext('2d');
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
if(!gl){ $('fallback').style.display='grid'; return; }

const STEPS=320, ROUT=15.0;
$('pSteps').textContent=STEPS;
const hdr=!!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');

/* ---------- shaders ---------- */
const VS=`#version 300 es
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.-1.,0.,1.); }`;

const SCENE=`#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uCam;
uniform mat4 uTet; // the camera's frame: its four-velocity, then right, up and forward, each as (x, y, z, t)
uniform float uFocal,uTime,uDop,uEsc,uEnc,uProbe,uM,uA,uRh,uRcap,uRin,uRing,uVol; uniform vec3 uStep; uniform float uLing;
uniform float uFlux[32];
uniform highp sampler3D uNoise,uVolA,uVolB; uniform sampler2D uStars;
uniform highp sampler2DArray uNeb,uNebP; uniform vec4 uNebC[12],uNebR[12],uNebU[12],uNebG[12],uNebT[12],uNebS[12]; uniform float uNebLod,uNebOn,uNebMode; // telescope images: centre, right, up, gain
uniform vec4 uB[6],uBA[6],uBG[6],uBV[6]; uniform int uNB; // launched objects: centre+radius, half-axis+kind, seed+reach, velocity+time rate
out vec4 o;
const float ROUT=${ROUT.toFixed(1)}, TAU=6.2831853;
const vec2 OFF[8]=vec2[8](vec2(0),vec2(.375,.125),vec2(-.125,.375),vec2(-.375,-.125),vec2(.125,-.375),vec2(.25,.4),vec2(-.4,.2),vec2(.3,-.3));
float gPt, gW; // for the ray being traced: its conserved p_t, and the frequency the camera measures, in the same units

//@@OLD_GLSL_A@@
// ----- the spinning hole, in Kerr-Schild coordinates with the spin along +y: g = eta + f l l -----
float ksr(vec3 x){ float a2=uA*uA, w=dot(x,x)-a2; return sqrt(.5*(w+sqrt(w*w+4.*a2*x.y*x.y))); }
float kfl(vec3 x,out vec3 l){ float r=ksr(x), B=r*r+uA*uA;
  l=vec3((r*x.x-uA*x.z)/B, x.y/r, (r*x.z+uA*x.x)/B);
  return 2.*uM*r*r*r/(r*r*r*r+uA*uA*x.y*x.y); }
// Hamilton's equations for H = (1/2) g^{mu nu} p_mu p_nu: rates of change of position, momentum and time
void deriv(vec3 x,vec3 p,out vec3 dx,out vec3 dp,out float dt){
  float a=uA, a2=a*a, y=x.y, w=dot(x,x)-a2;
  float r2=.5*(w+sqrt(w*w+4.*a2*y*y)), r=sqrt(r2), B=r2+a2, den=r2*r2+a2*y*y, f=2.*uM*r2*r/den;
  vec3 l=vec3((r*x.x-a*x.z)/B, y/r, (r*x.z+a*x.x)/B);
  float L=dot(l,p)-gPt;
  dx=p-f*L*l; dt=-gPt+f*L;
  vec3 gr=vec3(x.x*r2, y*(r2+a2), x.z*r2)/(r*(2.*r2-dot(x,x)+a2));
  float c1=2.*uM*(3.*r2*den-4.*r2*r2*r2)/(den*den), c2=-4.*uM*r2*r*a2*y/(den*den);
  float S=x.x*p.x+x.z*p.z, A=r*S+a*(x.x*p.z-x.z*p.x);
  vec3 G=(gr*S+vec3(r*p.x+a*p.z,0.,r*p.z-a*p.x))/B-2.*A*r/(B*B)*gr+p.y*(vec3(0.,1./r,0.)-y*gr/r2);
  dp=.5*L*L*(c1*gr+vec3(0.,c2,0.))+f*L*G;
}
// frequency the camera measures over the frequency measured by something at x moving with velocity v = dx/dt
float shift(vec3 x,vec3 p,vec3 v){
  vec3 l; float f=kfl(x,l), lv=1.+dot(l,v);
  float n=1.-dot(v,v)-f*lv*lv, w=-(gPt+dot(p,v))*inversesqrt(max(n,1e-6));
  return mix(1.,(n>0. && w>1e-4) ? gW/w : 0.,uDop); // nothing can move that way, or emit that light: no light
}

// the disk: gas on circular orbits. T: how long ago this light left, so the pattern is drawn as it was then
vec4 disk(vec3 x,vec3 p,float order,float T){
  float r=sqrt(max(dot(x.xz,x.xz)-uA*uA,1e-6)), sm=sqrt(max(uM,1e-6)), om=sm/(pow(r,1.5)+uA*sm);
  float g=shift(x,p,om*vec3(x.z,0.,-x.x));
  float phi=atan(-x.z,x.x)/TAU, t=uTime-T;
  // two sheared noise layers, cross-faded so the wind-up never accumulates
  const float PT=70.;
  float t1=mod(t,PT), t2=mod(t+.5*PT,PT), w1=1.-abs(t1/PT*2.-1.);
  float n1=streaks(phi-om*(t1-.5*PT)/TAU,r), n2=streaks(phi-om*(t2-.5*PT)/TAU+.37,r+31.);
  float n=mix(n2,n1,w1);
  n=.5+(n-.5)/sqrt(w1*w1+(1.-w1)*(1.-w1));
  n=smoothstep(.22,.78,n);
  n=mix(n,.55,clamp(order,0.,1.)*.75); // images that circled the hole are too thin to carry texture
  float q=sqrt(clamp((r-uRin)/(ROUT-uRin),0.,1.))*31., qi=floor(min(q,30.));
  float Tn=pow(max(mix(uFlux[int(qi)],uFlux[int(qi)+1],q-qi),0.),.25); // temperature from the relativistic thin-disk flux
  vec3 c=bb(5200.*Tn*g)*pow(Tn*g,4.)*(.25+1.35*n*n)*.95;
  float al=smoothstep(ROUT,ROUT*.55,r)*smoothstep(uRin,uRin+.25,r)*(.5+.5*n);
  return vec4(c,clamp(al,0.,1.));
}

//@@OLD_GLSL_B@@
//@@OLD_HIT@@
vec3 shadeBody(int k,vec3 x,vec3 rd,vec3 p){
  vec4 B=uB[k]; vec3 ax=uBA[k].xyz; float kind=uBA[k].w, seed=uBG[k].y;
  float g=shift(x,p,uBV[k].xyz);
  float c2=dot(ax,ax), u=c2>1e-8 ? clamp(dot(x-B.xyz,ax)/c2,-1.,1.) : 0.;
  vec3 n=normalize(x-(B.xyz+u*ax)), V=-rd, L=normalize(-B.xyz); // lit by the disk, from the hole's direction
  float nl=max(dot(n,L),0.), mu=max(dot(n,V),0.), fres=pow(1.-mu,3.);
  vec3 light=vec3(1.,.84,.62)*1.7, q=n*2.+seed*17., c;
  if(kind<.5){ // meteor: cratered rock
    float f=fbm3(q*2.2), cr=smoothstep(.56,.62,vnoise(q*3.+5.));
    c=mix(vec3(.10,.085,.075),vec3(.38,.31,.26),f)*(1.-.5*cr)*(light*nl+.05);
  } else if(kind<1.5){ // planet: oceans, land, cloud, ice caps, thin air
    float f=fbm3(q*1.6), land=smoothstep(.5,.56,f), cl=smoothstep(.5,.68,fbm3(q*3.1+9.));
    vec3 alb=mix(vec3(.03,.12,.32),mix(vec3(.11,.28,.09),vec3(.45,.36,.22),fbm3(q*4.)),land);
    alb=mix(alb,vec3(.9),cl*.8); alb=mix(alb,vec3(.95),smoothstep(.8,.9,abs(n.y)));
    c=alb*(light*nl+.03)+vec3(.25,.5,1.)*fres*(.2+nl)*.7;
  } else if(kind<2.5){ // star: a black body at its shifted temperature
    return bb(5800.*g)*min(pow(g,4.),60.)*(.4+.6*mu)*(.85+.3*fbm3(q*5.+uTime*.02))*5.;
  } else if(kind<3.5){ // rocket hull
    vec3 alb=mix(vec3(.82,.84,.86),vec3(.85,.12,.08),step(.5,u));
    alb=mix(alb,vec3(.07,.1,.16),smoothstep(.06,.0,abs(u-.2)));
    alb=mix(alb,vec3(.12),step(u,-.82));
    c=alb*(light*nl+.07)+fres*.08;
  } else { // engine flame
    c=mix(vec3(1.,.45,.12),vec3(.6,.8,1.),mu*mu)*(1.2+4.5*mu*mu)*(.7+.3*sin(uTime*9.+u*7.));
  }
  return c*bb(6500.*g)*min(pow(g,4.),40.); // reflected light, shifted like the rest
}

// One ray, traced backward from the camera. ling: the angle it swept round the hole while close to the light orbits.
vec3 trace(vec2 uv,out float ling){
  ling=0.;
  vec3 d=normalize(vec3(uv,uFocal));
  vec4 k=uTet[0]-d.x*uTet[1]-d.y*uTet[2]-d.z*uTet[3]; // the photon arriving from that direction, as a four-vector
  vec3 l; float f=kfl(uCam,l), s0=f*(k.w+dot(l,k.xyz));
  vec3 p=k.xyz+s0*l; float sc=1./length(p); p*=sc; gPt=(s0-k.w)*sc; gW=sc;
  if(gPt>-1e-5) return vec3(0); // no light from outside arrives with zero or negative energy
  if(uProbe>1.5 && uProbe<2.5) return vec3(gW/(-gPt)); // test only: the frequency shift against far away
  vec3 x=uCam, col=vec3(0), dx, dp, ex=vec3(0), vX=vec3(0), vP=vec3(0); float tr=1., order=0., rp=-1., T=0., dt, vW=0., vT=0., vG=0.; bool open=false;
  for(int i=0;i<${STEPS};i++){
    float r=ksr(x);
    // Inside the innermost light orbit and still heading in: it came from the hole. So did a ray whose momentum is
    // running away, which is what tracing backward toward the horizon looks like in these coordinates.
    if(r<rp && (r<uRcap || (r<1.6*uRh && dot(p,p)>3e3))) break;
    deriv(x,p,dx,dp,dt);
    if(r>uEsc && dot(x,dx)<0.){ open=true; ex=dx; break; }
    float ds=min(r>uRh ? max(uStep.x,uStep.y*(r-.75*uRh)) : max(.004,uStep.z*r), max(.005,.3*abs(r-uRh))); // finer close to the horizon, on both sides
    float h=-ds/max(length(dx),1e-3), d2, d3, d4;
    vec3 dx2,dp2,dx3,dp3,dx4,dp4; // fourth-order Runge-Kutta
    deriv(x+.5*h*dx,p+.5*h*dp,dx2,dp2,d2);
    deriv(x+.5*h*dx2,p+.5*h*dp2,dx3,dp3,d3);
    deriv(x+h*dx3,p+h*dp3,dx4,dp4,d4);
    vec3 xn=x+h/6.*(dx+2.*dx2+2.*dx3+dx4), pn=p+h/6.*(dp+2.*dp2+2.*dp3+dp4), sd=xn-x;
    float Tn=T-h*dt, sl=length(sd), tb=2.; int bk=-1;
    if(r<uRing) ling+=length(cross(x,xn))/(length(x)*length(xn)); // angle swept round the hole while close in
    if(uProbe<.5 && uNB>0){
      for(int j=0;j<6;j++){ if(j>=uNB) break; float t=hitBody(j,x,sd,sl); if(t<tb){ tb=t; bk=j; } } }
    if(x.y*xn.y<0. && uProbe<.5){
      float td=x.y/(x.y-xn.y);
      if(td<tb){ vec3 xc=mix(x,xn,td); float rr=dot(xc.xz,xc.xz)-uA*uA;
        if(rr>uRin*uRin && rr<ROUT*ROUT){
          vec4 dk=disk(xc,mix(p,pn,td),order,mix(T,Tn,td));
          col+=tr*dk.rgb*dk.a; tr*=1.-dk.a; order+=1.;
          if(tr<.004) break; } }
    }
    if(bk>=0){ col+=tr*shadeBody(bk,mix(x,xn,tb),sd/sl,p); break; }
    if(uVol>.5){ // glowing debris and the aiming guide, kept in a small 3D grid: gathered here, coloured once after the loop
      vec3 xm=.5*(x+xn), q=xm/vec3(28.8,12.,28.8)+.5;
      vec4 A=textureLod(uVolA,clamp(q,0.,1.),0.)*step(abs(q.x-.5),.5)*step(abs(q.y-.5),.5)*step(abs(q.z-.5),.5);
      float w=tr*A.g*sl; vW+=w; vT+=w*A.r; vX+=w*xm; vP+=w*p; vG+=tr*A.b*sl;
      tr*=1.-min(.6,A.g*sl*.8); }
    rp=r; x=xn; p=pn; T=Tn;
  }
  if(uProbe>2.5) return open?normalize(-ex)*.5+.5:vec3(0.); // test only: the direction on the sky this ray came from
  if(uProbe>.5) return vec3(open?1.:0.); // test only: escaped or captured
  if(vW>1e-4){ // debris: a black body at its temperature, shifted by its motion, the hole and the camera
    vec3 xm=vX/vW; float g=shift(xm,vP/vW,textureLod(uVolB,xm/vec3(28.8,12.,28.8)+.5,0.).rgb*2.-1.);
    col+=bb((1800.+9000.*vT/vW)*g)*min(pow(g,4.),40.)*vW*7.; }
  col+=vec3(.25,.6,1.)*vG*3.;
  if(open) col+=tr*sky(normalize(-ex),mix(1.,gW/(-gPt),uDop));
  return min(col,vec3(4000.));
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; float px=1./uRes.y, ling, n=0.; vec3 col=vec3(0);
  // Rings of light that circled the hole are thinner than a pixel. A ray that went more than half way round
  // marks such a pixel, and it is averaged over five rays so the rings do not sparkle.
  for(int k=0;k<5;k++){ col+=trace(uv+OFF[k]*px,ling); n+=1.; if(k==0 && (uProbe>.5 || ling<uLing)) break; }
  col/=n;
  if(uProbe<.5 && uEnc>.5) col=col/(1.+col);
  o=vec4(col,1.);
}`;

//@@OLD_POST@@
//@@OLD_PROG@@
let P; const tc=performance.now();
try{ P={scene:prog(SCENE),down:prog(DOWN),up:prog(UP),fin:prog(FINAL)}; }
catch(e){ console.error(e); $('fallback').style.display='grid'; return; }
const vaoQuad=gl.createVertexArray(); gl.bindVertexArray(vaoQuad);
//@@OLD_NOISE@@
// a 96 x 40 x 96 grid around the hole for glowing debris and the aiming guide: 28.8 x 12 x 28.8 r_s
const VX=96, VY=40, VZ=96, VN=VX*VY*VZ, volA=new Uint8Array(VN*4), volB=new Uint8Array(VN*4);
const vDen=new Float32Array(VN), vTem=new Float32Array(VN), vGui=new Float32Array(VN), vVx=new Float32Array(VN), vVy=new Float32Array(VN), vVz=new Float32Array(VN);
volB.fill(127);
const volTex=[volA,volB].map(buf=>{ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D,t);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,VX,VY,VZ,0,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  for(const w of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D,w,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); return t; });
// The real sky: every catalogue star brighter than magnitude 6.5, drawn once into a 4096 x 2048 map of the whole
// sky (longitude by latitude in the scene's axes), which the ray tracer looks up where each ray ends.
const starTex=gl.createTexture();
{ const SW=4096, SH=2048, px=new Uint8Array(SW*SH*4), raw=atob(STARS), R=SKY_ROT, n=raw.length/6, clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const bbJS=T=>{ const t=clamp(T,1000,40000)/100; // the shader's black-body colour
    const r=t<=66?1:1.292936*Math.pow(t-60,-.1332047), g=t<=66?.3900816*Math.log(t)-.6318414:1.1298909*Math.pow(t-60,-.0755148), b=t>=66?1:(t<=19?0:.5432068*Math.log(t-10)-1.1962541);
    return [r,g,b].map(c=>Math.pow(clamp(c,0,1),2.2)); };
  for(let i=0;i<n;i++){ const o=i*6, c=k=>raw.charCodeAt(o+k);
    const ra=(c(0)*256+c(1))/65535*2*Math.PI, dec=(c(2)*256+c(3))/65535*Math.PI-Math.PI/2, mag=c(4)/25-2, bv=c(5)/100-.5;
    const e=[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)], d=[0,1,2].map(j=>R[j*3]*e[0]+R[j*3+1]*e[1]+R[j*3+2]*e[2]);
    const T=4600*(1/(.92*bv+1.7)+1/(.92*bv+.62)), col=bbJS(T), I=9*Math.pow(10,-.4*mag)/40; // temperature from colour (Ballesteros 2012); brightness from magnitude
    const fx=(Math.atan2(d[2],d[0])/(2*Math.PI)+.5)*SW, fy=(Math.asin(clamp(d[1],-1,1))/Math.PI+.5)*SH, wide=Math.min(8,1/Math.max(.05,Math.sqrt(1-d[1]*d[1]))), kx=Math.ceil(2*wide);
    for(let dy=-2;dy<=2;dy++) for(let dx=-kx;dx<=kx;dx++){ const X=Math.floor(fx)+dx, Y=Math.floor(fy)+dy; if(Y<0||Y>=SH) continue;
      const ux=(X+.5-fx)/wide, uy=Y+.5-fy, w=Math.exp(-(ux*ux+uy*uy)/1.1), q=(((X%SW)+SW)%SW+Y*SW)*4;
      for(let k=0;k<3;k++){ const v=Math.sqrt(Math.min(1,col[k]*I*w))*255; if(v>px[q+k]) px[q+k]=v; } }
    if(mag<2.3){ const L=Math.round(9+9*(2.3-mag)); // the brightest stars get the four spikes a telescope's mirror supports give them
      for(let t=-L;t<=L;t++){ if(!t) continue; const w=Math.pow(1-Math.abs(t)/(L+1),2.2)*.3;
        for(const [X,Y] of [[Math.floor(fx+t*wide),Math.floor(fy)],[Math.floor(fx),Math.floor(fy)+t]]){ if(Y<0||Y>=SH) continue; const q=(((X%SW)+SW)%SW+Y*SW)*4;
          for(let k=0;k<3;k++){ const v=Math.sqrt(Math.min(1,col[k]*I*w))*255; if(v>px[q+k]) px[q+k]=v; } } } } }
  gl.bindTexture(gl.TEXTURE_2D,starTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,SW,SH,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); }
// Telescope images of nebulae, one layer each, loaded after the first frames so the page starts at once.
// A picture has a frame and space does not. nebMatte writes each image's opacity into its alpha channel so it fades out
// along an uneven edge that follows its own bright gas (wide where the picture is dim, narrow where it is bright),
// and takes off the image's own background level so its dark parts match the sky.
function nebMatte(px,S,seed){ const G=64, c=S/G, lum=new Float32Array(G*G), ch=[[],[],[]];
  for(let y=0;y<G;y++) for(let x=0;x<G;x++){ let r=0,g=0,b=0,k=0;
    for(let v=0;v<c;v+=4) for(let u=0;u<c;u+=4){ const q=(Math.floor(y*c+v)*S+Math.floor(x*c+u))*4; r+=px[q]; g+=px[q+1]; b+=px[q+2]; k++; }
    ch[0].push(r/k); ch[1].push(g/k); ch[2].push(b/k); lum[y*G+x]=(r+g+b)/k/765; }
  const floor=ch.map(a=>a.slice().sort((p,q)=>p-q)[Math.floor(G*G*.03)]);
  let bl=lum, near=lum; for(let pass=0;pass<3;pass++){ const o=new Float32Array(G*G); // blurred brightness: where the gas is
    for(let y=0;y<G;y++) for(let x=0;x<G;x++){ let a=0,k=0; for(let v=-3;v<=3;v++) for(let u=-3;u<=3;u++){ const X=x+u,Y=y+v; if(X<0||Y<0||X>=G||Y>=G) continue; a+=bl[Y*G+X]; k++; } o[y*G+x]=a/k; } bl=o; if(!pass) near=o; }
  let mx=1e-6, mn=1e-6; for(const v of bl) mx=Math.max(mx,v); for(const v of near) mn=Math.max(mn,v);
  let t=seed*2654435761>>>0; const rnd=()=>{ t=t+0x6D2B79F5|0; let r=Math.imul(t^t>>>15,1|t); r=r+Math.imul(r^r>>>7,61|r)^r; return ((r^r>>>14)>>>0)/4294967296; };
  const L=16, lat=Float32Array.from({length:L*L},rnd), sm=f=>f*f*(3-2*f);
  const vn=(x,y)=>{ const X=Math.floor(x),Y=Math.floor(y),fx=sm(x-X),fy=sm(y-Y),at=(a,b)=>lat[((b%L+L)%L)*L+((a%L+L)%L)]; return (at(X,Y)*(1-fx)+at(X+1,Y)*fx)*(1-fy)+(at(X,Y+1)*(1-fx)+at(X+1,Y+1)*fx)*fy; };
  const A=new Float32Array(G*G); let kept=0;
  for(let y=0;y<G;y++) for(let x=0;x<G;x++){ const qx=(x+.5)/G*2-1, qy=(y+.5)/G*2-1;
    const e=Math.max(0,1-Math.hypot(Math.max(Math.abs(qx)-.3,0),Math.max(Math.abs(qy)-.3,0))/.7); // 0 at the frame, 1 in the middle
    const nz=.6*vn(x/G*3+7,y/G*3+3)+.4*vn(x/G*7+1,y/G*7+9), b=bl[y*G+x]/mx;
    const w=(.18+.8*nz)*(1.3-.6*b), a=sm(Math.min(1,e/w)); const wisp=Math.min(1,Math.max(0,near[y*G+x]/mn*2.6-.12)); A[y*G+x]=a*(wisp+(1-wisp)*a*a); /* in the fade, bright filaments outlast the dark gaps between them */ kept+=A[y*G+x]; }
  for(let y=0;y<S;y++){ const gy=Math.min(G-1.001,Math.max(0,(y+.5)/c-.5)), Y=Math.floor(gy), fy=gy-Y;
    for(let x=0;x<S;x++){ const gx=Math.min(G-1.001,Math.max(0,(x+.5)/c-.5)), X=Math.floor(gx), fx=gx-X, q=(y*S+x)*4;
      const a=(A[Y*G+X]*(1-fx)+A[Y*G+X+1]*fx)*(1-fy)+(A[Y*G+G+X]*(1-fx)+A[Y*G+G+X+1]*fx)*fy;
      px[q]=Math.max(0,px[q]-floor[0]); px[q+1]=Math.max(0,px[q+1]-floor[1]); px[q+2]=Math.max(0,px[q+2]-floor[2]); px[q+3]=a*255; } }
  const tint=[0,0,0,0]; let tk=0; // the colour of the picture's outer band, for the invented haze drawn around it
  for(let y=0;y<G;y++) for(let x=0;x<G;x++){ if(Math.min(x,y,G-1-x,G-1-y)>5) continue; for(let j=0;j<3;j++) tint[j]+=Math.max(0,ch[j][y*G+x]-floor[j])/255; tk++; }
  for(let j=0;j<3;j++) tint[j]=+Math.pow(tint[j]/tk,2).toFixed(4);
  let edge=0,k=0; for(let i=0;i<G;i++){ edge+=lum[i]+lum[(G-1)*G+i]+lum[i*G]+lum[i*G+G-1]; k+=4; }
  return {tint, floor:floor.map(Math.round), edge:+(edge/k).toFixed(3), mean:+(lum.reduce((p,q)=>p+q,0)/G/G).toFixed(3), kept:+(kept/G/G).toFixed(3)}; }
const NEB_N=NEBULAE.length, NEB_S=Math.min(1536,gl.getParameter(gl.MAX_TEXTURE_SIZE)), nebTex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D_ARRAY,nebTex); gl.texStorage3D(gl.TEXTURE_2D_ARRAY,Math.floor(Math.log2(NEB_S))+1,gl.RGBA8,NEB_S,NEB_S,NEB_N);
gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const nebC=new Float32Array(48), nebR=new Float32Array(48), nebU=new Float32Array(48), nebG=new Float32Array(48), nebT=new Float32Array(48), nebS=new Float32Array(48); let nebLoaded=0, nebOn=0;
NEBULAE.forEach((n,i)=>{ // where it is, and which way up, from the coordinates published with the image
  const d2r=Math.PI/180, ra=n.ra*d2r, dec=n.dec*d2r, X=n.north*d2r, R=SKY_ROT, rot=e=>[0,1,2].map(j=>R[j*3]*e[0]+R[j*3+1]*e[1]+R[j*3+2]*e[2]);
  const c=rot([Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)]), N=rot([-Math.sin(dec)*Math.cos(ra),-Math.sin(dec)*Math.sin(ra),Math.cos(dec)]), E=rot([-Math.sin(ra),Math.cos(ra),0]);
  const up=[0,1,2].map(j=>N[j]*Math.cos(X)-E[j]*Math.sin(X)), right=[0,1,2].map(j=>-E[j]*Math.cos(X)-N[j]*Math.sin(X)); // east is to the left on the sky
  const tw=Math.tan(n.half*d2r), th=tw*n.fov[1]/n.fov[0];
  nebC.set([c[0],c[1],c[2],Math.cos(Math.min(1.2,2.8*Math.atan(Math.hypot(tw,th))))],i*4); /* w: how far out its haze is drawn */ nebR.set([right[0],right[1],right[2],1/tw],i*4); nebU.set([up[0],up[1],up[2],1/th],i*4);
  nebG.set([1.5,Math.log2(NEB_S/(2*tw)),.5,.5],i*4); n.dir=c;
  setTimeout(()=>{ const img=new Image(); img.onload=()=>{ const S=NEB_S, cv=document.createElement('canvas'); cv.width=cv.height=S;
      const cx=cv.getContext('2d',{willReadFrequently:true}); cx.translate(0,S); cx.scale(1,-1); cx.drawImage(img,0,0,S,S); // drawn upside down: the texture's first row is the bottom
      const px=cx.getImageData(0,0,S,S).data; n.matte=nebMatte(px,S,i+1); nebT.set(n.matte.tint,i*4);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY,nebTex); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,S,S,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(px.buffer));
      if(++nebLoaded===NEB_N) gl.generateMipmap(gl.TEXTURE_2D_ARRAY); }; img.src=NEBULA_IMG[i]; },900+250*i);
});
/* Each nebula as a cloud of points. One point per pixel of the picture (at a size to suit the screen), each given a depth
   that is invented: brighter gas nearer, a slow random field, a little scatter, and for the three ring-shaped nebulae a
   hollow shell. The points are drawn from where the camera is into that nebula's own layer, in linear light, and the ray
   tracer reads the layer where each ray ends, so the cloud is still bent by the hole. Moving the camera slides near and far
   points past each other. The middle depth does not move, so the nebula stays at its real place on the sky. */
const NEB_R=1024, NEB_FRAME=1.3, NEB_SHELL={heic1310a:.62,opo0432d:.78,heic0414a:.5}, NEB_DEPTH=[.22];
let nebFloat=!!gl.getExtension('EXT_color_buffer_float'), nebP=null, nebFbo=null, NP=null;
const NVS=`#version 300 es
precision highp float; precision highp sampler2DArray; precision highp sampler3D;
uniform sampler2DArray uNeb; uniform sampler3D uNoise;
uniform float uLayer,uMip,uPG,uSize,uShell,uGain,uMote; uniform vec2 uShift;
out vec3 vC;
void main(){
  float id=float(gl_VertexID), ix=mod(id,uPG), iy=floor(id/uPG);
  ivec3 hc=ivec3(int(ix)&31,int(iy)&31,((int(ix)>>5)*5+(int(iy)>>5)*11)&31); /* three random numbers for this point, from the block of random bytes */
  float ra=texelFetch(uNoise,hc,0).r, rb=texelFetch(uNoise,ivec3(hc.xy,(hc.z+13)&31),0).r, rc=texelFetch(uNoise,ivec3(hc.yx,(hc.z+7)&31),0).r;
  if(uMote>.5){ /* invented stars scattered through and beyond the cloud's depth, only where the cloud is */
    vec2 q=vec2(ra,rb)*2.-1.; float z=(rc-.5)*6., k=texelFetch(uNoise,ivec3(hc.yx,(hc.z+19)&31),0).r;
    float m=textureLod(uNeb,vec3(q*.5+.5,uLayer),4.).a;
    gl_Position=vec4((q+uShift*z)/${NEB_FRAME.toFixed(2)},0.,1.); gl_PointSize=uSize;
    vC=mix(vec3(1.,.82,.6),vec3(.7,.82,1.),ra)*uGain*k*k*k*m*(abs(z)>1.25?1.:0.); return; }
  vec4 t=texelFetch(uNeb,ivec3(int(ix),int(iy),int(uLayer)),int(uMip));
  vec2 uv=(vec2(ix,iy)+.5)/uPG, q=uv*2.-1.;
  float ls=dot(textureLod(uNeb,vec3(uv,uLayer),6.5).rgb,vec3(.3333)), ll=dot(textureLod(uNeb,vec3(uv,uLayer),4.5).rgb,vec3(.3333));
  float z=(ls-.3)*1.7+(ll-ls)*.9+(textureLod(uNoise,vec3(uv*.12+uLayer*.13,uLayer*.37),0.).r-.5)*.9;
  if(uShell>0.){ float r=length(q)/uShell; if(r<1.) z=mix(z,(rc<.5?-1.:1.)*sqrt(1.-r*r),.8); }
  z=clamp(z+(rc-.5)*.07,-1.2,1.2);
  q+=(vec2(ra,rb)-.5)*2.4/uPG; /* off the grid, so sheared rows of points do not beat against the pixels */
  gl_Position=vec4((q+uShift*z)/${NEB_FRAME.toFixed(2)},0.,1.); gl_PointSize=uSize;
  vC=t.rgb*t.rgb*t.a*uGain;
}`, NFS=`#version 300 es
precision highp float; in vec3 vC; out vec4 o;
void main(){ vec2 d=gl_PointCoord-.5; o=vec4(vC*exp(-8.*dot(d,d)),1.); }`;
if(nebFloat) try{ NP=prog(NFS,NVS);
  nebP=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY,nebP); gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.R11F_G11F_B10F,NEB_R,NEB_R,NEB_N);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  nebFbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,nebFbo); gl.framebufferTextureLayer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,nebP,0,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) nebFloat=false; gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}catch(e){ nebFloat=false; }
let nebTurn=0, nebPts=0;
function nebDraw(C){
  if(!nebFloat){ for(let i=0;i<NEB_N;i++) nebT[i*4+3]=1; return; }
  if(nebLoaded<NEB_N) return;
  const U=NP.u, px=C.focal*H, cone=Math.atan(.5*Math.hypot(W,H)/px), cl=Math.hypot(C.x[0],C.x[1],C.x[2]), sc=-NEB_DEPTH[0]/(cl+20);
  gl.bindFramebuffer(gl.FRAMEBUFFER,nebFbo); gl.useProgram(NP.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.clearColor(0,0,0,0);
  gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D_ARRAY,nebTex); gl.uniform1i(U.uNeb,7);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_3D,noiseTex); gl.uniform1i(U.uNoise,3);
  nebTurn++; nebPts=0;
  for(let i=0;i<NEB_N;i++){ const n=NEBULAE[i], tw=1/nebR[i*4+3], th=1/nebU[i*4+3];
    const sx=sc*kdot(C.x,[nebR[i*4],nebR[i*4+1],nebR[i*4+2]]), sy=sc*kdot(C.x,[nebU[i*4],nebU[i*4+1],nebU[i*4+2]])*tw/th; /* sideways shift per unit of depth, in half-widths of the picture */
    nebS[i*4]=1.6*sx; nebS[i*4+1]=1.6*sy; /* the haze sits 1.6 depths behind */
    const seen=Math.acos(clamp(kdot(n.dir,C.f),-1,1))<cone+2*NEB_FRAME*Math.atan(tw);
    let R=NEB_R; while(R>128 && R*.5>=2*NEB_FRAME*tw*px) R>>=1; /* about one layer pixel per screen pixel */
    if(!seen){ R=Math.min(R,256); if(n.R && (nebTurn+i)%4) continue; } /* off screen (or only seen bent round the hole): smaller, and one frame in four */
    const m=Math.log2(NEB_R/R), PG=(NEB_S>>1)>>m, sp=R/(NEB_FRAME*PG), size=4;
    gl.framebufferTextureLayer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,nebP,0,i); gl.viewport(0,0,NEB_R,NEB_R); gl.clear(gl.COLOR_BUFFER_BIT); gl.viewport(0,0,R,R);
    gl.uniform1f(U.uLayer,i); gl.uniform1f(U.uMip,1+m); gl.uniform1f(U.uPG,PG); gl.uniform1f(U.uSize,size); gl.uniform1f(U.uShell,NEB_SHELL[n.id]||0);
    gl.uniform1f(U.uGain,1.5*sp*sp/(size*size*.3396)); /* so that overlapping points add up to the picture's own brightness */
    gl.uniform2f(U.uShift,sx,sy); gl.uniform1f(U.uMote,0);
    gl.drawArrays(gl.POINTS,0,PG*PG); nebPts+=PG*PG;
    gl.uniform1f(U.uMote,1); gl.uniform1f(U.uPG,32); gl.uniform1f(U.uSize,Math.max(2,R/200)); gl.uniform1f(U.uGain,.55); gl.drawArrays(gl.POINTS,0,1024);
    n.R=R; nebG[i*4]=1; nebG[i*4+2]=.5/NEB_FRAME*R/NEB_R; nebG[i*4+3]=.5*R/NEB_R; nebT[i*4+3]=NEB_FRAME; }
  gl.disable(gl.BLEND);
}
const compileMs=Math.round(performance.now()-tc);

//@@OLD_TARGETS@@
/* ---------- state ---------- */
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const S={ az:.9, el:.14, dist:reduce?30:36, tAz:.9, tEl:.14, tDist:30, spin:.9, look:false, ly:0, lp:0, lz:1,
          focal:1.7, grav:reduce?1:0, tGrav:1, dop:1, tDop:1, pred:0, tPred:0, fade:reduce?1:0, time:0, touched:false };
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit3=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return a.map(x=>x/l); };
const rnd=(a,b)=>a+Math.random()*(b-a);
// the hole: mass scaled by the gravity switch, spin as a fraction of the most a hole of that mass can have
function setHole(){ K.M=.5*Math.max(S.grav,1e-4); K.a=S.spin*K.M; }
let RIN=3, RPH=1.5; const flux=new Float32Array(32);
function setSpin(s){ // things that depend on the spin alone, worked out at full gravity
  S.spin=s; K.M=.5; K.a=s*.5; RIN=kisco(); RPH=2*K.M*(1+Math.cos(2/3*Math.acos(s)));
  let mx=0; for(let i=0;i<32;i++){ const q=i/31; flux[i]=kflux(RIN+(ROUT-RIN)*q*q); mx=Math.max(mx,flux[i]); }
  // brightness scale: the same at 4.78 r_s for every spin (where a hole without spin is brightest), so spin shows as a hotter inner disk
  mx=kflux(4.776); for(let i=0;i<32;i++) flux[i]/=mx;
  for(const b of bodies.concat(bits)) rebase(b);
  if(ride) rebase(ride.b);
  setHole(); clearTimeout(checkT); checkT=setTimeout(selfCheck,250);
}
let checkT=0;

/* ---------- input ---------- */
let dragging=false, lx=0, ly=0, lastInput=-1e9;
let downX=0, downY=0, downT=0, moved=false, aim=null, holdT=0, ride=null;
canvas.addEventListener('pointerdown',e=>{ dragging=true; lx=downX=e.clientX; ly=downY=e.clientY; downT=performance.now(); moved=false; try{ canvas.setPointerCapture(e.pointerId); }catch(_){} canvas.classList.add('drag'); touch();
  clearTimeout(holdT); if(ride) return; if(e.shiftKey) startAim(); else holdT=setTimeout(()=>{ if(dragging&&!moved&&!ride) startAim(); },300); });
canvas.addEventListener('pointermove',e=>{ if(!dragging) return;
  if(aim){ aim.x=e.clientX; aim.y=e.clientY; return; }
  if(Math.hypot(e.clientX-downX,e.clientY-downY)>5){ moved=true; clearTimeout(holdT); }
  if(ride){ const k=.0022/ride.zoom; ride.yaw-=(e.clientX-lx)*k; ride.pitch=clamp(ride.pitch+(e.clientY-ly)*k,-1.45,1.45); lx=e.clientX; ly=e.clientY; return; } // riding: look around
  if(S.look){ lookTo=lookNeb=null; const k=.0027/(S.focal*S.lz); S.ly-=(e.clientX-lx)*k; S.lp=clamp(S.lp+(e.clientY-ly)*k,-1.5,1.5); lx=e.clientX; ly=e.clientY; lastInput=performance.now(); return; } // looking around: turn the camera where it stands
  S.tAz-=(e.clientX-lx)*.0052; S.tEl=clamp(S.tEl+(e.clientY-ly)*.0042,-1.45,1.45); lx=e.clientX; ly=e.clientY; lastInput=performance.now(); });
const end=()=>{ dragging=false; aim=null; clearTimeout(holdT); canvas.classList.remove('drag','aim'); };
canvas.addEventListener('pointerup',e=>{ const a=aim, click=dragging&&!moved&&performance.now()-downT<500; end();
  if(ride) return;
  if(a && Math.hypot(a.x-a.x0,a.y-a.y0)>=8) fire(a); else if(a||click) launch(downX,downY); });
canvas.addEventListener('pointercancel',end);
canvas.addEventListener('wheel',e=>{ e.preventDefault(); if(ride){ ride.zoom=clamp(ride.zoom*Math.exp(-e.deltaY*.0011),.35,2.2); return; } if(S.look){ if(lookTo) lookTo[2]=clamp(lookTo[2]*Math.exp(-e.deltaY*.0011),.4,10); S.lz=clamp(S.lz*Math.exp(-e.deltaY*.0011),.4,10); touch(); return; } S.tDist=clamp(S.tDist*Math.exp(e.deltaY*.0011),3,600); lastInput=performance.now(); touch(); },{passive:false});
function touch(){ if(!S.touched){ S.touched=true; $('hint').classList.add('gone'); } lastInput=performance.now(); }

function toggle(btn,fn){ const on=btn.getAttribute('aria-pressed')!=='true'; btn.setAttribute('aria-pressed',on); fn(on); touch(); }
$('bG').onclick=()=>toggle($('bG'),on=>{ S.tGrav=on?1:0; if(!on&&ride) ride.leave=true; });
$('bR').onclick=()=>{ if(ride) ride.leave=true; else startRide(); };
$('bD').onclick=()=>toggle($('bD'),on=>S.tDop=on?1:0);
$('bP').onclick=()=>toggle($('bP'),on=>S.tPred=on?1:0);
$('bS').onclick=()=>toggle($('bS'),on=>sound(on));
$('bN').onclick=()=>toggle($('bN'),on=>document.body.classList.toggle('readout',on));
let nebI=-1, lookTo=null, lookNeb=null; const CREDIT0=$('credit').textContent;
function baseView(){ const el=Math.abs(S.el)<.012?(S.el<0?-.012:.012):S.el, ce=Math.cos(el), f=[-ce*Math.cos(S.az),-Math.sin(el),-ce*Math.sin(S.az)], r=unit3([-f[2],0,f[0]]); return {f,r,u:cross3(r,f)}; }
$('bT').onclick=()=>{ if(ride) return; if(!S.look) $('bL').click(); nebI=(nebI+1)%NEBULAE.length; const n=NEBULAE[nebI], B=baseView();
  lookTo=[Math.atan2(kdot(n.dir,B.r),kdot(n.dir,B.f)),Math.asin(clamp(kdot(n.dir,B.u),-1,1)),1.25]; lookNeb=n; note(n.name,6); touch(); };
$('bL').onclick=()=>toggle($('bL'),on=>{ S.look=on; lookTo=lookNeb=null; if(on) note('Drag to look around  ·  Scroll to zoom the telescope  ·  L to return',7); else note(''); });
$('spin').oninput=e=>{ setSpin(+e.target.value); $('spinV').textContent=(+e.target.value).toFixed(2); touch(); };
const controls=$('controls');
$('bC').onclick=()=>{ const o=!controls.classList.contains('open'); controls.classList.toggle('open',o); $('bC').setAttribute('aria-expanded',o); };
let launchSel='any', launchN=0;
document.querySelectorAll('[data-launch]').forEach(b=>b.onclick=()=>{ launchSel=b.dataset.launch;
  document.querySelectorAll('[data-launch]').forEach(x=>x.setAttribute('aria-pressed',x===b)); });
$('bX').onclick=()=>{ bodies.length=0; bits.length=0; };
const panel=$('panel');
function openPanel(o){ panel.classList.toggle('open',o); $('bH').setAttribute('aria-expanded',o); if(o) $('close').focus(); else $('bH').focus(); }
$('bH').onclick=()=>openPanel(!panel.classList.contains('open'));
$('close').onclick=()=>openPanel(false);
window.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.target===$('spin')) return;
  const k=e.key.toLowerCase();
  if(k==='g') $('bG').click(); else if(k==='d') $('bD').click(); else if(k==='p') $('bP').click();
  else if(k==='s') $('bS').click(); else if(k==='x') $('bX').click(); else if(k==='l') $('bL').click(); else if(k==='n') $('bT').click(); else if(k==='r') $('bR').click(); else if(k==='escape'){ if(ride) ride.leave=true; else if(aim||dragging) end(); else if(panel.classList.contains('open')) openPanel(false); }
});

/* ---------- the same stepping rule in JavaScript, checked against exact values ---------- */
// A ray coming in from far away in the disk's plane, passing at distance b: positive b goes round with the spin.
function fromFar(b){ const D=300, x=[-D,0,b], dir=[1,0,0], l=[0,0,0], r=kfl(x,l), f=kf(x,r), ld=kdot(l,dir);
  const A=f-1, B=2*f*ld, C=1+f*ld*ld, kt=(-B-Math.sqrt(B*B-4*A*C))/(2*A), p=[0,0,0]; let pt=klower(x,kt,dir,p);
  const s=-1/pt; p[0]*=s; p[1]*=s; p[2]*=s; pt=-1; const rc=kcap(), rh=khor(); let prev=r;
  for(let i=0;i<4000;i++){ const rr=kr(x); if(rr<rc && rr<prev) return true; if(rr>D+1) return false; prev=rr; kstep(x,p,pt,Math.max(.02,.1*(rr-.75*rh))); }
  return true; }
function selfCheck(){
  const M0=K.M, a0=K.a; K.M=.5; K.a=S.spin*.5;
  const crit=sg=>{ let lo=.6, hi=4.5; for(let i=0;i<30;i++){ const m=.5*(lo+hi); if(fromFar(sg*m)) lo=m; else hi=m; } return .5*(lo+hi); };
  const exact=sg=>{ if(!K.a) return Math.sqrt(27)/2; const r=2*K.M*(1+Math.cos(2/3*Math.acos(-sg*S.spin))); return Math.abs((r*r*r-3*K.M*r*r+K.a*K.a*r+K.a*K.a*K.M)/(K.a*(r-K.M))); };
  $('cB').textContent=crit(1).toFixed(4); $('cBx').textContent=exact(1).toFixed(4);
  $('cD').textContent=crit(-1).toFixed(4); $('cDx').textContent=exact(-1).toFixed(4);
  K.M=M0; K.a=a0;
}

//@@OLD_SOUND@@
function soundTick(){
  if(!AC||AC.state!=='running') return;
  const C=camera(), near=clamp((60-C.D)/58,0,1);
  filt.frequency.setTargetAtTime(520+2400*near*near*near,AC.currentTime,.3);
  const clock=clamp(1/C.E[0][0],.06,1), bend=.35+.65*S.grav; // pitch falls with the camera's clock rate
  oscs.forEach(x=>x.o.frequency.setTargetAtTime(x.f*clock*bend,AC.currentTime,.4));
}

/* ---------- camera ---------- */
function orbitCamera(){
  const el=Math.abs(S.el)<.012?(S.el<0?-.012:.012):S.el;
  const ce=Math.cos(el), x=[S.dist*ce*Math.cos(S.az), S.dist*Math.sin(el), S.dist*ce*Math.sin(S.az)];
  const f0=x.map(v=>-v/S.dist), r0=unit3([-f0[2],0,f0[0]]), u0=cross3(r0,f0);
  // looking around: the camera stays where it is and turns, and the scroll wheel becomes a telescope's zoom
  const cy=Math.cos(S.ly), sy=Math.sin(S.ly), cp=Math.cos(S.lp), sp=Math.sin(S.lp);
  const f=[0,1,2].map(i=>cp*(cy*f0[i]+sy*r0[i])+sp*u0[i]), r=[0,1,2].map(i=>cy*r0[i]-sy*f0[i]), u=cross3(r,f);
  return {x,r,u,f,focal:S.focal*S.lz};
}
// An observer's frame for a camera at x with four-velocity U, facing f with r to its right and u up. The frame is first
// built from the local directions (toward the hole, along the spin axis), then turned, so turning the view is an exact rotation.
function frameAt(x,U,r,u,f){
  const D=Math.hypot(x[0],x[1],x[2]), f0=x.map(v=>-v/D); let u0=[-f0[0]*f0[1],1-f0[1]*f0[1],-f0[2]*f0[1]];
  if(Math.hypot(u0[0],u0[1],u0[2])<.02) u0=[1-f0[0]*f0[0],-f0[1]*f0[0],-f0[2]*f0[0]];
  u0=unit3(u0); const s=[cross3(f0,u0),u0,f0], E0=kframe(x,U,s), E=[E0[0]];
  for(const w of [r,u,f]){ const c=s.map(q=>kdot(w,q)); E.push([0,1,2,3].map(m=>c[0]*E0[1][m]+c[1]*E0[2][m]+c[2]*E0[3][m])); }
  return E;
}
function camera(){
  if(ride) return rideCamera();
  const C=orbitCamera(); C.D=S.dist; C.E=frameAt(C.x,khover(C.x),C.r,C.u,C.f); return C;
}
// where on screen (CSS pixels) the camera sees a photon with covariant momentum (pt, p); null if behind it
function onScreen(C,pt,p){ const d=kseen(C.E,pt,p).d; if(d[2]<.05) return null;
  return [cssW/2+C.focal*d[0]/d[2]*cssH, cssH/2-C.focal*d[1]/d[2]*cssH]; }
// the ray behind a screen point, traced backward: stop(x) ends it early. Returns the last position, or null if the hole took it.
function castRay(C,cx,cy,stop){
  const d=unit3([(cx-cssW/2)/cssH,-(cy-cssH/2)/cssH,C.focal]), p=[0,0,0]; let pt=kphoton(C.x,C.E,d,p);
  const s=1/Math.hypot(p[0],p[1],p[2]); p[0]*=s; p[1]*=s; p[2]*=s; pt*=s; if(pt>-1e-6) return null;
  const x=C.x.slice(), rc=kcap(), rh=khor(), dd=new Float64Array(7); let prev=-1;
  for(let i=0;i<600;i++){ const r=kr(x); if(r<rc && r<prev) return null; if(r>Math.max(40,C.D*1.4)) return x; prev=r;
    kderiv(x,p,pt,dd); const h=-Math.max(.03,.1*(r-.75*rh))/Math.max(1e-3,Math.hypot(dd[0],dd[1],dd[2])), y=x.slice();
    kstep(x,p,pt,h); if(stop(y,x)) return x; }
  return x;
}

/* ---------- launched objects: free fall, drag from the disk, tides, and the delay of their light ---------- */
/*<phys>*/
const KINDS=['meteor','planet','star','rocket'], RADIUS=[.22,.55,.85,.13];
// Tides: a body held together by its own gravity comes apart where the hole's pull across it beats that gravity,
// at about (3 M_hole / 4 pi density)^(1/3). For a hole of 4.3 million Suns (r_s = 12.7 million km):
const HOLE_KG=4.3e6*1.989e30, RS_M=2*6.674e-11*HOLE_KG/8.988e16, DENSITY=[0,5514,1408,0]; // kg per cubic metre: Earth, the Sun
const TIDE=DENSITY.map(d=>d?Math.cbrt(3*HOLE_KG/(4*Math.PI*d))/RS_M:0); // in r_s. 0: a meteor or a rocket is held by the strength of its material
const DRAG=[4,5,9,4,2.5];   // time for the disk to drag it to the gas speed, in r_s/c. Last entry: debris
const NBITS=[0,210,340,0], SLAB=.35, INFLOW=.15, HEAT=70, MAXP=900;
const bodies=[], bits=[], _d=new Float64Array(7);
// coordinate velocity dx/dt of a body, and its time rate dt/dtau
function velocity(b){ kderiv(b.x,b.p,b.pt,_d); return [_d[0]/_d[6],_d[1]/_d[6],_d[2]/_d[6]]; }
function setVelocity(b,v){ const ut=kut(b.x,v); if(!ut) return false; b.pt=klower(b.x,ut,[v[0]*ut,v[1]*ut,v[2]*ut],b.p); return true; }
function rebase(b){ const v=b.v0||velocity(b); setVelocity(b,v); } // after the hole changes: keep the velocity, renew the momentum
// how long light takes from b to c, in far-away time: straight-line time, the first-order delay from the hole's
// gravity, and the exact extra time light needs to climb away from just outside the horizon
function delay(c,b){ const rc=kr(c), rb=kr(b), rh=khor(), d=Math.hypot(c[0]-b[0],c[1]-b[1],c[2]-b[2]), M2=2*K.M;
  let T=d+M2*Math.min(3,Math.log((rc+rb+d)/Math.max(1e-9,rc+rb-d)));
  if(rc>rb){ if(rb<=rh) return Infinity; T+=M2*Math.log((rc-rh)/(rb-rh)); }
  return T; }
function spawn(kind,x,v){
  const b={kind,x,p:[0,0,0],pt:-1,age:0,seed:Math.random(),heat:0,dv:0,t:0};
  if(!setVelocity(b,v)) setVelocity(b,[0,0,0]);
  b.t=S.time-delay(camX,x); bodies.push(b);
  const slots=()=>bodies.reduce((n,b)=>n+(b.kind===3?2:1),0);
  while(slots()>6) bodies.shift();
  return b;
}
function toss(kind,P,alt){ // a plain click: prograde with the disk, at a random fraction of the circular-orbit speed
  const R=Math.hypot(P[0],P[1],P[2]), Rc=clamp(R,Math.max(4.5,TIDE[kind]+1.2),13), rh=P.map(x=>x/R), x=rh.map(v=>v*Rc);
  let th=cross3([0,1,0],rh), tl=Math.hypot(th[0],th[1],th[2]);
  if(tl<.2){ th=cross3(alt,rh); tl=Math.hypot(th[0],th[1],th[2]); }
  const [kt,kr_]=[[rnd(.35,.75),rnd(.2,.6)],[rnd(.6,.95),rnd(0,.12)],[rnd(.7,.98),rnd(0,.15)],[rnd(1.25,1.5),rnd(.3,.6)]][kind];
  const vc=komega(kr(x))*Rc;
  return spawn(kind,x,[0,1,2].map(i=>th[i]/tl*kt*vc-rh[i]*kr_*vc));
}
// One thing, advanced by dtc of far-away time (or of its own time, for the rider) in n Runge-Kutta steps.
function advance(b,dtc,n,tau){
  const x=b.x; let r=kr(x); b.dv=0; const rmin=b.own?rideStop():khor()*1.0005;
  for(let i=0;i<n;i++){
    kderiv(x,b.p,b.pt,_d); const h=b.own?dtc/n:dtc/n/Math.max(_d[6],1e-6);
    b.t+=kstep(x,b.p,b.pt,h);
    r=kr(x); if(r<rmin) break;
    // inside the disk the gas drags it toward the gas velocity: a circular orbit with a slow inward drift
    const q2=x[0]*x[0]+x[2]*x[2]-K.a*K.a;
    if(Math.abs(x[1])<SLAB && q2>RIN*RIN && q2<ROUT*ROUT){
      const v=velocity(b), g=kgas(x), q=Math.sqrt(x[0]*x[0]+x[2]*x[2]), gs=Math.hypot(g[0],g[2]), k=1-Math.exp(-h/tau);
      const dx=g[0]-INFLOW*gs*x[0]/q-v[0], dy=-v[1], dz=g[2]-INFLOW*gs*x[2]/q-v[2];
      b.dv=Math.hypot(dx,dy,dz);
      setVelocity(b,[v[0]+dx*k,v[1]+dy*k,v[2]+dz*k]);
    }
  }
  return r;
}
// each thing is drawn where it was when the light now reaching the camera left it: step it up to that moment
function catchUp(b,n,tau,most){ const want=S.time-delay(camX,b.x)-b.t; if(want>0) return advance(b,Math.min(want,most),n,tau); return kr(b.x); }
function addBit(x,v,T,rad,lum,life){
  const f={x,p:[0,0,0],pt:-1,T,rad,lum,life,age:0,hot:0,dv:0,t:S.time-delay(camX,x)}; if(!setVelocity(f,v)) return;
  bits.push(f); if(bits.length>MAXP) bits.splice(0,bits.length-MAXP);
}
function shred(b){ // tides: the body becomes pieces that keep its velocity but start at different points across it
  const R=RADIUS[b.kind], star=b.kind===2, v=velocity(b);
  for(let i=0;i<NBITS[b.kind];i++){
    let s; do{ s=[rnd(-1,1),rnd(-1,1),rnd(-1,1)]; }while(s[0]*s[0]+s[1]*s[1]+s[2]*s[2]>1);
    const z=rnd(.55,1.9);
    addBit(b.x.map((c,j)=>c+s[j]*R),v.slice(),star?5800*rnd(.8,1.25):rnd(2200,4200),(star?.15:.11)*z,(star?1:.85)/(z*z),rnd(170,320));
    bits[bits.length-1].t=b.t;
  }
}
function spark(b){ // disk gas heated where something ploughs through it
  const R=RADIUS[b.kind], x=[b.x[0]+rnd(-R,R),b.x[1]*.4+rnd(-.08,.08),b.x[2]+rnd(-R,R)], g=kgas(x), z=rnd(.6,1.8);
  addBit(x,[g[0],rnd(-.01,.01),g[2]],rnd(5500,9500),.08*z,.5/(z*z),rnd(25,60)); bits[bits.length-1].t=b.t;
}
function stepThings(dtc,dtReal){
  const most=dtc*4+.5, rh=khor();
  for(let j=bodies.length-1;j>=0;j--){ const b=bodies[j]; b.age+=dtReal;
    const r=catchUp(b,4,DRAG[b.kind],most);
    if(b.dv>.03){ b.heat+=b.dv*b.dv*dtc*HEAT; while(b.heat>1){ b.heat-=1; spark(b); } }
    if(TIDE[b.kind] && r<TIDE[b.kind] && b.age>.6 && S.grav>.5){ shred(b); bodies.splice(j,1); continue; }
    if(r<rh*1.004 || r>150 || b.age>300) bodies.splice(j,1);
  }
  for(let j=bits.length-1;j>=0;j--){ const f=bits[j]; f.age+=dtc;
    const r=catchUp(f,2,DRAG[4],most);
    f.hot=Math.max(f.hot*Math.exp(-dtc/14),Math.min(1,f.dv*2.5));
    if(r<rh*1.02 || r>70 || f.age>f.life) bits.splice(j,1);
  }
}
/*</phys>*/
let camX=[30,0,0]; // where the camera is, for the delay of light
// the point seen under the cursor, on the plane through the hole that faces the camera
function pick(cx,cy,C){
  const O=orbitCamera(), side=x=>kdot(x,O.f);
  let P=castRay(C,cx,cy,(a,b)=>side(a)<0&&side(b)>=0);
  if(!P || Math.abs(side(P))>1.5){ const x=(cx-cssW/2)/cssH, y=-(cy-cssH/2)/cssH, t=S.dist/S.focal; P=[0,1,2].map(i=>O.r[i]*x*t+O.u[i]*y*t); } // flat fallback
  const R=Math.hypot(P[0],P[1],P[2])||1, Rc=clamp(R,2.2,40); return P.map(v=>v/R*Rc);
}
const nextKind=()=>KINDS.indexOf(launchSel==='any'?KINDS[launchN%4]:launchSel);
function launch(cx,cy){ const C=camera(); toss(nextKind(),pick(cx,cy,C),C.f); launchN++; }

/* ---------- aiming: hold, then drag to set direction and speed ---------- */
const SPEED=.55; // a drag of this fraction of the window height means the speed of light
function startAim(){ const C=camera(); aim={x0:downX,y0:downY,x:downX,y:downY,kind:nextKind(),P:pick(downX,downY,C)}; canvas.classList.add('aim'); }
function aimVelocity(a,C){ // the drag as a speed measured by someone hovering at that spot, turned into a velocity
  const dx=a.x-a.x0, dy=-(a.y-a.y0), len=Math.hypot(dx,dy), beta=Math.min(.97,len/(SPEED*cssH));
  const w=len?unit3([0,1,2].map(i=>C.r[i]*dx+C.u[i]*dy)):C.r, U=khover(a.P), E=kframe(a.P,U,[w,C.f,cross3(w,C.f)]), g=1/Math.sqrt(1-beta*beta);
  const u=[0,1,2,3].map(m=>g*(U[m]+beta*E[1][m]));
  return {beta,v:[u[1]/u[0],u[2]/u[0],u[3]/u[0]]};
}
function fire(a){ spawn(a.kind,a.P.slice(),aimVelocity(a,camera()).v); launchN++; }
// the path the launch would take, from the same stepper the live object uses
function predict(kind,P,v){
  const b={kind,x:P.slice(),p:[0,0,0],pt:-1,dv:0,t:0}, pts=[P.slice()]; setVelocity(b,v);
  let fate='', rt=TIDE[kind]*(S.grav>.5?1:0);
  for(let i=0;i<1500 && !fate;i++){
    const r=advance(b,5.5/30,2,DRAG[kind]);
    if(i%3===2) pts.push(b.x.slice());
    if(rt && r<rt && i>18) fate='torn apart'; else if(r<khor()*1.03) fate='falls in'; else if(r>48) fate=-b.pt>=1?'escapes':'';
    if(r>48) break;
  }
  pts.push(b.x.slice());
  return {pts,fate};
}
function drawAim(){
  if(!aim) return;
  const C=camera(), {beta,v}=aimVelocity(aim,C), d=dpr, live=Math.hypot(aim.x-aim.x0,aim.y-aim.y0)>=8;
  const x0=aim.x0*d, y0=aim.y0*d;
  g2.lineWidth=1.25*d; g2.font=(11.5*d)+'px ui-monospace,Consolas,Menlo,monospace'; g2.textBaseline='middle';
  // dashed ring: drag this far, sideways, for a circular orbit
  const R=kr(aim.P), U=khover(aim.P), vc=kgas(aim.P), utc=kut(aim.P,vc);
  if(U && utc && R>=RIN && S.grav>.5){ const gam=-kip(aim.P,U,[utc,vc[0]*utc,vc[1]*utc,vc[2]*utc]), rc=SPEED*cssH*d*Math.sqrt(1-1/(gam*gam));
    g2.strokeStyle='rgba(244,236,221,.3)'; g2.setLineDash([3*d,5*d]); g2.beginPath(); g2.arc(x0,y0,rc,0,Math.PI*2); g2.stroke(); g2.setLineDash([]);
    g2.fillStyle='rgba(244,236,221,.5)'; g2.fillText('orbit speed',x0+rc*.72+6*d,y0+rc*.72+6*d); }
  g2.strokeStyle='#ffb469'; g2.beginPath(); g2.arc(x0,y0,7*d,0,Math.PI*2); g2.stroke();
  if(!live){ g2.fillStyle='#ffb469'; g2.fillText('drag to set direction and speed',x0+16*d,y0); aim.path=null; return; }
  const P=predict(aim.kind,aim.P,v); aim.path=P.pts; // the path is drawn by the ray tracer, so it is bent like everything else
  const x1=aim.x*d, y1=aim.y*d, an=Math.atan2(y1-y0,x1-x0);
  g2.strokeStyle='#ffb469'; g2.fillStyle='#ffb469';
  g2.beginPath(); g2.moveTo(x0,y0); g2.lineTo(x1,y1); g2.stroke();
  g2.beginPath(); g2.moveTo(x1,y1); g2.lineTo(x1-10*d*Math.cos(an-.4),y1-10*d*Math.sin(an-.4)); g2.lineTo(x1-10*d*Math.cos(an+.4),y1-10*d*Math.sin(an+.4)); g2.closePath(); g2.fill();
  g2.fillText(KINDS[aim.kind]+'  '+beta.toFixed(2)+' c',x1+14*d,y1+14*d);
  if(P.fate){ g2.fillStyle='#bfe6ff'; g2.fillText(P.fate,x1+14*d,y1+30*d); }
}

/* ---------- riding along: the camera falls with an object ---------- */
let veil=1, noteT=0;
function note(text,sec){ const n=$('note'); clearTimeout(noteT); n.textContent=text; n.classList.toggle('on',!!text); if(text&&sec) noteT=setTimeout(()=>n.classList.remove('on'),sec*1000); }
// the ride stops between the two horizons: below the inner one the textbook solution stops describing a real hole
function rideStop(){ return Math.max(.16,K.M-Math.sqrt(Math.max(0,K.M*K.M-K.a*K.a))+.12); }
// the time a far-away clock shows differs from the page's time coordinate by this function of radius
function farOffset(r){ const M=K.M, rp=khor(), rm=M-Math.sqrt(Math.max(0,M*M-K.a*K.a)); return M*Math.log(Math.abs((r-rp)*(r-rm)))+2*M*M/Math.max(1e-9,rp-rm)*Math.log(Math.abs((r-rp)/Math.max(1e-12,r-rm))); }
function startRide(){
  if(ride) return; end(); touch(); introDone=true; S.tGrav=1; S.grav=Math.max(S.grav,.999); setHole();
  let b=bodies.pop(); // the camera takes the place of the last thing launched
  if(!b){ // nothing launched: start on a path that crosses the disk and falls in
    const C=orbitCamera(), P=[0,1,2].map(i=>C.r[i]*10.5+C.u[i]*2-C.f[i]*2), R=Math.hypot(P[0],P[1],P[2]), rh=P.map(x=>x/R);
    const th=unit3(cross3([0,1,0],rh)), vc=komega(kr(P))*R;
    b={x:P,p:[0,0,0],pt:-1,dv:0,t:0}; setVelocity(b,[0,1,2].map(i=>th[i]*.55*vc-rh[i]*.2*vc)); }
  b.own=true; b.t=0;
  ride={b,k:reduce?1:0,yaw:0,pitch:0,zoom:.62,tau:0,far:0,r0:kr(b.x),rate:1,leave:false,up:[0,1,0]};
  $('bG').setAttribute('aria-pressed',true); $('bR').setAttribute('aria-pressed',true);
  document.body.classList.add('riding'); note('Drag to look around  ·  Scroll to zoom  ·  Esc to leave',7);
}
function stopRide(text){ ride=null; veil=0; $('bR').setAttribute('aria-pressed',false); document.body.classList.remove('riding'); note(text||'',text?9:0); }
function stepRide(dt){ // returns the far-away time to move the rest of the scene by
  const b=ride.b, rh=khor(), stop=rideStop(); let r=kr(b.x);
  ride.k=Math.min(1,ride.k+dt/1.8);
  // playback slows as the fall speeds up, so the last part can be watched
  ride.rate=clamp(.2*Math.pow(r/rh,r>rh?1.5:2.5),.004,5.5)/5.5;
  const dtau=dt*5.5*ride.rate, t0=b.t;
  r=advance(b,dtau,8,DRAG[0]); ride.tau+=dtau;
  const dtc=b.t-t0; ride.far=r>rh?b.t-(farOffset(r)-farOffset(ride.r0)):Infinity;
  if(ride.leave) veil-=dt/.3; else veil=Math.min(veil+dt/.6,clamp((r-stop)/.2,0,1));
  if(r<=stop+1e-3) stopRide('Seen from far away, you never reached the horizon.');
  else if(veil<=0 || r>70) stopRide();
  return Math.min(dtc,dtau*3);
}
function rideCamera(){
  const O=orbitCamera(), b=ride.b, k=ride.k*ride.k*(3-2*ride.k), x=b.x;
  kderiv(x,b.p,b.pt,_d); const U=[_d[6],_d[0],_d[1],_d[2]];
  // the rider's view: facing the middle of the hole's shadow as the rider sees it, found from the exact edge
  // (the edge is a circle on the rider's sky; the sum of cross products of neighbouring points lies along its axis)
  const D=Math.hypot(x[0],x[1],x[2]), rh=x.map(v=>v/D); let f0=rh.map(v=>-v), u0=[-f0[0]*f0[1],1-f0[1]*f0[1],-f0[2]*f0[1]];
  if(Math.hypot(u0[0],u0[1],u0[2])<.02) u0=[1,0,0]; u0=unit3(u0); const s=[cross3(f0,u0),u0,f0], E0=kframe(x,U,s);
  const ed=edgeLoop(x,10).map(e=>{ const q=kseen(E0,e.pt,e.p), w=[0,1,2].map(i=>q.d[0]*s[0][i]+q.d[1]*s[1][i]+q.d[2]*s[2][i]); w.g=q.om; return w; });
  if(ed.length>4){ let ax=[0,0,0];
    for(let i=0;i<ed.length;i++){ const c=cross3(ed[i],ed[(i+1)%ed.length]); ax=ax.map((v,j)=>v+c[j]); }
    // of the two ends of the axis, the middle of the shadow is the one that follows on from the last frame (at first: the one toward the hole)
    if(kdot(ax,ride.axis||f0)<0) ax=ax.map(v=>-v);
    f0=unit3(ax); ride.axis=f0;
    // once the shadow is too wide to fit, turn away from its middle to keep its edge in view,
    // toward the side where the light is shifted up the most and the sky is brightest
    const wide=Math.acos(clamp(kdot(f0,ed[0]),-1,1)), turn=window.__noTurn?0:Math.max(0,wide-.42);
    if(turn>0){ let sd=cross3(f0,[0,1,0]).map(v=>v*1e-3);
      for(const d of ed){ const q=kdot(d,f0), w=d.g*d.g; sd=sd.map((v,i)=>v+w*(d[i]-f0[i]*q)); }
      sd=unit3(sd); f0=f0.map((v,i)=>Math.cos(turn)*v+Math.sin(turn)*sd[i]); } }
  // up starts along the spin axis and is carried along from frame to frame, so the view never flips passing over a pole
  const qu=kdot(ride.up,f0); let up=ride.up.map((v,i)=>v-f0[i]*qu);
  if(Math.hypot(up[0],up[1],up[2])<.05) up=O.u.map((v,i)=>v-f0[i]*kdot(O.u,f0));
  up=unit3(up); ride.up=up; const r0=cross3(f0,up);
  const cy=Math.cos(ride.yaw), sy=Math.sin(ride.yaw), cp=Math.cos(ride.pitch), sp=Math.sin(ride.pitch);
  const f=[0,1,2].map(i=>cp*(cy*f0[i]+sy*r0[i])+sp*up[i]), r=[0,1,2].map(i=>cy*r0[i]-sy*f0[i]), u=cross3(r,f);
  if(k>=1) return {x:x.slice(),r,u,f,focal:ride.zoom,D,E:frameAt(x,U,r,u,f),riding:1};
  // flying in: from the hovering camera to the rider, picking up its motion on the way
  const a=O.x.map(v=>v/S.dist), ang=Math.acos(clamp(kdot(a,rh),-1,1)), sn=Math.sin(ang);
  const dir=sn<1e-3?a:unit3(a.map((v,i)=>(Math.sin((1-k)*ang)*v+Math.sin(k*ang)*rh[i])/sn));
  const Dc=Math.exp(Math.log(S.dist)*(1-k)+Math.log(D)*k), xc=dir.map(v=>v*Dc);
  const fb=unit3(O.f.map((v,i)=>v+(f[i]-v)*k+1e-3*O.r[i])), um=O.u.map((v,i)=>v+(u[i]-v)*k), q=kdot(um,fb), ub=unit3(um.map((v,i)=>v-fb[i]*q));
  const vv=[_d[0]/_d[6]*k,_d[1]/_d[6]*k,_d[2]/_d[6]*k], ut=kut(xc,vv)||kut(xc,[0,0,0]), ok=kut(xc,vv)>0;
  return {x:xc,r:cross3(fb,ub),u:ub,f:fb,focal:O.focal+(ride.zoom-O.focal)*k,D:Dc,E:frameAt(xc,ok?[ut,vv[0]*ut,vv[1]*ut,vv[2]*ut]:[ut,0,0,0],cross3(fb,ub),ub,fb),riding:1};
}
// the exact shadow edge as a closed loop of photons
function edgeLoop(x,n){ const e=kedge(x,n); return e.filter(q=>q.sg>0).concat(e.filter(q=>q.sg<0).reverse()); }
function rideReadout(){
  const b=ride.b, r=kr(b.x), U=khover(b.x);
  $('hR').textContent=r.toFixed(2);
  if(U){ kderiv(b.x,b.p,b.pt,_d); const g=-kip(b.x,U,[_d[6],_d[0],_d[1],_d[2]]); $('hV').textContent=Math.sqrt(Math.max(0,1-1/(g*g))).toFixed(2)+' c past a hoverer'; }
  else $('hV').textContent='nothing can hover here';
  $('hT').textContent=ride.tau.toFixed(1);
  $('hTf').textContent=isFinite(ride.far)&&ride.far<1e5?ride.far.toFixed(ride.far<1000?1:0)+' rₛ/c':(r>khor()?'running away':'has no value in here');
  $('hP').textContent=(ride.rate*100).toFixed(ride.rate<.1?1:0)+'% of normal';
}

/* ---------- frame ---------- */
function pass(pr,T,w,h){ gl.bindFramebuffer(gl.FRAMEBUFFER,T?T.f:null); gl.viewport(0,0,w,h); gl.useProgram(pr.p); }
function tex(unit,t,loc){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,t); gl.uniform1i(loc,unit); }
const enc=hdr?0:1;
let last=performance.now(), acc=0, frames=0, slow=0, t0=0, introDone=reduce, cap=1, skip=2, nFrame=0, timed=false;
window.__t={compileMs}; window.__S=S; window.__load=0;
document.addEventListener('visibilitychange',()=>{ skip=3; slow=0; });
const ease=(cur,to,rate,dt)=>cur+(to-cur)*(1-Math.exp(-rate*dt));

const uB=new Float32Array(24), uBA=new Float32Array(24), uBG=new Float32Array(24), uBV=new Float32Array(24);
function bodyUniforms(U){
  let n=0;
  const put=(c,R,ax,kind,b)=>{ kderiv(b.x,b.p,b.pt,_d); uB.set([c[0],c[1],c[2],R],n*4); uBA.set([ax[0],ax[1],ax[2],kind],n*4); uBG.set([1,b.seed,R+Math.hypot(ax[0],ax[1],ax[2]),0],n*4);
    uBV.set([_d[0]/_d[6],_d[1]/_d[6],_d[2]/_d[6],_d[6]],n*4); n++; };
  for(const b of bodies){ if(n>=6) break;
    const k=Math.min(1,b.age/.4), sc=k*k*(3-2*k); // pops in
    if(b.kind===3){ const d=unit3(velocity(b));
      put(b.x,.16*sc,d.map(v=>v*.5*sc),3,b);
      if(n<6) put(b.x.map((v,i)=>v-d[i]*.9*sc),.105*sc,d.map(v=>v*.25*sc),4,b);
    } else { // tides stretch it along the line to the hole before it comes apart
      const R=RADIUS[b.kind]*sc, rt=TIDE[b.kind], r=Math.hypot(b.x[0],b.x[1],b.x[2]), st=rt?clamp((1.18*rt-r)/(.18*rt),0,1)*S.grav:0;
      put(b.x,R*(1-.28*st),b.x.map(v=>v/r*R*.85*st),b.kind,b);
    }
  }
  gl.uniform1i(U.uNB,n); gl.uniform4fv(U['uB[0]'],uB); gl.uniform4fv(U['uBA[0]'],uBA); gl.uniform4fv(U['uBG[0]'],uBG); gl.uniform4fv(U['uBV[0]'],uBV);
}
// debris and the aiming guide go into the 3D grid the tracer reads
let volOn=false, volDirty=[];
function splat(x,den,tem,v,gui){
  const fx=(x[0]/28.8+.5)*VX-.5, fy=(x[1]/12+.5)*VY-.5, fz=(x[2]/28.8+.5)*VZ-.5, ix=Math.floor(fx), iy=Math.floor(fy), iz=Math.floor(fz);
  if(ix<0||iy<0||iz<0||ix>=VX-1||iy>=VY-1||iz>=VZ-1) return;
  const tx=fx-ix, ty=fy-iy, tz=fz-iz;
  for(let c=0;c<8;c++){ const a=c&1, b=(c>>1)&1, d=c>>2, w=(a?tx:1-tx)*(b?ty:1-ty)*(d?tz:1-tz), i=ix+a+VX*(iy+b+VY*(iz+d));
    if(vDen[i]===0&&vGui[i]===0) volDirty.push(i);
    vDen[i]+=den*w; vTem[i]+=den*w*tem; vGui[i]+=gui*w; if(v){ vVx[i]+=den*w*v[0]; vVy[i]+=den*w*v[1]; vVz[i]+=den*w*v[2]; } }
}
function fillVolume(){
  const path=aim&&aim.path; if(!bits.length && !path){ if(volOn){ volOn=false; } return; }
  for(const i of volDirty){ vDen[i]=vTem[i]=vGui[i]=vVx[i]=vVy[i]=vVz[i]=0; const o=i*4; volA[o]=volA[o+1]=volA[o+2]=volA[o+3]=0; volB[o]=volB[o+1]=volB[o+2]=127; }
  volDirty=[];
  const rh=khor();
  for(const f of bits){ const v=velocity(f), near=clamp((kr(f.x)-rh)/(.3*rh),0,1), w=f.lum*clamp((f.life-f.age)/30,0,1)*(1+3*f.hot)*f.rad/.12*near*near; // fades as its light is stretched at the horizon
    splat(f.x,w,(f.T+5200*f.hot-1800)/9000,v,0); }
  if(path) for(let i=1;i<path.length;i++){ const a=path[i-1], b=path[i], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/.12));
    for(let j=0;j<n;j++){ const t=j/n; splat([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],0,0,null,.5*(1-.6*i/path.length)); } }
  for(const i of volDirty){ const o=i*4, d=vDen[i];
    volA[o]=d>0?clamp(vTem[i]/d,0,1)*255:0; volA[o+1]=Math.min(255,d*90); volA[o+2]=Math.min(255,vGui[i]*255); volA[o+3]=255;
    if(d>0){ volB[o]=clamp(vVx[i]/d*.5+.5,0,1)*255; volB[o+1]=clamp(vVy[i]/d*.5+.5,0,1)*255; volB[o+2]=clamp(vVz[i]/d*.5+.5,0,1)*255; } }
  gl.bindTexture(gl.TEXTURE_3D,volTex[0]); gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,VX,VY,VZ,gl.RGBA,gl.UNSIGNED_BYTE,volA);
  gl.bindTexture(gl.TEXTURE_3D,volTex[1]); gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,VX,VY,VZ,gl.RGBA,gl.UNSIGNED_BYTE,volB);
  volOn=true;
}
const tet=new Float32Array(16), STEP=[.08,.26,.03]; window.__STEP=STEP;
function sceneUniforms(){
  setHole(); const C=camera(); camX=C.x;
  nebDraw(C); const U=P.scene.u; pass(P.scene,scene,W,H);
  for(let i=0;i<4;i++){ tet[i*4]=C.E[i][1]; tet[i*4+1]=C.E[i][2]; tet[i*4+2]=C.E[i][3]; tet[i*4+3]=C.E[i][0]; }
  gl.uniform2f(U.uRes,W,H); gl.uniform3fv(U.uCam,C.x); gl.uniformMatrix4fv(U.uTet,false,tet);
  gl.uniform1f(U.uFocal,C.focal); gl.uniform1f(U.uTime,S.time); gl.uniform1f(U.uDop,S.dop);
  gl.uniform1f(U.uM,K.M); gl.uniform1f(U.uA,K.a); gl.uniform1f(U.uRh,khor()); gl.uniform1f(U.uRcap,S.grav>.02?kcap():0);
  gl.uniform1f(U.uRin,RIN); gl.uniform1f(U.uRing,RPH*1.25*S.grav); gl.uniform1fv(U['uFlux[0]'],flux);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_3D,noiseTex); gl.uniform1i(U.uNoise,3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_3D,volTex[0]); gl.uniform1i(U.uVolA,4);
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_3D,volTex[1]); gl.uniform1i(U.uVolB,5);
  gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D,starTex); gl.uniform1i(U.uStars,6);
  gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D_ARRAY,nebTex); gl.uniform1i(U.uNeb,7);
  gl.uniform4fv(U['uNebC[0]'],nebC); gl.uniform4fv(U['uNebR[0]'],nebR); gl.uniform4fv(U['uNebU[0]'],nebU); gl.uniform4fv(U['uNebG[0]'],nebG); gl.uniform4fv(U['uNebT[0]'],nebT); gl.uniform4fv(U['uNebS[0]'],nebS);
  gl.uniform1f(U.uNebLod,-Math.log2(C.focal*H)); gl.uniform1f(U.uNebOn,nebOn); gl.uniform1f(U.uNebMode,nebFloat?1:0);
  gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D_ARRAY,nebFloat?nebP:nebTex); gl.uniform1i(U.uNebP,8);
  gl.uniform3f(U.uStep,STEP[0],STEP[1],STEP[2]); gl.uniform1f(U.uLing,C.D>RPH*1.7?3.3:5.6); /* close in, every ray sweeps a wide angle, so only rays that go most of the way round count */ gl.uniform1f(U.uVol,volOn?1:0); gl.uniform1f(U.uEsc,Math.max(34,C.D*1.25)); gl.uniform1f(U.uEnc,enc);
  bodyUniforms(U);
  return C;
}

function frame(now){ requestAnimationFrame(frame); tick(now); }
// test only: advance the page by a number of seconds without waiting for the browser to schedule frames
window.__run=function(sec,fps){ fps=fps||60; let t=last; for(let i=0;i<sec*fps;i++){ t+=1000/fps; tick(t); } };
function tick(now){
  if(!t0){ t0=now; window.__t.first=Math.round(now); }
  let dt=(now-last)/1000; if(dt<0) return; last=now; if(dt>.25) dt=.25;
  const introT=(now-t0)/1000;
  setHole();
  let dtc=dt*5.5;
  if(ride && !window.__freeze) dtc=stepRide(dt); else if(!ride) veil=Math.min(1,veil+dt/.6);
  S.time+=dtc; if(!window.__freeze) stepThings(dtc,dt);
  if(ride) rideReadout();
  if(!reduce && !dragging && (!S.look || lookNeb) && now-lastInput>2500) S.tAz+=dt*(S.look?.05:.022);
  if(!S.look){ S.ly=ease(S.ly,0,4,dt); S.lp=ease(S.lp,0,4,dt); S.lz=Math.exp(ease(Math.log(S.lz),0,4,dt)); }
  else if(lookTo){ if(lookNeb){ const B=baseView(); lookTo[0]=Math.atan2(kdot(lookNeb.dir,B.r),kdot(lookNeb.dir,B.f)); lookTo[1]=Math.asin(clamp(kdot(lookNeb.dir,B.u),-1,1)); }
    const dy=((lookTo[0]-S.ly+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; // turn the short way round
    S.ly+=dy*(1-Math.exp(-2.2*dt)); S.lp=ease(S.lp,lookTo[1],2.2,dt); S.lz=Math.exp(ease(Math.log(S.lz),Math.log(lookTo[2]),2.2,dt)); }
  nebOn=nebLoaded===NEB_N?Math.min(1,nebOn+dt/2.5):0;
  S.az=ease(S.az,S.tAz,7,dt); S.el=ease(S.el,S.tEl,7,dt);
  S.dist=ease(S.dist,S.tDist,S.touched?5:.9,dt);
  if(!window.__lockFocal){ const k=clamp((S.dist-3)/15,0,1); S.focal=.55+1.15*k*k*(3-2*k); } // the lens widens as you approach
  // opens in flat space, then gravity switches on
  if(!introDone && (S.touched || S.grav>.985)) introDone=true;
  if(introDone) S.grav=ease(S.grav,S.tGrav,2.2,dt);
  else if(introT>1.7) S.grav=Math.min(1,S.grav+dt/3.2*(.35+2.2*S.grav*(1-S.grav)+.3)); S.dop=ease(S.dop,S.tDop,3,dt); S.pred=ease(S.pred,S.tPred,5,dt);
  S.fade=reduce?1:Math.min(1,introT/1.3);

  drawGuide(); fillVolume();
  sceneUniforms();
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(window.__t.firstDrawMs===undefined){ const q=performance.now(); gl.finish(); window.__t.firstDrawMs=Math.round(performance.now()-q); }
  for(let i=0;i<window.__load;i++) gl.drawArrays(gl.TRIANGLES,0,3); // test only: emulates a slower GPU

  let U=P.down.u, src=scene;
  for(let i=0;i<LEVELS;i++){ const d=downs[i]; pass(P.down,d,d.w,d.h);
    tex(0,src.t,U.uTex); gl.uniform2f(U.uTexel,1/src.w,1/src.h); gl.uniform1f(U.uFirst,i===0?1:0); gl.uniform1f(U.uEnc,enc);
    gl.drawArrays(gl.TRIANGLES,0,3); src=d; }
  U=P.up.u; let low=downs[LEVELS-1];
  for(let i=LEVELS-2;i>=0;i--){ const d=ups[i]; pass(P.up,d,d.w,d.h);
    tex(0,low.t,U.uTex); tex(1,downs[i].t,U.uAdd); gl.uniform2f(U.uTexel,1/low.w,1/low.h); gl.uniform2f(U.uOut,d.w,d.h); gl.uniform1f(U.uEnc,enc);
    gl.drawArrays(gl.TRIANGLES,0,3); low=d; }
  U=P.fin.u; pass(P.fin,null,canvas.width,canvas.height);
  tex(0,scene.t,U.uScene); tex(1,ups[0].t,U.uBloom); gl.uniform2f(U.uOut,canvas.width,canvas.height);
  gl.uniform1f(U.uTime,now/1000); gl.uniform1f(U.uEnc,enc); gl.uniform1f(U.uFade,S.fade*S.fade*veil*veil); tex(2,downs[LEVELS-1].t,U.uLow); gl.uniform1f(U.uAuto,ride?ride.k:0);
  gl.drawArrays(gl.TRIANGLES,0,3);

  soundTick();
  // pick the starting resolution from one timed pass, so slow machines never see a slow first second
  if(!timed && ++nFrame===24){ timed=true; window.__bench(2); const ms=window.__bench(3).ms; window.__t.passMs=ms;
    if(ms>8 && !window.__fix){ scale=clamp(Math.sqrt(6.5/ms),.33,1); build(); skip=2; } }

  // readouts and adaptive resolution, a few times a second
  acc+=dt; frames++;
  if(acc>=.5){
    const fps=frames/acc; acc=0; frames=0;
    if(!ride){ const U=khover(camX); $('hR').textContent=S.dist.toFixed(1); $('hC').textContent=U?(1/U[0]).toFixed(3):'0'; }
    $('hI').textContent=Math.round(S.el*180/Math.PI);
    $('hQ').textContent=Math.round(scale*100); $('hF').textContent=Math.round(fps);
    { const C=camera(); let best=null, bd=0; for(const n of NEBULAE){ const d=kdot(n.dir,C.f); if(d>bd){ bd=d; best=n; } }
      const near=best && Math.acos(clamp(bd,-1,1))*180/Math.PI<best.half+4 && nebOn>.5;
      const text=near?best.name+'. Image: '+best.credit:CREDIT0; if($('credit').textContent!==text) $('credit').textContent=text; }
    if(window.__fix){} else if(skip>0) skip--;
    else if(fps<48){ if(++slow>=2 && scale>.34){ cap=Math.max(.33,scale*.93); scale=Math.max(.33,scale*.8); build(); slow=0; skip=1; } }
    else { slow=0; if(fps>58.5 && now>upAfter){ upAfter=now+2500;
        if(scale<cap-.02){ scale=Math.min(cap,scale*1.1); build(); skip=1; } else cap=Math.min(1,cap+.03); } } // the cap relaxes while the frame rate holds
  }
}
let upAfter=6000;

// the exact edge of the shadow for this camera, wherever it is and however it moves
function edgeOnScreen(C,n){ return edgeLoop(C.x,n).map(e=>onScreen(C,e.pt,e.p)); }
function drawGuide(){
  g2.clearRect(0,0,guide.width,guide.height);
  drawAim();
  if(S.pred<.01 || S.grav<.99) return;
  setHole(); const C=camera(), pts=edgeOnScreen(C,48); if(pts.length<4) return; pts.push(pts[0]);
  g2.globalAlpha=S.pred*veil; g2.lineWidth=1.25*dpr; g2.strokeStyle='#8fd3ff'; g2.setLineDash([5*dpr,6*dpr]); g2.beginPath();
  let pen=false, lab=null;
  for(const s of pts){ if(!s || Math.abs(s[0])>1e5 || Math.abs(s[1])>1e5){ pen=false; continue; }
    if(pen) g2.lineTo(s[0]*dpr,s[1]*dpr); else g2.moveTo(s[0]*dpr,s[1]*dpr); pen=true;
    if(s[0]>40 && s[0]<cssW-330 && s[1]>40 && s[1]<cssH-40 && (!lab || s[0]-s[1]>lab[0]-lab[1])) lab=s; }
  g2.stroke(); g2.setLineDash([]);
  if(lab){ g2.fillStyle='#bfe6ff'; g2.font=(11.5*dpr)+'px ui-monospace,Consolas,Menlo,monospace'; g2.textBaseline='middle';
    g2.fillText('shadow edge predicted by general relativity',(lab[0]+14)*dpr,(lab[1]-12)*dpr); }
  g2.globalAlpha=1;
}
$('nebCredits').innerHTML=NEBULAE.map(n=>'<p><span>'+n.name+'</span>, \u00d7'+n.enlarged+'. '+n.credit.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p>').join('');
setSpin(S.spin); $('spin').value=S.spin; $('spinV').textContent=S.spin.toFixed(2);
requestAnimationFrame(frame);

/* ---------- test probes ---------- */
window.__nebDepth=NEB_DEPTH; window.__neb=()=>({float:nebFloat,pts:nebPts,R:NEBULAE.map(n=>n.R),loaded:nebLoaded,on:nebOn,size:NEB_S,list:NEBULAE,lookTo,i:nebI}); window.__K=K; window.__k={kr,khor,kcap,kedge,kseen,kframe,khover,kphoton,kstep,kderiv,klower,kut,kip,kgas,komega,kisco,kH,delay,velocity,setVelocity,edgeLoop,onScreen,castRay};
window.__bodies=bodies; window.__bits=bits; window.__launch=launch; window.__phys={spawn,toss,addBit,shred,TIDE};
window.__aim={pick,predict,aimVelocity,start:(x,y)=>{ downX=x; downY=y; startAim(); },set:(x,y)=>{ aim.x=x; aim.y=y; },fire:()=>{ const a=aim; end(); fire(a); },cam:camera,get:()=>aim};
window.__frame=()=>{ const C=camera(), E=C.E; let w=Math.abs(kip(C.x,E[0],E[0])+1); for(let i=1;i<4;i++){ w=Math.max(w,Math.abs(kip(C.x,E[i],E[i])-1)); for(let j=0;j<i;j++) w=Math.max(w,Math.abs(kip(C.x,E[i],E[j]))); } return w; };
window.__ride={start:startRide,get:()=>ride,put:(x,v,yaw,pitch,zoom)=>{ if(!ride) startRide(); const b={x,p:[0,0,0],pt:-1,dv:0,own:true,t:0}; setVelocity(b,v); ride.b=b; ride.k=1; ride.up=[0,1,0]; ride.axis=null; ride.yaw=yaw||0; ride.pitch=pitch||0; if(zoom) ride.zoom=zoom; veil=1; }};
window.__simulate=(sec,fps)=>{ fps=fps||60; for(let i=0;i<sec*fps;i++){ setHole(); let dtc=5.5/fps; if(ride){ dtc=stepRide(1/fps); if(ride) camX=ride.b.x; } S.time+=dtc; stepThings(dtc,1/fps); } };
window.__scale=v=>{ window.__fix=true; scale=v; build(); };
window.__setSpin=s=>{ setSpin(s); $('spin').value=s; $('spinV').textContent=s.toFixed(2); };
// milliseconds of GPU time per scene pass at the current size
window.__bench=function(n){ n=n||20; const px=new Uint8Array(4); gl.finish();
  const t=performance.now();
  for(let i=0;i<n;i++){ sceneUniforms(); gl.drawArrays(gl.TRIANGLES,0,3); }
  gl.bindFramebuffer(gl.FRAMEBUFFER,downs[LEVELS-1].f); gl.readPixels(0,0,1,1,gl.RGBA,hdr?gl.FLOAT:gl.UNSIGNED_BYTE,hdr?new Float32Array(4):px);
  gl.finish(); return {ms:(performance.now()-t)/n, W, H, scale}; };
// the scene buffer, with the given probe mode (0: the picture, 1: escaped or captured, 2: frequency shift)
window.__grab=function(mode){ fillVolume(); sceneUniforms(); gl.uniform1f(P.scene.u.uProbe,mode||0); gl.drawArrays(gl.TRIANGLES,0,3); gl.uniform1f(P.scene.u.uProbe,0);
  const buf=hdr?new Float32Array(W*H*4):new Uint8Array(W*H*4);
  gl.bindFramebuffer(gl.FRAMEBUFFER,scene.f); gl.readPixels(0,0,W,H,gl.RGBA,hdr?gl.FLOAT:gl.UNSIGNED_BYTE,buf); return {buf,W,H}; };
window.__shift=function(){ const g=window.__grab(2); return g.buf[((g.H>>1)*g.W+(g.W>>1))*4]; };
// where the rendered shadow ends against the exact outline: for each exact edge point, the rendered edge along the line from the outline's middle
window.__edge=function(n){ const C=camera(), g=window.__grab(1), thr=hdr?.5:100, pts=edgeOnScreen(C,n||16).filter(Boolean).map(s=>[s[0]/cssW*g.W,(1-s[1]/cssH)*g.H]);
  if(pts.length<3) return {points:0};
  const cx=pts.reduce((t,q)=>t+q[0],0)/pts.length, cy=pts.reduce((t,q)=>t+q[1],0)/pts.length; let worst=0, mean=0, m=0;
  const lit=(x,y)=>{ x=Math.round(x); y=Math.round(y); return x<0||y<0||x>=g.W||y>=g.H?-1:(g.buf[(y*g.W+x)*4]>thr?1:0); };
  for(const q of pts){ const L=Math.hypot(q[0]-cx,q[1]-cy); if(L<3) continue; let s=0, ok=true; for(;s<3*L;s+=.25){ const v=lit(cx+(q[0]-cx)*s/L,cy+(q[1]-cy)*s/L); if(v<0){ ok=false; break; } if(v) break; }
    if(!ok) continue; const e=(s-L)/L; worst=Math.max(worst,Math.abs(e)); mean+=e; m++; }
  if(pts.length<3) return {points:0};
  return {points:m, worstPct:+(worst*100).toFixed(2), meanPct:+(mean/Math.max(1,m)*100).toFixed(2), sizePx:+Math.hypot(pts[0][0]-cx,pts[0][1]-cy).toFixed(1), W:g.W, H:g.H}; };
}
// the shaders take a second or two to compile on a cold start, so let the title paint first
setTimeout(main,60);
