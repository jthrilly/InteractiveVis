# Template smoke tests

Playwright smoke tests for the map templates (`map/`, `map_us/`, `usmap/`).

```sh
cd templates-test
npm install
npx playwright test            # desktop and phone (Pixel 7) projects
```

`serve.mjs` is a dependency-free static server for the repository root
(`node serve.mjs .. 4173`); Playwright starts it automatically.
Set `CHROMIUM_PATH` to use a preinstalled Chromium, otherwise run
`npx playwright install chromium` once. Screenshots are written to
`screenshots/` (override with `SCREENSHOT_DIR`).
