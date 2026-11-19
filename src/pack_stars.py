"""Packs the Yale Bright Star Catalogue (Hoffleit and Warren 1991, ASCII file ybsc5) into src/stars.js:
position, visual magnitude and B-V colour for every entry that has a position, 6 bytes each, plus the
rotation that places the sky in the scene. Usage: python -I pack_stars.py path/to/ybsc5.txt"""
import sys, math, base64, io, os
raw = open(sys.argv[1], "rb").read().decode("latin-1")
if raw.startswith("d="): raw = raw[2:]
out = bytearray(); named = {}; n = 0; skipped = 0
for line in raw.replace("\r", "").split("\n"):
    if len(line) < 107 or not line[75:77].strip(): 
        if line.strip(): skipped += 1
        continue
    hr = int(line[0:4])
    ra = (int(line[75:77]) + int(line[77:79]) / 60 + float(line[79:83]) / 3600) / 24 * 2 * math.pi
    dec = (int(line[84:86]) + int(line[86:88]) / 60 + int(line[88:90]) / 3600) * (-1 if line[83] == "-" else 1) * math.pi / 180
    mag = float(line[102:107]); bv = float(line[109:114]) if line[109:114].strip() else 0.6
    named[hr] = (ra, dec, mag, bv)
    a = round(ra / (2 * math.pi) * 65535); d = round((dec + math.pi / 2) / math.pi * 65535)
    out += bytes([a >> 8, a & 255, d >> 8, d & 255, max(0, min(255, round((mag + 2) * 25))), max(0, min(255, round((bv + .5) * 100)))])
    n += 1
def eq(ra, dec): return [math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)]
def unit(v):
    l = math.sqrt(sum(x * x for x in v)); return [x / l for x in v]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def perp(v, a): 
    q = dot(v, a); return unit([v[i] - a[i] * q for i in range(3)])
for hr, name in [(2491, "Sirius"), (7001, "Vega"), (424, "Polaris"), (1903, "Alnilam"), (2061, "Betelgeuse")]:
    ra, dec, mag, bv = named[hr]; print(f"  HR {hr} {name}: RA {ra*12/math.pi:.4f} h, Dec {dec*180/math.pi:+.3f} deg, V {mag}, B-V {bv}")
# the sky is turned so that the Orion Nebula sits about 15 degrees right of the hole in the opening view, with celestial north up
a1 = eq(83.791 * math.pi / 180, -5.414 * math.pi / 180); a2 = perp([0, 0, 1], a1); a3 = cross(a1, a2)  # the Orion Nebula
f = unit([-0.615, -0.14, -0.776]); r = unit([-f[2], 0, f[0]]); u = cross(r, f)
b1 = unit([f[i] + .27 * r[i] - .03 * u[i] for i in range(3)]); b2 = perp(u, b1); b3 = cross(b1, b2)
R = [[b1[i] * a1[j] + b2[i] * a2[j] + b3[i] * a3[j] for j in range(3)] for i in range(3)]
mul = lambda v: [dot(R[i], v) for i in range(3)]
d2r = math.pi / 180
ngp = eq(192.85948 * d2r, 27.12825 * d2r); gc = eq(266.40499 * d2r, -28.93617 * d2r)
print("  galactic pole . galactic centre =", round(dot(ngp, gc), 6), "(should be 0)")
js = "// Packed from the Yale Bright Star Catalogue, 5th revised edition (Hoffleit and Warren 1991): %d entries, 6 bytes each\n" % n
js += "// (right ascension and declination as 16-bit fractions, magnitude as (V + 2) x 25, colour as (B-V + 0.5) x 100).\n"
js += 'const STARS="%s";\n' % base64.b64encode(bytes(out)).decode()
js += "// rotation from equatorial coordinates (J2000) to the scene, and the Milky Way's pole and centre in the scene\n"
js += "const SKY_ROT=%s, GAL_POLE=%s, GAL_CENTRE=%s;\n" % ([round(x, 6) for row in R for x in row], [round(x, 5) for x in mul(ngp)], [round(x, 5) for x in mul(gc)])
io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "stars.js"), "w", encoding="utf-8", newline="\n").write(js)
print("packed", n, "entries;", skipped, "without a position;", len(js), "bytes of script")
