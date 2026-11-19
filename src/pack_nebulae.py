"""Turns the fetched ESA/Hubble images (saved as text by the local receiver) into sky/*.jpg and src/nebulae.js.
Each entry carries the position, field of view and orientation published on the image's ESA/Hubble page, so the
image can be placed where it really is on the sky and turned the right way. Usage: python -I pack_nebulae.py <dir of .txt>"""
import sys, os, io, math, base64, json
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE); SRC = sys.argv[1]
# id, name, RA (h m s), Dec (d m s), true field of view in arcminutes (w, h), north: degrees left (+) or right (-) of vertical,
# half-width it is drawn at in degrees, credit
N = [
 ("heic0601a", "Orion Nebula (M42)", (5, 35, 9.73), (-5, 24, 50.32), (30.03, 30.03), 0.0, 7.0,
  "NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team"),
 ("heic1307a", "Horsehead Nebula, infrared", (5, 41, 0.99), (-2, 27, 11.92), (5.78, 6.04), 103.0, 2.4,
  "NASA, ESA, and the Hubble Heritage Team (AURA/STScI)"),
 ("heic0515a", "Crab Nebula (M1)", (5, 34, 32.53), (22, 0, 54.87), (6.41, 6.41), 0.0, 5.0,
  "NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)"),
 ("heic1007a", "Mystic Mountain, Carina Nebula", (10, 44, 2.38), (-59, 30, 29.55), (1.39, 1.28), 165.5, 7.0,
  "NASA, ESA, M. Livio and the Hubble 20th Anniversary Team (STScI)"),
 ("heic1206a", "Tarantula Nebula (30 Doradus)", (5, 38, 17.08), (-69, 7, 33.23), (13.41, 10.73), 35.0, 7.0,
  "NASA, ESA, ESO, D. Lennon and E. Sabbi (ESA/STScI) and the full team listed at esahubble.org/images/heic1206a"),
 ("heic0910h", "Butterfly Nebula (NGC 6302)", (17, 13, 43.76), (-37, 6, 12.51), (2.35, 2.74), -128.4, 6.0,
  "NASA, ESA and the Hubble SM4 ERO Team"),
 ("heic1501a", "Pillars of Creation, Eagle Nebula (M16)", (18, 18, 52.72), (-13, 50, 21.97), (4.53, 4.72), 35.0, 6.5,
  "NASA, ESA/Hubble and the Hubble Heritage Team"),
 ("heic2608a", "Trifid Nebula (M20)", (18, 2, 28.65), (-23, 4, 27.03), (2.69, 2.60), 44.9, 4.0,
  "NASA, ESA, STScI. Image processing: J. DePasquale (STScI)"),
 ("heic1310a", "Ring Nebula (M57)", (18, 53, 35.21), (33, 1, 44.13), (2.10, 2.10), 11.7, 5.5,
  "NASA, ESA, and C. Robert O'Dell (Vanderbilt University)"),
 ("heic1608a", "Bubble Nebula (NGC 7635)", (23, 20, 42.09), (61, 11, 28.39), (5.19, 4.93), 33.6, 6.0,
  "NASA, ESA, Hubble Heritage Team"),
 ("heic0414a", "Cat's Eye Nebula (NGC 6543)", (17, 58, 33.26), (66, 37, 58.15), (1.17, 1.17), 144.6, 5.0,
  "ESA, NASA, HEIC and The Hubble Heritage Team (STScI/AURA)"),
 ("opo0432d", "Helix Nebula (NGC 7293)", (22, 29, 41.92), (-20, 50, 13.29), (27.26, 29.38), 0.3, 7.5,
  "NASA, ESA, C.R. O'Dell (Vanderbilt University), and M. Meixner, P. McCullough, and G. Bacon (Space Telescope Science Institute)"),
]
os.makedirs(os.path.join(REPO, "sky"), exist_ok=True)
meta = []; uris = []; total = 0
for (iid, name, ra, dec, fov, north, half, credit) in N:
    raw = open(os.path.join(SRC, iid + ".txt"), "rb").read().decode("latin-1")
    assert raw.startswith("d="), iid
    dims, uri = raw[2:].strip().split("|", 1)
    b64 = uri.split(",", 1)[1].strip()
    jpg = base64.b64decode(b64); assert jpg[:2] == b"\xff\xd8", iid
    open(os.path.join(REPO, "sky", iid + ".jpg"), "wb").write(jpg); total += len(jpg)
    sgn = -1 if (dec[0] < 0 or str(dec[0]).startswith("-")) else 1
    meta.append({"id": iid, "name": name, "credit": credit,
                 "ra": round((ra[0] + ra[1] / 60 + ra[2] / 3600) * 15, 5),
                 "dec": round(sgn * (abs(dec[0]) + dec[1] / 60 + dec[2] / 3600), 5),
                 "fov": list(fov), "north": north, "half": half,
                 "enlarged": round(2 * half * 60 / fov[0])})
    uris.append("data:image/jpeg;base64," + base64.b64encode(jpg).decode())
js = "// Hubble images from ESA/Hubble (esahubble.org), Creative Commons Attribution 4.0. Position, field of view and orientation are\n"
js += "// the values published with each image. 'half' is the half-width each is drawn at, in degrees; 'enlarged' is how many times too big that is.\n"
js += "const NEBULAE=" + json.dumps(meta, separators=(",", ":")) + ";\n"
js += "const NEBULA_IMG=NEBULAE.map(n=>'sky/'+n.id+'.jpg'); // the live page loads the images from the sky folder\n"
io.open(os.path.join(HERE, "nebulae.js"), "w", encoding="utf-8", newline="\n").write(js)
print(len(N), "images,", total, "bytes of JPEG;", len(js), "bytes of script")
for m in meta: print("  %-42s RA %8.3f Dec %+7.3f  true %5.2f' wide, drawn %4.1f deg wide: x%d" % (m["name"], m["ra"], m["dec"], m["fov"][0], 2 * m["half"], m["enlarged"]))
