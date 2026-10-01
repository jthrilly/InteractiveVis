# World map template

Choropleth world map (sample: literacy by gender). Region ids are ISO 3166-1
alpha-2 codes, plus `XK`, `PS-GAZASTRIP` and `PS-WESTBANK`.

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

- `js/worldmap.js` – country outlines as SVG path strings (`var worldmap = {width, height, shapes}`).
- `js/countrycodes.js` – ISO code to country name lookup (reference for building `data.json`; not loaded by the page).
- `server-side/dataConversion.php` – converts a CSV table into `data.json`
  (`php dataConversion.php input.csv data.json`). The first column is the region
  id, the other columns become fields named by their headers (add a `label`
  column for display names); output has region ids at the top level, as the page expects.
