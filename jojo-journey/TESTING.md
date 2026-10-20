# UI verification

The production bundle passed **23 UI scenarios**, all **10 model tests**, and the original desktop/mobile browser smoke checks. No unexpected JavaScript exceptions occurred during the passing UI audit. The TypeScript check and Vite production build passed.

## Fixes made during the audit

- Replaced the decorative publication-order dropdown with a working sort control: publication order, most progress, or least progress.
- Kept quick-log actions within the selected format. Anime-only views no longer offer manga logging for uncataloged anime.
- Made import and export accessible on phone layouts, including an accessible name for the icon-only import button.
- Kept keyboard focus inside dialogs and the open mobile navigation drawer, restored focus on close, and added Escape handling for the drawer.
- Prevented the closed mobile sidebar from receiving focus or appearing as available navigation to assistive technology.
- Stopped partial adaptation coverage from rounding up to “Fully adapted.” Updated the explanatory text to reflect the current catalog rather than the initial defaults.

## Coverage

| Area | Checks performed |
| --- | --- |
| Navigation | All sidebar routes, home logo, hero start/continue behavior, completed-journey fallback, adaptation summary link, profile/help controls |
| Parts and timeline | All 45 opening controls across nine parts: artwork, title, detail arrow, timeline node, and adaptation row |
| Personal progress | Both steppers, minimum/maximum bounds, invalid input rejection, completion/caught-up actions, notes, favorite toggles, undo, cancel, and reload persistence |
| Library | All format/status filters, search by title/protagonist/location, keyboard search shortcut, clear search, empty states, and all three sort modes |
| Catalog | All 27 count fields, invalid chapter coverage, missing-anime validation, progress clamping, undo, cancel, and part-to-catalog navigation |
| Adaptation | Coverage rendering, lower-bound explanation, partial coverage near 100%, and catalog edit links |
| Release schedule | All opening buttons, both automatic-update toggles, counts, dates, Friday validation, monthly day, cancel/save, paused periods, resume behavior, timer-driven updates, and idempotent catch-up |
| Backups and storage | File chooser, malformed/oversized files, confirmation/cancel, export-current, import/undo, downloaded JSON contents, corrupt-save recovery, and storage-write failure with backup recovery |
| Keyboard | Tab wrapping, Escape, dialog backdrop, opener focus restoration, hidden navigation focus exclusion, and mobile drawer dismissal |
| Responsive layout | Page and dialog widths at 320, 390, 768, and 1024 pixels; desktop interactions at 1440 pixels; actual editing and backup actions at phone width |
| External links | Both reference links open the expected destination in a new tab, tested against controlled responses |

## Reproduce

Start the development server, then run:

```bash
npm test
python tests/browser_smoke.py
python tests/ui_audit.py
npm run build
```

To audit the production bundle, start `npm run preview -- --port 5175`, then run:

```bash
JOJO_TEST_URL=http://127.0.0.1:5175 python tests/ui_audit.py
```

Browser checks require Python Playwright and `/usr/bin/chromium`. They use isolated browser profiles and fixed dates, leaving real saved progress untouched.

## Scope

Browser validation used Chromium, including emulated phone layouts. Safari, Firefox, physical devices, and live external reference-site availability were not tested. The app's release updates remain schedule-based estimates; these tests verify the scheduling behavior, not publisher release announcements.

## Portable preview and Opera packaging

The production build now embeds all application code, fonts, styles, and artwork in a single HTML file. The exact packaged HTML was tested with the browser offline and a controlled local HTTP response: all nine parts rendered, progress could be logged and saved across reloads, and no external resources or JavaScript errors were observed.

A clean extracted project successfully installed its locked dependencies, built, and served the app with `npm start`. A subsequent launch reused dependencies and rebuilt successfully. Busy/invalid ports produced clear errors, and stopping the launcher stopped its child server.

The same 23 UI scenarios were rerun against the portable production HTML over HTTP. Direct `file:` navigation is blocked by this environment's administrator policy, so local-file opening could not be tested here. Opera is not installed, and the official Opera download host was blocked by the network proxy. Chromium tests provide engine compatibility evidence, but native Opera, Opera GX, and the Windows/macOS launcher files were not executed in this Linux environment. Manual Opera instructions are included as a fallback to the launchers.
