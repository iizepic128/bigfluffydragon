# NeO 777 — development handoff

## Current snapshot

Alpha 1.1 is the current source of truth. Three.js, TypeScript and Vite; original emerald-and-gold NeO 777 assets remain unchanged. Start from this existing project folder; cloud tasks are already isolated and do not require another worktree.

The source began as a user-uploaded ZIP in an empty GitHub checkout. Alpha 1.1 is now committed and delivered on the `codex/neo777-alpha-1-1` branch of `iizepic128/bigfluffydragon`. Preserve this branch and existing local work rather than replacing it with older source.

## Launch and checks

Requires Node.js 20.19+ or 22.12+ (validated with Node 24.19.0). In Windows PowerShell, use `npm.cmd ci` then `npm.cmd run dev -- --port 5173 --strictPort` from the folder containing package.json. Stop your previous game server first. Cloud Bash paths are not Windows commands.

`npm test` runs Node tests via a TypeScript loader. `npm run build` runs strict TypeScript and the production Vite build. The lockfile pins the validated dependency tree. Existing 500 KB bundle warning is nonfatal.

## Architecture

- `src/main.ts`: original procedural city, gameplay, missions/shops/save keys, player input, pursuit states, camera and HUD.
- `src/vehiclePhysics.ts`: shared ground-plane capsule bodies, mass/inertia, impulse/friction contacts, substeps, world constraints, player handling and AI velocity commands. No rendering dependency.
- `src/vehicleVisuals.ts`: original cars, bounded panel-space dents with sleeping buffers, wheel steering/spin and acceleration-driven suspension. Dents remain visual; collision shape stays stable.
- `src/policeVision.ts`: shared heading/range/field-of-view rules and top-down wall-clipped vision outlines.
- `src/minimap.ts`: GPS and interactive map; red patrol/orange officer cones while wanted, brighter when that observer sees you. Ground cones are 120 degrees with 47/34-unit ranges; nearby awareness radius is 2.4. Actual detection also requires the existing 3D line of sight.

## Behavior to preserve

WASD walk/drive, Shift sprint, E interact/enter/exit/surrender, Space brake, F repeated grapple resistance, R safe reset, M/Esc map. Development-only 5/0 shortcuts must remain disabled in production. Preserve `neon-save` and `neo777-save` cash/rep/completed/upgrades. Browsers store progression by origin, so use the same hostname and port when updating.

Missions, shops, cash/ragdolls, five wanted stars, helicopter, canals/bridges/cover, wanted cooldown and original branding remain. Officers extract only stopped/slow cars (actual speed <=2.5), need a reachable clear exit and sight, and cancel pull progress when the car drives away. Seven distinct F presses within 3.8 seconds escape; otherwise a smooth red COOKED sequence leads to the existing fine and safe respawn.

Player and patrol vehicles use the same momentum state. Road drag and traction intentionally dissipate energy. Pair impulses conserve linear momentum; only approaching contacts receive impulses. Steering/engine commands do not reset collision velocity. Saved upgrade counts are retained; tuning benefits level off after ten upgrades to keep speed and simulation cost bounded.

## Validation and remaining limits

The production build and automated physics/vision/deformation tests passed. Controlled Chromium checks verify driving/braking/entry/exit, momentum transfer, dents/repair, extraction, grapple escape/timeout, progressive red arrest overlay, both save keys and reload, map controls and dev/production shortcut policy. Setup-only browser probes live outside the project checkout under `/workspace/.neo777-onboarding`; there are no shipping debug state hooks.

This is stylized ground-plane physics with visual suspension/deformation, not volumetric soft bodies or arbitrary-terrain tire contact. Patrol obstacle avoidance is lightweight and does not promise global route planning. Full desktop GPU performance and extended play sessions still need playtesting.

Run `npm test` and `npm run build` after each meaningful update. Use README's manual tests to cover pileups, walls/canal crossings, extraction interruption, repeated arrests, hiding/cooldown, mission/shop/garage interactions, map controls, focus loss and saved progression. Keep features incremental and all names/assets original.
