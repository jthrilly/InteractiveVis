# network-src

Source of the InteractiveVis network viewer, built on [sigma.js 3](https://www.sigmajs.org/)
and [graphology](https://graphology.github.io/). It reads the same `config.json` and
`data.json` that the sigmaexporter Gephi plugin writes, so existing exports keep working.

`npm run build` writes the viewer into `../network/` (`index.html`, `assets/`, `images/`).
That folder is committed, so the template can be used without Node: copy it to a web
server next to your `config.json` and data. Don't edit `../network/index.html` or
`../network/assets/` by hand; change the source here and rebuild. The sample configs,
`data/` and `server/` helper scripts in `../network/` are not touched by the build.

## Commands

```sh
npm install
npm run dev            # dev server; open /?config=<path to a config.json>
npm test               # unit tests (config translation, data loading)
npm run test:browser   # Playwright: renders fixtures and the sample Twitter network
npm run build          # writes the viewer into ../network/
```

Set `CHROMIUM_PATH` to use an already installed Chromium for `test:browser`.

## How the old formats map

- `data.json` nodes and edges become a graphology `MultiDirectedGraph`. Gephi columns stay
  nested under `attributes`, so names like `type` or `hidden` never reach sigma.
- Sizes are rescaled exactly as sigma 0.1 did, using `sigma.graphProperties`.
- Coordinates are used as Gephi wrote them. sigma 3's y axis points up like Gephi's, so the
  y flip in the old viewer's `sigma.parseJson.js` is gone (covered by a browser test).
- `sigma.mouseProperties` zoom ratios are inverted into sigma 3 camera ratios.
- Edges may carry an optional `directed: true|false`. With an arrow edge style, arrows are
  drawn only on edges not marked `false`; files without the field behave as before.
- Exports can embed both files in `index.html` as
  `<script type="application/json" id="ivis-config">` and `id="ivis-data"`, so the page opens
  from disk without a web server. For that to work the build emits a classic deferred
  script rather than an ES module, since browsers block module scripts on `file://` pages
  (covered by a browser test).
- When a `sigma` settings block is missing, the old viewer's defaults apply (curved edges,
  label threshold 10, sizes 1-7). Keys missing from a block that is present take sigma 0.1's
  own defaults, as before (straight edges, threshold 6, no rescaling).
- `edgeColor` (`source`, `target`, `default`), `defaultEdgeColor` and `defaultNodeColor` are
  honoured for elements without their own colour.
- `.gexf` data files are read with `graphology-gexf`.

## How it renders

- Labels are plain text, shown once a node's on-screen radius reaches `labelThreshold`.
  sigma 0.1 measured the radius the same way (growing with the square root of the zoom),
  so the configured number keeps its meaning. With the default of 10 no labels show
  until you zoom in, as before.
- The hovered node gets a box in `defaultHoverLabelBGColor` with `defaultLabelHoverColor`
  text.
- `features.hoverBehavior` `dim` greys out, and `hide` hides, everything outside the
  hovered node's neighbourhood. This is done with sigma reducers, so nothing in the graph
  is modified.
- Edges are drawn in their colour faded 35% towards the background, standing in for the
  sub-pixel canvas lines sigma 0.1 drew.
- Several edges between the same two nodes in the same direction are curved apart, even
  with a straight edge style.

## Interface

- **Left panel:** logo, title, intro and legend from `config.json`. Each is HTML written
  by the export's author, as before; legend rows with no text are hidden. "More about this
  visualisation" opens `text.more` in a native `<dialog>`, and the link is hidden when
  `text.more` is empty.
- **Search** (`features.search`): a case-insensitive match on labels, plus attribute values
  when `search.fulltext` is on. Results list as you type once you've entered 3 letters;
  Enter opens the first match, or a group of that name when no node matches.
- **Group selector** (`features.groupSelectorAttribute`): groups by that Gephi column, or by
  node colour ("Group 1", "Group 2"...) when it is `color` or no node has the column.
- **Information pane:** clicking a node shows only it and its neighbours. The pane lists
  the node's attributes (the `informationPanel.imageAttribute` column is shown as an image)
  and its connections, split into Mutual / Incoming / Outgoing when
  `informationPanel.groupByEdgeDirection` is on. Values from the data are inserted as text;
  values that are a single web address become links. Hovering a name highlights its node.
- **Closing:** the "Return to the full network" button, Esc, or a click on empty canvas.
- **Hash links:** `#<label>` opens a node (or a group of that name), `#Groups` opens the
  group selector, and `#information` opens the dialog. Back and Forward move between them.
- **Phones:** the panel folds into a bar at the top and the information pane opens as a
  sheet at the bottom.
