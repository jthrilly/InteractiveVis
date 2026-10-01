# US counties map template

Choropleth map of US counties (sample: tweets mentioning flooding during Hurricane
Sandy). Region ids are 5-digit county FIPS codes; `data.json` keys may drop the
leading zero (`6065` for `06065`). The page starts zoomed on the north-east
(`data-initial-view` in `index.htm`); remove that attribute to start with the
whole country.

## Files

- `index.htm` – the page. The `#map` element names the global holding the region
  outlines (`data-shapes`) and, optionally, a start view (`data-initial-view="x y w h"`
  in map units).
- `config.json` – titles, intro/"more" text (HTML allowed), logo, legends and
  statistics. Format unchanged from the original InteractiveVis wizard output.
- `data.json` – one object per region id with a `label` and one field per statistic.
- `js/main.js` – the visualisation (plain ES module, no libraries). Identical in
  `map/`, `map_us/` and `usmap/`.
- `css/style.css`, `images/` – styling, zoom icons, JISC/OII logos, CC licence badge.

The folder needs no build step: copy it to any web server. It must be served over
HTTP (the page `fetch()`es the JSON files), so opening `index.htm` from disk will not
work. `htaccess_example` / `web.config` (where present) set the JSON MIME type for
Apache / IIS.

Features: colour-scale legend, switching between alternative statistics, hover
highlight and tooltip, click for the information pane (bar chart and text
statistics), "more information" dialog, zoom (buttons, mouse wheel, pinch) and pan
(drag), phone layout.

## Data files and tools

- `js/usmap.js` – county outlines as SVG path strings (`var usmap = {width, height, shapes}`), loaded by the page.
- `js/usmap.json` – county GeoJSON (lon/lat), the source for `js/usmap.js`.
- `js/usstates.json`, `js/usstates.js` – state GeoJSON and outlines in the same
  projection (`var states = …`); not loaded by the page, available for a state-border overlay.
- `js/process.py` – Python 2 script: projects `usmap.json` (x = (lon+130)*10,
  y = (50.5-lat)*10), skipping Alaska, Hawaii and Puerto Rico, and writes `usmap.svg`
  plus a `data.csv` skeleton (FIPS, name and random sample columns).
- `js/states_process.py` – the same projection for `usstates.json`; writes `usstates.js`
  (rename its variable to `states` to match the checked-in file).
- `svg2js.py` – Python 2 helper that lists the path ids of an SVG file (set the
  input file name in the script); used to build the excluded-county list in `process.py`.
