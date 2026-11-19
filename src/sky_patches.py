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
"""  for(int i=0;i<12;i++){ vec4 C=uNebC[i]; float z=dot(d,C.xyz); if(z<C.w) continue; // real telescope images, at their real places
    vec2 q=vec2(dot(d,uNebR[i].xyz)*uNebR[i].w,dot(d,uNebU[i].xyz)*uNebU[i].w)/z;
    if(max(abs(q.x),abs(q.y))>=1.) continue;
    vec3 t=textureLod(uNeb,vec3(q*uNebG[i].z*.5+.5,float(i)),uNebLod+uNebG[i].y).rgb;
    c+=t*t*uNebG[i].x*smoothstep(1.,.55,length(q))*bb(6500.*g)*uNebOn; } // fades to nothing before the picture's edge
  return c*g*g*g*g; // brightness goes as the fourth power of the frequency shift""")
