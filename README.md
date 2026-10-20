# JoJo Journey — franchise progress tracker

This branch includes the finished JoJo tracker in [`jojo-journey/`](jojo-journey/README.md), with a visual timeline, all nine parts, separate anime/manga progress, adaptation coverage, and configurable Friday/monthly release estimates.

**[Download the Opera-ready ZIP](https://github.com/iizepic128/bigfluffydragon/raw/refs/heads/JoJo%27s-BS/jojo-journey/jojo-journey.zip)**

Extract the ZIP, then open `JoJo-Journey.html` in Opera using **Ctrl+O** (**Command+O** on Mac). Windows users can also run `Open in Opera.cmd`. No Node or server is needed for the standalone app.

For a development preview, open a terminal in `jojo-journey` and run `npm start` (Node.js 22.13+). See the [app README](jojo-journey/README.md) and [verification report](jojo-journey/TESTING.md) for features, release assumptions, and browser test limitations.

---

# Neon Outlaws
Original stylized 3D open-world browser game alpha built with Three.js, TypeScript, and Vite.

## Alpha 1.2: launch on Windows PowerShell

Extract `NeO-777-Alpha-1.2.zip` to a new folder, then open PowerShell in the folder containing `package.json`. If an older game server is running, stop it with Ctrl+C in its terminal first. Use the same browser address and port as before to keep browser progress.

```powershell
npm.cmd ci
npm.cmd run dev -- --port 5173 --strictPort
```

Open the local address Vite prints. Check for **ALPHA 1.2** in the HUD. The `.cmd` suffix works in PowerShell even when its script policy blocks `npm.ps1`. Cloud-only Bash helpers and `/workspace` paths are not Windows commands. If port 5173 is occupied, stop your previous game server; the strict port option prevents silently moving to a different browser save origin.

To test an update, run these in a second terminal in the same folder:

```powershell
npm.cmd test
npm.cmd run build
```

The automated checks cover physical momentum/energy, mass differences, separating contacts, fast impacts, piles, walls/canals, braking/traction, frame-rate consistency, police vision, deformation sleep and repair. For a production browser check, stop the dev server and run `npm.cmd run preview -- --port 5173 --strictPort`. Development-only wanted shortcuts are disabled in production.

## Alpha 1.2: hit officers with your car

- Drive a moving car into an officer on foot to knock them into a non-graphic ragdoll reaction. Forward, reverse, angled and turning impacts use the car's actual swept footprint. The car needs roughly 9 MPH; parked or barely moving cars do not repeatedly trigger hits.
- A struck officer's pull/arrest attempt is interrupted. Their unit cannot shoot or arrest for 6.5 game seconds; after recovery it rejoins the existing pursuit. Each officer hit adds one wanted star, capped at five, and reports the incident location. Existing F grapple escape and all driving controls remain.
- The car's minimap arrow follows actual travel direction: north-to-south movement points down, including when reversing. At a stop it shows body facing without jitter. Police cones still show the officers' facing and detection direction.

To test in the dev server: press **5**, wait for officers to leave nearby patrols, enter your car with **E**, then use **W/S** to drive through an officer. Watch the ragdoll, wanted response and interrupted arrest warning. Press **0** to clear wanted. Check the arrow while driving north/south, reversing and turning. These debug wanted keys are disabled in production.

## Alpha 1.1 gameplay changes

- All civilian and patrol cars share mass-based linear/angular momentum and pair contacts. Elongated capsule colliders cover the length of the car; substeps prevent fast cars skipping contacts. Pursuit uses the same velocity state rather than separate translations.
- Driving preserves impact momentum and recovers lateral traction gradually. Braking works in forward/reverse, damage reduces power/grip/top speed, and sprung body weight shifts use real acceleration. Both front wheels steer and wheels/hubs spin together.
- Localized, capped dents use the sprung chassis transform. Settled dents stop recomputing normals/uploading vertex buffers. Garage repairs restore panels, lamps and suspension.
- Extraction requires an officer with sight, a reachable clear exit, and actual car speed at most 2.5 world units/second. Accelerating away cancels the pull timer. Seven distinct F presses within 3.8 seconds escape; arrests show a smooth red COOKED reveal and apply the existing fine/respawn.
- While wanted, **red patrol cones and orange officer cones** appear on the minimap and full map. They share the real 120-degree ground police field of view, follow headings, use 47-unit patrol/34-unit officer ranges, and stop at eye-level building/pillar footprints. Brighter cones indicate that unit sees you. Very close officers can notice you beside/behind them; elevated helicopter cover still uses the existing 3D sight checks. Cones disappear when wanted clears.
- Safe exits/resets account for patrol cars. Movement keys clear on focus loss and when the map opens. Both existing save keys remain compatible; malformed/unavailable storage no longer crashes the game.

This remains lightweight arcade physics on the ground plane, with visual suspension/deformation. It does not simulate tire contact over arbitrary terrain or volumetric soft bodies.

### Manual gameplay checks

1. Use E to enter a car, drive into a parked car/patrol, try angled impacts and braking, then visit the Garage with enough cash for a repair.
2. In the dev server, press 5: inspect cones on the radar and M map. Face away from a patrol or hide behind a building; hide under a shelter/skybridge to block the helicopter. Wanted cooldown should advance only when all units lose sight.
3. Stop near an officer to be extracted, press F seven times to escape, then try again without resisting to see COOKED. Accelerating away during the pull should prevent extraction.
4. Start a mission at the central yellow marker, finish it, buy an upgrade, refresh, and verify cash/reputation/completed missions/upgrades persist. Keep the same browser hostname and port.

The automated build/browser checks were run in Linux Chromium with software WebGL. Windows launch commands are standard npm commands; full desktop GPU performance and long gameplay sessions still need playtesting.

## Run
Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```
Open the local URL Vite prints (usually http://localhost:5173).

## Controls
WASD move/drive, Shift sprint, E interact/enter/exit vehicle, Space brake, R reset position.

## Gameplay
Visit the yellow marker near the spawn to start missions, reach mission destinations, earn cash and reputation, purchase upgrades at green shop markers, drive cars and evade police. Progress saves to localStorage.

## Current alpha limitations
Simple procedural city, low-poly humanoids (not photorealistic), basic NPC wandering and pursuit AI, simplified 2D world collisions and approximate articulated ragdolls rather than full rigid-body physics. No detailed interiors or story cutscenes. All geometry is generated from code and is original.

## Alpha 0.2 collisions
Buildings block movement. Player, NPCs, cars, and police use ground-plane collision circles with substeps and wall sliding. Vehicle exits require free space. This is simplified 2D collision, not full rigid-body physics.

## Alpha 0.3 police and HUD fix
Entering a car is legal in this prototype and does not trigger police. Missions can still create heat. Wanted stars are in a dedicated HUD display. Lose the police (stay more than 25 units away) to let heat decay.

## Alpha 0.4: vehicle impacts, cash pickups, five wanted stars, improved characters
- Pedestrians hit by a moving vehicle tumble into articulated ragdolls for 28 seconds. No gore.
- Each hit immediately drops a glowing cash stack ($20–$80). Walk or drive near it to collect before it disappears after 38 seconds.
- Each pedestrian collision adds one wanted star (maximum five). Police response scales up from one patrol at one star to six vehicles at five stars.
- Entering a vehicle by itself does not increase wanted status. A mission can still trigger a police alert.
- Characters have articulated legs and arms, walking animation, distinct skin tones, hair, eyes, clothing, and shoes. Still an original stylized visual design.
- Vehicle impacts are swept along the actual motion, so a wall prevents hits behind it.

Upgrade: Stop the Vite server with Ctrl+C, replace the prior files with this project's files, then run `npm install` and `npm run dev`. Refresh with Ctrl+Shift+R. Your progress is saved in the browser's localStorage.

## Alpha 0.5: police helicopter, bridges and hiding
- A low-poly police helicopter spawns **only at five wanted stars**. It has moving main and tail rotors and a searchlight. It disappears when wanted drops below five.
- The helicopter pursues the player only while it has line of sight; buildings, skybridge decks and open-sided parking shelters block the view. Once sight is lost, it searches the last known location.
- New **two canals and ten crossing bridges**. Water is physically blocked outside of bridges, so players and cars need to cross on the actual decks.
- Six elevated skybridges across roads and four roofed parking shelters provide places to hide from the helicopter. Collision pillars on the shelters prevent driving through supports.
- A dedicated cover indicator shows SPOTTED, HIDDEN or SEARCHING when at five stars.
- At five stars, losing police line of sight lets wanted heat decay faster; nearby ground patrols still prevent escape.

**Testing tip:** To reach five stars, hit pedestrians with your car (each hit adds one wanted star); then drive under an elevated skybridge or into a roofed parking shelter to break the helicopter sight line.

This is still stylized, arcade-like pursuit AI rather than a full flight simulation.

**Developer testing shortcuts (Vite dev server only):** Press `5` to trigger five wanted stars and summon the helicopter; press `0` to clear wanted level and make it leave. These keys are inactive in production builds.

## Alpha 0.6: interactive GPS minimap + tropical-gradient VI favicon
- Working north-up circular minimap in the bottom-right HUD, with player direction and real-time police/helicopter locations, road grid, two canals, crossing bridges, skybridges, parking shelters, missions and shops.
- New **M** key (or MAP button) opens a larger city map. Click any colored destination marker to change GPS guidance. Press M or Esc to close. “Navigate to mission” resets the custom target.
- GPS draws an A* route that avoids solid building footprints and canals, crossing at the bridges; road segments are preferred. Route is recalculated as you travel, and remaining straight-line distance is shown beneath the radar.
- **+ / −** buttons change radar zoom. Legend explains map markers.
- New original neon-tropical **VI** icon is installed as `public/favicon.ico` and `public/favicon.png`, with an `apple-touch-icon.png` for bookmarks. The game remains Neon Outlaws (an original work).

To update, stop the local server, replace the entire extracted project folder, run `npm install` and `npm run dev`. Hard refresh to update a cached favicon.


## Alpha 0.7 branding update
- Added the new NeO 777 casino-style logo to the HUD.
- Replaced the browser favicon and touch icon with the NeO 777 logo.
- Updated the map and page title branding to match.

## Alpha 0.8: Ground police, arrest/shooting, wanted cooldown, NeO 777 logo fix
- Police units now chase last **seen** locations rather than magically following the hidden player. They exit stopped patrol cars, pursue on foot, and can arrest the player at close range. Press E near an officer to surrender.
- At three or more stars, officers shoot when they have clear sight and are within range. Damage is stylized (no gore), with visible tracer flashes, a health bar, and a respawn/fine on arrest or zero health.
- Wanted decay **pauses and resets while spotted**. Once all police and the helicopter lose sight, the visible timer counts down. One star drops after it expires, then a fresh timer starts. Each star can be evaded fully by staying out of sight.
- Original **NeO 777** green-and-gold casino logo and all browser icons now use new versioned filenames (`neo777-*v08`) to avoid stale browser caching. Look for ALPHA 0.8 in the top left to confirm the new files are running.
- **IMPORTANT INSTALL:** This ZIP has `package.json` at its ROOT. In PowerShell, first `cd` to the directory with your **current** `package.json`, then use `Expand-Archive -Path "$HOME\Downloads\neo777-alpha-0.8.zip" -DestinationPath . -Force`. Do not unzip into a second nested folder. Then run `npm install; npm run dev`. Refresh with Ctrl+Shift+R or open a private window.
- Vite-only debug keys: `5` = five stars; `0` = clear.


## Alpha 0.9 — Car momentum, forced extraction, COOKED screen
- Collisions among **all civilian and police vehicles** transfer momentum. Bumped vehicles coast and slow from road friction; collision positions are checked against walls, other cars, buildings and water crossings. Still uses lightweight circular arcade collision, not full rigid-body physics.
- Police arriving near a slow or stationary player car now start pulling you out after about **1.25 seconds**. They need physical proximity and a clear position beside the car. To avoid this, accelerate or drive away.
- On foot, police grab the player and begin an animated, non-graphic struggle. **Mash F seven times before 3.8 seconds** to break free; otherwise, you are arrested.
- On arrest, the screen darkens and huge **COOKED** text slowly reveals in bright red. After the brief sequence, you respawn at the city center and pay a fine.
- Helicopter update now runs each frame at five stars.
- All old save data retained. As in Alpha 0.8, extracted ZIP contains `package.json` at the root. Replace the files in the correct game directory and hard-refresh the browser.
- Developer keys (Vite only): `5` triggers five stars, `0` clears them.


## Alpha 0.9 / 1.0: impact motion, police extraction, deformable cars
- Moving cars push stationary civilian cars and police cars with an arcade impulse solver and gradual drag.
- Officers can pull you out of a stopped/slow car, grapple and attempt arrest. Repeatedly press **F** to resist. An arrest triggers a gradually revealed large red **COOKED** screen.
- Vehicle bodies use per-vertex dents on the hood, body, trunk, and bumpers. The shape remains deformed until repaired; bump/spring response mimics soft material. This is a **lightweight visual soft-body approximation, not actual finite-element or rigid-body physics**.
- Steering smooths with speed, braking is progressive, inertia affects grip, springy body pitch/roll and turning wheel motion make driving more expressive. Impact damage moderately reduces acceleration, grip, and top speed.
- Damage and speed are shown on the HUD while driving. Garage upgrades also repair the nearest civilian car (within 16 units).
- Existing cash, missions and progression use the same save keys as previous alphas.
- All original NeO 777 icon and minimap assets are retained.
