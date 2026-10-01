# US states map template

Choropleth map of the US states (sample: 2012 election mentions on Twitter).
Region ids are two-letter state codes.

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

## Data files

- `js/usstates.js` – state outlines as SVG path strings (`var usmap = {width, height, shapes}`).
