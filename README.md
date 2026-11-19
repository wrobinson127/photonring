# Photon Ring

A spinning black hole traced live in the browser. Each pixel follows one ray of light through the Kerr spacetime.

Two builds of the same page. `index.html` (176 KB) loads the twelve Hubble images from `sky/` after the first frames and needs a web server. `review.html` (10.6 MB) carries the images inside and opens by double-click. No libraries, no outside requests, no tracking. Open `index.html` by double-clicking it. The page is built from `src/` by `python src/build.py` (see Building).

Live at https://photonring.walker-robinson.com

## How it works

- **Geometry.** Kerr in Kerr-Schild Cartesian coordinates with the spin along +y: `g = eta + f l l`, `f = rs r^3 / (r^4 + a^2 y^2)`. Units: rs = 1, so M = 1/2 and a = spin x M. These coordinates are regular at the future horizon.
- **Light paths.** Hamilton's equations for `H = (1/2) g^{mu nu} p_mu p_nu`, with analytic derivatives, stepped backward from the camera with fourth-order Runge-Kutta in the fragment shader, up to 320 steps per pixel. Step length is `max(0.08, 0.26 (r - 0.75 r+))` outside the horizon and `max(0.004, 0.03 r)` inside, never more than `max(0.005, 0.3 |r - r+|)`. A ray traced backward toward the hole piles up at the horizon in these coordinates, so it is stopped once it is inside the innermost light orbit and still heading in, or once its momentum runs away.
- **Camera.** An observer with a four-velocity and an orthonormal frame built in the metric. Each pixel's direction in that frame becomes a photon momentum. A hovering camera and a falling one are the same code.
- **The disk.** A thin disk from the innermost stable orbit (3 rs at spin 0, 1.16 rs at spin 0.9) to 15 rs, gas on prograde circular orbits. The frequency shift is `(p.u)_camera / (p.u)_gas` from the photon's momentum and the two four-velocities. Colour is a black body at the shifted temperature, brightness scales as the fourth power of the shift, and the temperature profile is the Page and Thorne (1974) thin-disk flux, scaled to be the same at 4.78 rs for every spin.
- **Launched objects.** Timelike geodesics from the same Hamiltonian, stepped in JavaScript. A click launches at the point under the cursor, found by tracing that pixel's ray. Hold and drag to aim: the drag is the speed measured by an observer hovering there. Solid objects are drawn inside the ray tracer, with the full frequency shift from their four-velocity.
- **Drag.** Inside the disk (within 0.35 rs of the plane) an object's coordinate velocity relaxes toward the gas velocity plus an inward drift of 15% of the orbital speed.
- **Tides.** A self-gravitating body breaks up inside `(3 M_hole / 4 pi density)^(1/3)`. For a hole of 4.3 million solar masses (rs = 12.7 million km): 5.65 rs for Earth's density (5514 kg/m^3), 8.91 rs for the Sun's (1408 kg/m^3). The body becomes 210 or 340 pieces. Meteors and rockets stay whole.
- **Debris and the aiming guide.** Pieces are splatted into a 96 x 40 x 96 grid (28.8 x 12 x 28.8 rs) that the ray tracer samples along every ray, so debris is lensed, doubled and frequency-shifted by the same code as everything else. The predicted path of an aimed launch is drawn through the same grid.
- **Light delay.** The disk pattern is drawn at the time the light left, summed step by step along each ray. Each object and piece of debris runs on its own clock, held behind the camera's by the travel time of its light: straight-line distance, the first-order Shapiro delay, and the exact extra delay for light climbing from just outside the horizon. A new object starts at that earlier time, so it appears under the cursor at once. Objects are stepped in Kerr-Schild time and do cross the horizon, but their light delay grows without limit as they approach it, so what is drawn slows, reddens and fades.
- **Riding along.** `R` puts the camera on the path of the last object launched (the object is removed), or on a default path. The rider is stepped in its own time, crosses the horizon, and the ride stops at `max(0.16, r- + 0.12)` rs, between the horizons. The view faces the middle of the shadow, found from the exact edge, and turns toward the brightest part of the ring once the shadow is too wide to fit.
- **Sky.** The 9,096 catalogued stars brighter than about magnitude 6.5 are real: position, visual magnitude and B-V colour from the Yale Bright Star Catalogue, packed into the page (6 bytes a star, 73 KB) by `src/pack_stars.py` and drawn at startup into a 4096 x 2048 map of the whole sky that the ray tracer reads where each ray ends. Colour temperature from B-V uses Ballesteros (2012). The sky is turned so Orion's belt sits just right of the hole in the opening view with celestial north up, and the band of unresolved stars lies on the real galactic plane with its bulge at the galactic centre. It is Earth's sky placed around a hole that is not there. Fainter filler stars, the texture of the band, eight gas clouds and five spiral galaxies are generated in the shader and invented. Noise comes from a 32^3 texture of random bytes made at startup.
- **Nebulae.** Twelve Hubble images from ESA/Hubble (CC BY 4.0), fetched at up to 2048 px and packed by `src/pack_nebulae.py`. Each is drawn on the sky at the right ascension and declination published on its ESA/Hubble page, turned by the published orientation, as a flat picture in a 1536 x 1536 texture layer. A picture has a frame and the sky does not, so each image fades out before its frame along an uneven edge set when it loads (`nebMatte`): the fade is wider where the picture is dim, bright filaments outlast the dark gaps between them, and the mean opacity over a picture comes out between 0.41 and 0.61 (the round mask it replaces gave about 0.51). The image's own background level is subtracted. Around each picture the shader adds an invented haze in the average colour of the picture's outer band, so the gas does not stop where the photograph does. The haze is not data.
- **Nebulae as points.** Where the browser can draw to float textures, each nebula is redrawn every frame as a cloud of points, one per pixel of the picture at a size to suit the screen (96 x 96 to 768 x 768), into its own 1024 x 1024 layer in linear light (`nebDraw`), and the ray tracer reads that layer, so the cloud is still lensed. Each point has a depth, and the depth is invented: brighter gas is put nearer, with a slow random field and a little scatter, and the Ring, Helix and Cat's Eye are given a hollow shell. Moving the camera shifts each point sideways in proportion to its depth, by up to about 0.16 of the picture's half-width at 30 rs, by a rule that levels off with distance and is not a real parallax (at their true distances the shift would be nil). The middle depth does not move, so each nebula's centre stays at its published position. The haze is placed 1.6 depths behind each cloud, and 1,024 invented stars per nebula (most too faint to see) are scattered up to three depths in front of and behind it, so three layers move at three rates. With depth set to zero the points reproduce the picture. In the N view the camera keeps drifting round the hole so the depth shows. Without float textures the flat picture is used. Sizes are not real: each is drawn 5 to 15 degrees wide, between 28 and 604 times its true field of view (the factor for each is listed with its credit on the page). The ray tracer looks them up where each ray ends, so they are lensed with the rest of the sky. Because the hole bends light strongly out to about `sqrt(2 rs / distance)` (15 degrees from 30 rs), a nebula near the hole in the view becomes arcs or a ring; pulling back (now out to 600 rs) or looking away shows it undistorted.
- **Looking around.** `L` turns the camera where it stands (drag) and makes the scroll wheel a telescope zoom (0.4 to 10 times). `N` turns to face each nebula in turn. The name and credit of the nebula within a few degrees of the view's centre are shown at the bottom left, so the credit stays with the image.
- **Star spikes.** Catalogue stars brighter than magnitude 2.3 are drawn with four spikes, as a telescope with a supported secondary mirror shows them. Decoration.
- **Rendering.** WebGL2, HDR target, six-level bloom, ACES tone map, adaptive resolution. Pixels whose ray went more than half way round the hole are averaged over five rays.

## Checks

Maths, run in Node (`src/ktest*.js`):

| Check | Result | Exact |
|---|---|---|
| Spin 0: critical impact parameter; bending at b = 20 rs | 2.5981; 6.194 deg | 2.5981; 6.194 deg |
| Critical impact parameter in the equatorial plane, with and against the spin, at spin 0.5 and 0.9 | 2.0481 and 3.0691; 1.4222 and 3.4162 | the same to 4 decimals |
| Spin 0.998 | 1.0631 and 3.4983 | 1.0554 and 3.4983 (the page caps spin at 0.95) |
| Prograde circular orbits at spin 0 and 0.9: radius holds over 6 orbits; energy | radius to 4 decimals; energy to 6 decimals | closed forms |
| Innermost stable orbit at spin 0.9 | 2.3209 M | 2.3209 M |
| Exact shadow outline (Bardeen 1973, carried to the camera's frame) against fine-step traced rays, 7 cases: spin 0, 0.5, 0.9; camera 3 to 30 rs; up to 69 deg off the disk | within 0.001% | same edge |
| Thin-disk flux: zero at the inner edge, Newtonian far out, spin-0 closed form | ratio to Newtonian 0.98 at 500 rs; closed form to 3e-15 | |

In the GPU render at 1280 x 800 (probe `__edge()`: the rendered shadow edge against the exact outline, along lines from the outline's middle):

| Check | Result |
|---|---|
| Hovering camera, 10 cases: spin 0, 0.5, 0.9, 0.95; 3 to 100 rs | mean within 0.25% (0.49% at 100 rs, where the shadow is 28 px); worst point about 1 px |
| Falling camera, spin 0, radial fall from rest, at 4, 1.05, 0.95, 0.7, 0.5 and 0.35 rs | mean within 0.08%, worst point 0.52% |
| Same camera: frequency shift looking straight back at 4, 1, 0.7, 0.5, 0.35 rs | 0.6665, 0.4998, 0.4553, 0.4141, 0.3716 against 0.6667, 0.5000, 0.4555, 0.4142, 0.3717 |
| Default ride at spin 0.9, at 3 and 1.5 rs | mean 0.08% and 0.13% |
| Self-check on the page at spin 0.9 | 1.4222 and 3.4162 against 1.4222 and 3.4162 |

Behaviour, with the page's own stepper run without drawing (`__simulate`):

| Check | Result |
|---|---|
| Plain clicks from random camera angles: 150 planets, 75 stars | every one broke up (median 6 to 8 s, 90% within 26 s); all debris gone, median 23 s for planets and 52 s for stars |
| 40 meteors, 40 rockets | all meteors fell in (median 14 s); 37 rockets fell in (median 47 s), 3 still orbiting at 120 s |
| A clicked object's clock | behind the camera's by exactly its light delay (34.2 rs/c at 6.8 rs, camera at 30 rs) |
| An aimed meteor against its predicted path, until it fell in | never more than 0.034 rs from the path |
| Cold shader compile, development machine (RTX 3060 Ti, Chromium) | 1.3 s |
| Real stars with gravity off: Betelgeuse, Rigel, Bellatrix, Saiph and Sirius against their catalogue positions | brightest pixel within 1.4 px of the expected one; Orion upright with north up |
| Catalogue parse: Sirius, Vega, Polaris, Betelgeuse | RA, Dec, V and B-V as published |
| Sky direction seen by a pixel, GPU against the JavaScript tracer, camera at 30, 100 and 400 rs, pixels 150 to 500 px off centre | agree within 0.1 deg in 8 of 8 comparable cases |
| Orion Nebula image with gravity off, against its published position | drawn within about 35 px of the expected place (measured by a rough colour centroid) |

Not checked: the orientation of each nebula image against an independent reference (it follows the published angle and the convention that east is to the left), and how the images look in motion. Not yet re-checked on this branch: solid-object and debris positions against each other, a moving camera with sideways motion against ordinary aberration, and the shadow edge on a ride inside the horizon at spin 0.9 (the shadow is wider than the screen there). Frame rate has only been measured in a hidden browser pane: about 7 ms per frame in the opening view and 6 to 15 ms on a ride at 1280 x 800 (RTX 3060 Ti), against 4 to 5 ms for the non-spinning build.

## What is not physics

The disk streaks are procedural. The catalogue stars are real but the rest of the sky is invented (see Sky), and the stars' colour shift on a ride is a tint, not a spectrum. Exposure and the disk's overall temperature scale are set for the eye. The disk has no thickness.

Launched objects are drawn far too large: at this scale the Sun is 0.11 rs across. The drag is far stronger than a real disk's. Debris lives on a 0.3 rs grid, does not collide or join the disk, and fades; its fade within 0.3 r+ of the horizon is a hand-set factor. One frequency shift is applied per ray to all the debris along it. The rocket only coasts. Object looks and lighting are decoration, and the colour shift of reflected light is a tint, not a spectrum.

Light delay for objects is first order (see above), and an object's second image uses the first image's delay.

On a ride: playback slows as the fall speeds up, the exposure adapts, and the rest of the scene advances by at most three times the rider's own time step. The camera is not destroyed by tides. Directions with no light from outside are black. The interior is the eternal textbook Kerr solution, and the ride ends before the inner horizon.

## Controls

Drag to orbit, scroll to approach, click to launch, hold then drag to aim (or Shift-drag; Esc cancels). Controls: what a click launches, Spin (0 to 0.95), `G` gravity, `D` redshift, `P` predicted shadow edge, `S` sound, `R` ride along (drag to look, scroll to zoom, Esc to leave), `X` clear objects, Readout, How it works.

## Building

`python src/build.py` writes `index.html` and `review.html` from `src/app.js` (the page's script), `src/kerr.js` (the geometry, also loaded by the Node tests) `src/stars.js` and `src/nebulae.js` (the packed catalogue and the image facts), and the markup and reusable shader code of `src/base_page.html` (the earlier, non-spinning page), with the changes in `src/head_patches.py` and `src/sky_patches.py`.

## Sources

- J. M. Bardeen, "Timelike and null geodesics in the Kerr metric," in Black Holes (Les Astres Occlus), 1973: the shadow edge.
- D. N. Page and K. S. Thorne, "Disk-Accretion onto a Black Hole. Time-Averaged Structure of Accretion Disk," Astrophysical Journal 191, 499 (1974): the disk's flux.
- J.-P. Luminet, "Image of a spherical black hole with thin accretion disk," Astronomy and Astrophysics 75, 228 (1979): the first image of this kind. Real-time black hole ray tracers are a well-established genre; this is not the first.
- ESA/Hubble (esahubble.org): the twelve nebula images, Creative Commons Attribution 4.0. Image ids heic0601a, heic1307a, heic0515a, heic1007a, heic1206a, heic0910h, heic1501a, heic2608a, heic1310a, heic1608a, heic0414a, opo0432d. Individual credits are in `src/pack_nebulae.py` and on the page.
- GRAVITY Collaboration: the mass of Sagittarius A*, 4.3 million solar masses.
- D. Hoffleit and W. H. Warren Jr., The Bright Star Catalogue, 5th Revised Ed. (Preliminary Version), Astronomical Data Center, NSSDC/ADC, 1991 (catalogue V/50). Fetched from the Harvard TDC copy, `tdc-www.harvard.edu/catalogs/ybsc5.gz` (573,921 bytes). Its ReadMe states no licence or terms of use. The raw file is not in this repository; `src/stars.js` holds the packed positions.

Made by Walker Robinson with Claude.
