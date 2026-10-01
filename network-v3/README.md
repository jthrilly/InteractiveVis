# network-v3

The InteractiveVis network viewer rebuilt on [sigma.js 3](https://www.sigmajs.org/) and
[graphology](https://graphology.github.io/). It reads the same `config.json` and `data.json`
that the sigmaexporter Gephi plugin writes today, so existing exports keep working.

This is phase 1 of the migration: loading and plain rendering only. The panels, search,
group selector and hover behaviour from `../network/` arrive in later phases, after which
this folder replaces `../network/`.

## Commands

```sh
npm install
npm run dev            # dev server; open /?config=<path to a config.json>
npm test               # unit tests (config translation, data loading)
npm run test:browser   # Playwright: renders fixtures and the sample Twitter network
npm run build          # static site in dist/
```

Set `CHROMIUM_PATH` to use an already installed Chromium for `test:browser`.

## How the old formats map

- `data.json` nodes and edges become a graphology `MultiDirectedGraph`. Gephi columns stay
  nested under `attributes`, so names like `type` or `hidden` never reach sigma.
- Sizes are rescaled exactly as sigma 0.1 did, using `sigma.graphProperties`.
- Coordinates are used as Gephi wrote them. sigma 3's y axis points up like Gephi's, so the
  y flip in `../network/js/sigma/sigma.parseJson.js` is gone (covered by a browser test).
- `sigma.mouseProperties` zoom ratios are inverted into sigma 3 camera ratios.
- Edges may carry an optional `directed: true|false`. With an arrow edge style, arrows are
  drawn only on edges not marked `false`; files without the field behave as before.
- Exports can embed both files in `index.html` as
  `<script type="application/json" id="ivis-config">` and `id="ivis-data"`, so the page opens
  from disk without a web server.
- `.gexf` data files are read with `graphology-gexf`.
