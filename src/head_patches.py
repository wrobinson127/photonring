# markup and style changes on top of the old page (run inside build.py; uses rep())
rep("  .btn.sm{padding:8px 12px}", "  .btn.sm{padding:8px 12px}\n  #spin{width:150px;accent-color:var(--amber);cursor:pointer}\n  #spinV{min-width:2.6em;text-align:right;color:var(--ink)}")
rep("""    <div class="row">
      <button class="btn" id="bG" aria-pressed="true\"""", """    <div class="row">
      <span class="lab">Spin</span><input id="spin" type="range" min="0" max="0.95" step="0.01" value="0.9" aria-label="Spin of the black hole, as a fraction of the most it could have"><span class="lab" id="spinV">0.90</span>
    </div>
    <div class="row">
      <button class="btn" id="bG" aria-pressed="true\"""")
rep("""    <tr><td>Shadow edge, b / r<sub>s</sub></td><td id="cB">&hellip;</td><td>2.5981</td></tr>
    <tr><td>Bending at b = 20 r<sub>s</sub></td><td id="cD">&hellip;</td><td>6.194&deg;</td></tr>""",
"""    <tr><td>Closest pass that escapes, going with the spin (r<sub>s</sub>)</td><td id="cB">&hellip;</td><td id="cBx">&hellip;</td></tr>
    <tr><td>The same, going against the spin</td><td id="cD">&hellip;</td><td id="cDx">&hellip;</td></tr>""")

# ---- How it works, rewritten for the spinning hole ----
_a = head.index("  <h2>How it works</h2>"); _b = head.index("  <h3>Credit</h3>")
head = head[:_a] + '''  <h2>How it works</h2>
  <p>Nothing here is a picture or a video. Your graphics card draws every frame from the equations below.</p>

  <h3>1. Light paths</h3>
  <p>For each pixel, one ray is traced backward from the camera. The hole spins, so the space around it is the Kerr solution. The page writes it in Kerr-Schild form: flat space plus one extra term.</p>
  <div class="eq">g = &eta; + f l l<br>f = r<sub>s</sub> r&sup3; / (r&#8308; + a&sup2;y&sup2;)</div>
  <p>Here a is the spin and y is the height above the disk. Each ray obeys Hamilton's equations for</p>
  <div class="eq">H = &frac12; g<sup>&mu;&nu;</sup> p<sub>&mu;</sub> p<sub>&nu;</sub></div>
  <p>stepped with a fourth-order Runge-Kutta integrator, up to <span id="pSteps">320</span> steps per pixel. These coordinates stay finite at the horizon, which is what lets the camera cross it.</p>

  <h3>2. The disk</h3>
  <p>Gas orbits in a thin disk that starts at the innermost stable orbit. Without spin that is 3 r<sub>s</sub>. Spin pulls it inward, to 1.16 r<sub>s</sub> at a spin of 0.9, where the gas is hotter and faster. Its color is a black body at the temperature the camera measures after the frequency shift</p>
  <div class="eq">g = (p &middot; u)<sub>camera</sub> / (p &middot; u)<sub>gas</sub></div>
  <p>where p is the light's momentum and u is a four-velocity. The Doppler shift, the pull of gravity on the light and the camera's own motion all come out of that one ratio. Brightness scales as g&#8308;. The temperature across the disk follows the relativistic thin-disk formula of Page and Thorne (1974).</p>

  <h3>3. What you are seeing</h3>
  <p>The arc over the top of the shadow is the far side of the disk. Its light was bent up and over the hole. The thin bright rings hugging the shadow are light that circled the hole before escaping. The shadow is not round: on the side where the spin turns toward you, light can pass closer and still escape, so that edge is flattened. Slide the spin to 0 and it becomes a circle.</p>

  <h3>4. The page checks itself</h3>
  <p>General relativity gives exact values for how close light can pass the hole and still escape, on each side. On load, and whenever you change the spin, the same stepping rule runs in JavaScript and is compared with them.</p>
  <table>
    <tr><th>Quantity</th><th>This page</th><th>Exact</th></tr>
    <tr><td>Closest pass that escapes, going with the spin (r<sub>s</sub>)</td><td id="cB">&hellip;</td><td id="cBx">&hellip;</td></tr>
    <tr><td>The same, going against the spin</td><td id="cD">&hellip;</td><td id="cDx">&hellip;</td></tr>
  </table>
  <p>The Prediction button draws the exact shadow edge (Bardeen, 1973) for wherever the camera is and however it moves, so you can see the two agree.</p>

  <h3>5. Things you launch</h3>
  <p>Click to launch a meteor, a planet, a star or a rocket. Hold, then drag, to choose its direction and speed. The blue glow is the path it will take. Each one free-falls by the same equations as the light, with mass. An orbit swings around instead of closing, and anything that comes too near is pulled in.</p>
  <p>Each object is drawn where it was when the light now reaching you left it. That is why something falling in never seems to arrive: its last light takes longer and longer to climb out, so it reddens and fades just outside the horizon.</p>

  <h3>6. Drag and tides</h3>
  <p>An orbit does not decay by itself. Things fall in here because the disk slows them. Inside the disk an object is dragged toward the speed of the gas, which circles the hole and drifts inward. Where it ploughs through, the heated gas glows.</p>
  <p>Gravity pulls harder on the near side of an object than on the far side. Close in, that difference beats the gravity holding a planet or a star together, at a distance of about</p>
  <div class="eq">(3 M<sub>hole</sub> / 4&pi;&rho;)<sup>1/3</sup></div>
  <p>where &rho; is the object's density. For a hole of 4.3 million Suns, the mass of the one at the centre of our galaxy, a planet as dense as Earth comes apart at 5.7 r<sub>s</sub> and a star like the Sun at 8.9 r<sub>s</sub>. The page then swaps the object for a few hundred pieces that keep its velocity but start at different points across it, so each follows its own orbit and they spread into a stream. A meteor or a rocket is held together by the strength of its material, and stays whole.</p>
  <p>The debris is drawn by the same ray tracer, as glowing gas, so it is bent, doubled and color-shifted like everything else.</p>

  <h3>7. Riding along</h3>
  <p>Ride along puts the camera on the path of the last thing you launched, or on a path of its own if nothing is flying. A moving camera sees two more effects. Light from the direction of travel arrives bunched together and shifted toward blue. Light from behind is spread out and reddened. Brightness follows the fourth power of that shift, which is why the rings blaze on the way in.</p>
  <p>The camera crosses the horizon in a finite time on its own clock, while the far-away clock runs off without limit. Inside, light from outside still arrives, so the sky stays in view beside the shadow. The ride stops between the hole's outer and inner horizons.</p>
  <p>With the spin at 0, a camera falling straight in from rest should see the shadow's edge 42.1&deg; from its middle at the moment of crossing. Tested against that exact curve, the render agrees within about 0.5%, from 4 r<sub>s</sub> down to 0.35 r<sub>s</sub>.</p>

  <h3>What is not physics</h3>
  <p>The streaks in the disk are procedural noise, drawn for texture. The stars brighter than magnitude 6.5 are real: their positions, brightness and colors come from the Yale Bright Star Catalogue, and the band of the Milky Way lies on the real galactic plane. It is the sky as seen from Earth, placed around a hole that is not there. The fainter stars, the gas clouds, the galaxies and the texture of the band are invented. The exposure and the disk's overall temperature scale are set for the eye. The disk has no thickness.</p>
  <p>Launched objects are drawn far too large for the hole: at this scale the Sun would be a tenth of an r<sub>s</sub> across and Earth a dot. The disk's drag is set far stronger than a real disk's, so that things fall in while you watch. Debris is kept on a grid with cells 0.3 r<sub>s</sub> wide, does not collide or join the disk, and fades after a while. Its fading close to the horizon is set by hand. The rocket only coasts. The looks and lighting of objects are decoration, and the color shift of their reflected light is approximate.</p>
  <p>For the disk, the delay of light is added up along each ray. For objects it is the straight-line time plus the standard first-order gravitational delay, with the exact extra delay close to the horizon, and an object's second image uses the same delay as its first.</p>
  <p>On a ride, playback slows as you fall so the last part can be watched, the exposure closes down when the view fills with bright gas, and the rest of the scene never runs more than three times faster than your own clock. The camera is not torn apart. Directions that receive no light from outside are drawn black. Below the inner horizon the textbook solution stops describing a real hole, so the ride ends before it.</p>

''' + head[_b:]

rep("  <p>Made by Walker Robinson with Claude.</p>", "  <p>Made by Walker Robinson with Claude. Star positions from the Yale Bright Star Catalogue, 5th revised edition (Hoffleit and Warren, 1991).</p>")

# ---- nebula images: look-around control, credits ----
rep('      <button class="btn" id="bN" aria-pressed="false"', '      <button class="btn" id="bL" aria-pressed="false" title="Turn the camera to look around the sky, and zoom like a telescope (L)">Look around<kbd>L</kbd></button>\n      <button class="btn" id="bN" aria-pressed="false"')
rep("Hold, then drag to aim &nbsp;&middot;&nbsp; R to ride along</div>", "Hold, then drag to aim &nbsp;&middot;&nbsp; R to ride &nbsp;&middot;&nbsp; L to look around</div>")
rep("  #hint.gone,body.riding #hint{opacity:0}", "  #hint.gone,body.riding #hint{opacity:0}\n  #credit{left:28px;bottom:18px;font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--faint);text-shadow:0 0 10px #000,0 1px 2px #000;pointer-events:none}\n  body.readout #credit{display:none}\n  #nebCredits p{font-size:13px;line-height:1.45;margin:0 0 8px}\n  #nebCredits span{color:var(--ink)}")
rep('<div id="note" class="ui"></div>', '<div id="note" class="ui"></div>\n<div id="credit" class="ui">Nebula images: NASA, ESA and the Hubble teams. Full credits under How it works.</div>')
rep("  <h3>What is not physics</h3>", """  <h3>8. The nebulae</h3>
  <p>The twelve nebulae are real Hubble Space Telescope images. Each sits where it really is among the stars, turned the way it really lies, using the coordinates published with the image. Their light is bent by the hole like everything else: drag the camera until one is behind the hole and it smears into arcs. Press L to turn the camera and look around, and scroll to zoom like a telescope.</p>

  <h3>What is not physics</h3>""")
rep("The fainter stars, the gas clouds, the galaxies and the texture of the band are invented.", "The fainter stars, the soft gas clouds, the small galaxies and the texture of the band are invented. The Hubble images are real but drawn far too large: at their true size every one would be smaller than the Moon, most of them specks. The enlargement of each is listed with its credit below. Their brightness is set for the eye, and each is a flat picture on the sky, not a cloud you could fly through.")
rep("  <p>Made by Walker Robinson with Claude. Star positions from", "  <p>Made by Walker Robinson with Claude. Nebula images from ESA/Hubble (esahubble.org), used under the Creative Commons Attribution 4.0 licence:</p>\n  <div id=\"nebCredits\"></div>\n  <p>Star positions from")

# ---- next nebula, and a caption that names the nebula in view ----
rep('      <button class="btn" id="bL" aria-pressed="false"', '      <button class="btn" id="bT" title="Turn to face the next nebula (N)">Next nebula<kbd>N</kbd></button>\n      <button class="btn" id="bL" aria-pressed="false"')
rep("R to ride &nbsp;&middot;&nbsp; L to look around</div>", "R to ride &nbsp;&middot;&nbsp; N for the next nebula</div>")
rep("  #credit{left:28px;bottom:18px;", "  #credit{left:28px;bottom:18px;max-width:46vw;line-height:1.5;")
rep("Press L to turn the camera and look around, and scroll to zoom like a telescope.</p>", "Press N to turn and face each one in turn, or L to look around freely, and scroll to zoom like a telescope. The name and credit of the nebula in front of you show at the bottom left.</p>")

# ---- link preview ----
rep('<meta name="description" content="A black hole traced live in your browser. Every pixel follows a light path through curved spacetime. One file, no libraries, no images.">',
    '<meta name="description" content="A spinning black hole traced live in your browser, among real stars and Hubble nebulae. Every pixel follows a light path through curved spacetime.">\n<meta property="og:title" content="Photon Ring">\n<meta property="og:description" content="A spinning black hole traced live in your browser, among real stars and Hubble nebulae.">\n<meta property="og:image" content="https://photonring.walker-robinson.com/og.png">\n<meta property="og:url" content="https://photonring.walker-robinson.com/">\n<meta property="og:type" content="website">\n<meta name="twitter:card" content="summary_large_image">')

# ---- final copy, approved by Walker 2026-11-19: replaces the whole How it works panel and the short strings ----
import re as _re2
_a = head.index("  <h2>How it works</h2>"); _b = head.index("</aside>", _a)
head = head[:_a] + """  <h2>How it works</h2>

  <h3>1. Light</h3>
  <p>One ray per pixel, traced backward through the space around a spinning black hole.</p>
  <div class="eq">g = &eta; + f l l<br>f = r<sub>s</sub> r&sup3; / (r&#8308; + a&sup2;y&sup2;)<br>H = &frac12; g<sup>&mu;&nu;</sup> p<sub>&mu;</sub> p<sub>&nu;</sub></div>
  <p>Up to <span id="pSteps">320</span> Runge-Kutta steps per ray. These coordinates stay finite at the horizon.</p>

  <h3>2. Disk</h3>
  <p>Gas orbits from 1.16 r<sub>s</sub> outward at spin 0.9 (3 r<sub>s</sub> at spin 0). Color is a black body at the shifted temperature. Brightness scales as g&#8308;.</p>
  <div class="eq">g = (p &middot; u)<sub>camera</sub> / (p &middot; u)<sub>gas</sub></div>
  <p>Temperature profile: Page and Thorne (1974).</p>

  <h3>3. The picture</h3>
  <p>The arc over the shadow is the far side of the disk. The thin rings are light that circled the hole. The flat edge is the side spinning toward you.</p>

  <h3>4. Checks</h3>
  <table>
    <tr><th>Closest light can pass and escape (r<sub>s</sub>)</th><th>This page</th><th>Exact</th></tr>
    <tr><td>With the spin</td><td id="cB">&hellip;</td><td id="cBx">&hellip;</td></tr>
    <tr><td>Against the spin</td><td id="cD">&hellip;</td><td id="cDx">&hellip;</td></tr>
  </table>
  <p>P overlays the exact shadow edge (Bardeen, 1973).</p>

  <h3>5. Objects</h3>
  <p>They free-fall by the same equations. You see each where it was when its light left, so one falling in fades just outside the horizon.</p>

  <h3>6. Drag and tides</h3>
  <p>The disk drags objects inward. A planet or star breaks up at about</p>
  <div class="eq">(3 M<sub>hole</sub> / 4&pi;&rho;)<sup>1/3</sup></div>
  <p>For a hole of 4.3 million Suns: 5.7 r<sub>s</sub> at Earth's density, 8.9 r<sub>s</sub> at the Sun's.</p>

  <h3>7. The ride</h3>
  <p>R follows the last object launched, through the horizon. Light ahead shifts blue, light behind red.</p>
  <p>At spin 0, a camera falling from rest should see the shadow's edge 42.1&deg; from its middle at the horizon. The render agrees within about 0.5%.</p>

  <h3>8. Nebulae</h3>
  <p>Twelve Hubble images at their real positions and orientations.</p>

  <h3>Not physics</h3>
  <p><b>Sky.</b> Stars to magnitude 6.5 are real, as seen from Earth. Fainter stars, clouds and galaxies are invented.</p>
  <p><b>Nebulae.</b> Drawn 28 to 604 times too large.</p>
  <p><b>Disk.</b> No thickness. Streaks are noise.</p>
  <p><b>Objects.</b> Far too large. Drag far too strong.</p>
  <p><b>Debris.</b> Fades by a hand-set rule.</p>
  <p><b>Light delay.</b> First-order for objects.</p>
  <p><b>Ride.</b> Playback slows as you fall. Exposure adapts.</p>
  <p>Brightness and exposure are set by eye throughout.</p>

  <h3>Credit</h3>
  <p>Made by Walker Robinson with Claude. Nebula images: ESA/Hubble, CC BY 4.0.</p>
  <div id="nebCredits"></div>
  <p>Stars: Yale Bright Star Catalogue (Hoffleit and Warren, 1991).</p>
""" + head[_b:]
head = head.replace('  #panel .eq{', '  #panel p b{font-weight:400;color:var(--ink)}\n  #panel .eq{', 1)
head, _n = _re2.subn(r'<div id="hint" class="ui">.*?</div>', '<div id="hint" class="ui">Drag &nbsp;&middot;&nbsp; Scroll &nbsp;&middot;&nbsp; Click to launch &nbsp;&middot;&nbsp; Hold and drag to aim &nbsp;&middot;&nbsp; R ride &nbsp;&middot;&nbsp; N nebulae</div>', head); assert _n == 1
head, _n = _re2.subn(r'<div id="credit" class="ui">.*?</div>', '<div id="credit" class="ui">Images: NASA, ESA, Hubble. Credits in How it works.</div>', head); assert _n == 1
head, _n = _re2.subn(r'<meta name="description" content="[^"]*">', '<meta name="description" content="A spinning black hole traced live, among real stars and Hubble nebulae.">', head); assert _n == 1
head, _n = _re2.subn(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="A spinning black hole traced live, among real stars and Hubble nebulae.">', head); assert _n == 1
