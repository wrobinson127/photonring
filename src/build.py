"""Builds the page. index.html loads the nebula images from sky/ and needs a web server; review.html carries them
inside and opens by double-click. Markup and some shader helpers come from base_page.html, the script from app.js,
kerr.js, stars.js and nebulae.js."""
import io, subprocess, os, re
REPO = r"C:\Users\wrobi\code\photon-ring"
HERE = os.path.dirname(os.path.abspath(__file__))
old = io.open(os.path.join(HERE, "base_page.html"), encoding="utf-8").read()  # the earlier, non-spinning page: markup and shader helpers are reused from it
app = io.open(os.path.join(HERE, "app.js"), encoding="utf-8").read()
kerr = io.open(os.path.join(HERE, "kerr.js"), encoding="utf-8").read()
kerr = kerr[kerr.index("// Kerr geometry"):kerr.index("if(typeof module")]

def cut(a, b):
    i = old.index(a); j = old.index(b, i)
    return old[i:j]
stars = io.open(os.path.join(HERE, "stars.js"), encoding="utf-8").read()
nebulae = io.open(os.path.join(HERE, "nebulae.js"), encoding="utf-8").read()
parts = {
    "KERR": kerr,
    "STARS": stars,
    "NEBULAE": nebulae,
    "OLD_GLSL_A": cut("float hash21(vec2 p){", "vec4 disk(vec3 x,float ell,float order){"),
    "OLD_GLSL_B": cut("float ridge(vec3 p){", "// Launched objects are capsules"),
    "OLD_HIT": cut("// Launched objects are capsules", "vec3 shadeBody(int k,vec3 x,vec3 rd){"),
    "OLD_POST": cut("const DOWN=`#version 300 es", "// Debris is drawn as glowing points."),
    "OLD_PROG": cut("function sh(type,src){", "let P; const tc=performance.now();"),
    "OLD_NOISE": cut("// 32 x 32 x 32 random values", "const compileMs="),
    "OLD_TARGETS": cut("/* ---------- render targets ---------- */", "/* ---------- camera and state ---------- */"),
    "OLD_SOUND": cut("/* ---------- sound: a small generative drone", "function soundTick(){"),
}
for k, v in parts.items():
    tag = "//@@" + k + "@@"
    assert app.count(tag) == 1, k
    app = app.replace(tag, v.rstrip() + "\n")
assert "//@@" not in app
exec(io.open(os.path.join(HERE, "sky_patches.py"), encoding="utf-8").read())

head = old[:old.index("<script>")]
def rep(a, b):
    global head
    assert head.count(a) == 1, a[:60]
    head = head.replace(a, b)
extra = os.path.join(HERE, "head_patches.py")
if os.path.exists(extra):
    exec(io.open(extra, encoding="utf-8").read())
import re as _re
out = head + "<script>\n" + app + "</script>\n</body>\n</html>\n"
import base64, json
ids = _re.findall(r'"id":"([a-z0-9]+)"', nebulae)
uris = ["data:image/jpeg;base64," + base64.b64encode(open(os.path.join(REPO, "sky", i + ".jpg"), "rb").read()).decode() for i in ids]
line = "const NEBULA_IMG=NEBULAE.map(n=>'sky/'+n.id+'.jpg'); // the live page loads the images from the sky folder"
assert out.count(line) == 1
io.open(os.path.join(REPO, "index.html"), "w", encoding="utf-8", newline="\n").write(out)
rev = out.replace(line, "const NEBULA_IMG=" + json.dumps(uris, separators=(",", ":")) + "; // the review copy carries the images inside")
io.open(os.path.join(REPO, "review.html"), "w", encoding="utf-8", newline="\n").write(rev)
print("built index.html", len(out), "and review.html", len(rev))
