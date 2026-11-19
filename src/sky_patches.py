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
    vec3 s=textureLod(uStars,vec2(atan(d.z,d.x)/TAU+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5),0.).rgb;
    c+=s*s*40.*bb(6500.*g); }
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
