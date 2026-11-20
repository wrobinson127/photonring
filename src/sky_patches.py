# The real sky (run inside build.py on the assembled script `app`; `stars` is the text of stars.js).
# Catalogue stars come from a texture, the invented faint layers stay as filler, and the star band
# lies on the real galactic plane.
import re

def swap(a, b):
    global app
    assert app.count(a) == 1, a[:60]
    app = app.replace(a, b)

swap("  for(int l=0;l<3;l++){", "  for(int l=1;l<3;l++){ // invented filler: stars too faint for the catalogue")
_i = app.index("  { // a few bright stars with a soft glow")
_j = app.index("  // the galaxy seen from inside:")
app = app[:_i] + """  { // the real stars brighter than magnitude 6.5, from the map of the whole sky
    }
  { // every catalogue star as a sharp point about a pixel wide, from the list for this part of the sky (starGrid)
    vec3 ad=abs(d); vec2 p=d.xz/(ad.x+ad.y+ad.z); if(d.y<0.) p=(1.-abs(p.yx))*vec2(p.x>=0.?1.:-1.,p.y>=0.?1.:-1.);
    ivec2 cell=ivec2(clamp((p*.5+.5)*512.,0.,511.)); float sg=clamp(.8*exp2(uNebLod),5e-5,1.2e-3), amp=clamp(pow(1.1e-3/sg,1.3),.3,8.);
    for(int k=0;k<6;k++){ vec4 st=texelFetch(uStarG,ivec3(cell,k),0); if(st.w==0.) break;
      vec3 e=d-vec3(st.x,sign(st.w)*sqrt(max(0.,1.-st.x*st.x-st.y*st.y)),st.y); c+=bb(st.z*g)*abs(st.w)*amp*exp(-dot(e,e)/(2.*sg*sg)); }
    cell=ivec2(clamp((p*.5+.5)*64.,0.,63.)); // the brightest stars: a soft glow and the four spikes a telescope's mirror supports give them
    for(int k=0;k<4;k++){ vec4 st=texelFetch(uStarB,ivec3(cell,k),0); if(st.w==0.) break;
      vec3 sd=vec3(st.x,sign(st.w)*sqrt(max(0.,1.-st.x*st.x-st.y*st.y)),st.y), e=d-sd, ax=normalize(cross(sd,vec3(.31,.9,.3))), ay=cross(sd,ax);
      float x=abs(dot(e,ax)), y=abs(dot(e,ay)), r=length(e), I=abs(st.w), L=.0035*(1.+.9*log2(1.+I)), w=.8*sg;
      float spike=exp(-x/L)*exp(-y*y/(2.*w*w))+exp(-y/L)*exp(-x*x/(2.*w*w));
      c+=bb(st.z*g)*I*(.022*spike+.012*exp(-r/(.0016+.0006*log2(1.+I))))*smoothstep(.03,.02,r); } }
""" + app[_j:]
gp = re.search(r"GAL_POLE=\[([^\]]*)\], GAL_CENTRE=\[([^\]]*)\]", stars)
swap("  vec3 n=normalize(vec3(.35,.82,-.45)), gc=normalize(cross(n,vec3(.2,.1,1.)));",
     "  vec3 n=vec3(%s), gc=vec3(%s); // the real plane and centre of the Milky Way" % (gp.group(1), gp.group(2)))

# real telescope images at their real places, drawn many times too large (see nebulae.js)
swap("  return c*g*g*g*g; // brightness goes as the fourth power of the frequency shift",
"""  vec3 hz=vec3(0);
  for(int i=0;i<12;i++){ vec4 C=uNebC[i]; float z=dot(d,C.xyz); if(z<C.w) continue; // real telescope images, at their real places
    vec2 q=vec2(dot(d,uNebR[i].xyz)*uNebR[i].w,dot(d,uNebU[i].xyz)*uNebU[i].w)/z; float a=0.;
    if(max(abs(q.x),abs(q.y))<uNebT[i].w){ vec3 e;
      if(uNebMode>.5){ e=textureLod(uNebP,vec3(min(q*uNebG[i].z+uNebG[i].w,vec2(2.*uNebG[i].w-.0012)),float(i)),0.).rgb; a=clamp((e.r+e.g+e.b)*10.,0.,1.); } // the nebula as points, drawn this frame (nebDraw)
      else { vec4 t=textureLod(uNeb,vec3(q*.5+.5,float(i)),uNebLod+uNebG[i].y); e=t.rgb*t.rgb*uNebG[i].x*t.a; a=t.a; } // no float targets: the flat picture
      c+=e*bb(6500.*g)*uNebOn; }
    vec2 qh=q+uNebS[i].xy; hz+=uNebT[i].rgb*exp(-dot(qh,qh)*.6)*(1.-a); }
  if(hz.r+hz.g+hz.b>2e-4){ float hn=fbm3(d*11.+5.); // invented haze around each picture, in the colour of its outer band, so the gas does not stop at the frame
    c+=hz*(.25+11.*hn*hn*hn)*smoothstep(.8,.35,dust)*bb(6500.*g)*uNebOn; }
  return c*g*g*g*g; // brightness goes as the fourth power of the frequency shift""")

# invented filler stars: as sharp as the real ones (their size follows the screen pixel instead of being fixed on the sky)
swap("    float core=smoothstep(rad,0.,dist);", "    float re=clamp(1.5*exp2(uNebLod)*S,.012,rad), core=smoothstep(re,0.,dist);")
swap("    c+=on*mag*core*core*tint*(l==0?1.6: l==1?.8:.4);", "    c+=on*mag*core*core*tint*(l==0?1.6: l==1?.8:.4)*min(6.,pow(rad/re,1.2));")

# invented clouds: fine filaments and dust lanes, so they hold up beside the photographs
swap("  return col*smoothstep(.75,.4,.65*vnoise(q*2.4+11.)+.35*vnoise(q*5.3+3.));",
     "  float fine=.6*ridge(q*4.7+7.)+.4*ridge(q*10.9+1.), lanes=smoothstep(.34,.56,fbm3(q*3.3+9.)); /* fine filaments, and lanes of dust across them */ return col*(.4+1.5*fine*fine)*(.25+.75*lanes)*smoothstep(.75,.4,.65*vnoise(q*2.4+11.)+.35*vnoise(q*5.3+3.));")
