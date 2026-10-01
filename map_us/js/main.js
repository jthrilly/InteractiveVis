/*
 * InteractiveVis choropleth map template.
 *
 * Plain ES module, no dependencies. The same file is used by map/, map_us/
 * and usmap/; the only per-template settings live on the #map element in
 * index.htm:
 *   data-shapes        name of the global that holds the region paths
 *                      ({width, height, shapes: {id: "M..."}}), loaded by a
 *                      classic <script> before this module
 *   data-initial-view  optional "x y width height" start viewBox (map units)
 *
 * config.json and data.json use the original InteractiveVis formats.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_HIGHLIGHT = 'rgba(247, 102, 10, 1)';
const NO_DATA_FILL = '#ccc';
const ZOOM_IN = 0.75; // viewBox multiplier per zoom-in step
const ZOOM_OUT = 1.25;
const MIN_ZOOM = 0.05; // smallest viewBox width as a share of the map width
// Above this many clickable regions (e.g. 3000+ US counties) the regions are not
// tab stops; keyboard users use the "Find a region" box instead.
const FOCUSABLE_LIMIT = 300;

const $ = (sel) => document.querySelector(sel);

/** True when v can be used as a number (rejects "", null, "Not Reported", "#DIV/0!"). */
const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
const asArray = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const hasStyle = (legend, style) => asArray(legend.style).includes(style);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function showError(message) {
  const box = $('#loaderror');
  box.textContent = message;
  box.hidden = false;
}

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function start() {
  const mapEl = $('#map');
  const image = window[mapEl.dataset.shapes];
  if (!image || !image.shapes) {
    showError(`Map shapes "${mapEl.dataset.shapes}" were not loaded.`);
    return;
  }

  let config;
  let data;
  try {
    config = await getJSON('config.json');
    if (!config.global || (config.global.type && config.global.type !== 'map')) {
      showError('Cannot find map configuration settings in config.json.');
      return;
    }
    data = await getJSON(config.global.data || 'data.json');
  } catch (err) {
    showError(
      `Could not load the visualisation data (${err.message}). ` +
        'These pages must be served by a web server, not opened from disk.'
    );
    return;
  }

  new MapVis(mapEl, image, config, data);
}

class MapVis {
  constructor(mapEl, image, config, data) {
    this.mapEl = mapEl;
    this.image = image;
    this.config = config;
    this.data = data;
    this.features = config.features || {};
    this.regions = new Map(); // shape id -> {path, key}

    this.classifyStats();
    this.initText();
    this.updateLegend();
    this.initAltStats();
    this.initMap();
    this.initChart();
    this.initPanel();
    this.initZoomControls();
    this.initDialog();

    const onLoad = this.features.onLoad || {};
    if (onLoad.enabled && onLoad.datapoint && this.data[onLoad.datapoint]) {
      const d = this.data[onLoad.datapoint];
      this.showInfo(d.label ?? d.paneltitle ?? onLoad.datapoint, d);
    } else {
      $('#attributepane').hidden = true;
    }
    requestAnimationFrame(() => this.mapEl.classList.add('ready'));
  }

  legendFor(stat) {
    return this.features['legend_' + stat];
  }

  classifyStats() {
    this.currentStat = '';
    this.altStats = [];
    this.barStats = [];
    this.textStats = [];
    for (const stat of asArray(this.features.stats)) {
      const leg = this.legendFor(stat);
      if (!leg) continue;
      if (leg.type === 'main_statistic') {
        this.currentStat = stat;
        this.altStats.push(stat);
      } else if (leg.type === 'alternative_statistic') {
        this.altStats.push(stat);
      }
      // "style" may be a string ("bar") or a list (["bar", "text"]).
      if (hasStyle(leg, 'bar')) this.barStats.push({ stat, label: leg.paneltitle, color: leg.color });
      if (hasStyle(leg, 'text')) this.textStats.push({ stat, label: leg.paneltitle });
    }
    if (!this.currentStat && this.altStats.length) this.currentStat = this.altStats[0];
  }

  /* ---------- left panel: logo, title, intro ---------- */

  initText() {
    const { logo = {}, text = {} } = this.config;
    const main = $('#maintitle');
    main.replaceChildren();
    let logoNode = null;
    if (logo.file) {
      logoNode = el('img', { src: logo.file, alt: logo.text || '', class: 'logo' });
    } else if (logo.text) {
      logoNode = el('h1', { text: logo.text });
    }
    if (logoNode && logo.link) logoNode = el('a', { href: logo.link }, logoNode);
    if (logoNode) main.append(logoNode);

    // title, intro and more are author-supplied HTML.
    if (text.title) {
      $('#title').innerHTML = `<h2>${text.title}</h2>`;
      document.title = $('#title').textContent.trim() || document.title;
    } else {
      $('#title').replaceChildren();
    }
    $('#titletext').innerHTML = text.intro || '';
    if (text.more) {
      $('#informationContent').innerHTML = text.more;
    } else {
      $('#moreinformation').hidden = true;
    }
  }

  /* ---------- legend + alternative statistics menu ---------- */

  updateLegend() {
    const legend = this.legendFor(this.currentStat);
    const box = $('#legend');
    if (!legend) {
      box.hidden = true;
      return;
    }
    const title = $('#legendtitle');
    (title.querySelector('.legendtitle-text') || title).textContent = legend.legendtitle || '';
    const list = $('#legendColors');
    list.replaceChildren();
    const labels = asArray(legend.labels);
    const colors = asArray(legend.colors);
    labels.forEach((label, i) => {
      list.append(
        el(
          'li',
          {},
          el('span', { class: 'colourblock', style: { backgroundColor: colors[i] } }),
          el('span', { class: 'colourlabel', text: label })
        )
      );
    });
  }

  initAltStats() {
    if (this.altStats.length < 2) return;
    const legend = $('#legend');
    const title = $('#legendtitle');
    legend.classList.add('hasAltStats');

    const button = el('button', {
      type: 'button',
      class: 'legendtitle-text',
      'aria-expanded': 'false',
      'aria-controls': 'altStats',
    });
    button.textContent = title.textContent;
    title.replaceChildren(button);

    const options = el('ul', { id: 'altStats', hidden: '' });
    const setOpen = (open) => {
      options.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      title.classList.toggle('expanded', open);
    };
    for (const stat of this.altStats) {
      const link = el('a', {
        href: '#',
        'data-altstat': stat,
        text: this.legendFor(stat).legendtitle || stat,
      });
      if (stat === this.currentStat) link.classList.add('selected');
      link.addEventListener('click', (evt) => {
        evt.preventDefault();
        options.querySelectorAll('a').forEach((a) => a.classList.toggle('selected', a === link));
        setOpen(false);
        this.changeMainStat(stat);
        button.focus();
      });
      options.append(el('li', {}, link));
    }
    title.after(options);

    button.addEventListener('click', (evt) => {
      evt.stopPropagation();
      setOpen(options.hidden);
    });
    document.addEventListener('click', (evt) => {
      if (!options.contains(evt.target)) setOpen(false);
    });
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && !options.hidden) {
        setOpen(false);
        button.focus();
      }
    });
  }

  changeMainStat(stat) {
    this.currentStat = stat;
    this.updateLegend();
    for (const { path, key } of this.regions.values()) path.setAttribute('fill', this.fillFor(key));
  }

  /* ---------- the map ---------- */

  scaleColor(value) {
    const legend = this.legendFor(this.currentStat);
    const cutpoints = asArray(legend.cutpoints);
    const colors = asArray(legend.colors);
    const v = Number(value);
    for (let i = 0; i < cutpoints.length; i++) {
      if (v < cutpoints[i]) return colors[i] ?? colors[colors.length - 1];
    }
    return colors[colors.length - 1] ?? NO_DATA_FILL;
  }

  fillFor(key) {
    const row = key && this.data[key];
    return row && this.currentStat && isNum(row[this.currentStat])
      ? this.scaleColor(row[this.currentStat])
      : NO_DATA_FILL;
  }

  /** data.json key for a shape id; US FIPS codes may have lost their leading zero. */
  dataKey(id) {
    if (Object.hasOwn(this.data, id)) return id;
    if (id.startsWith('0') && Object.hasOwn(this.data, id.slice(1))) return id.slice(1);
    return null;
  }

  initMap() {
    const { width, height } = this.image;
    this.full = { x: Number(this.image.x) || 0, y: Number(this.image.y) || 0, width, height };
    const svg = svgEl('svg', {
      viewBox: `${this.full.x} ${this.full.y} ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'group',
      'aria-label': document.title,
    });
    svg.style.setProperty(
      '--highlight',
      this.features.countryHighlightColor || DEFAULT_HIGHLIGHT
    );
    const group = svgEl('g', { class: 'regions' });
    const withData = [];
    for (const [id, d] of Object.entries(this.image.shapes)) {
      const key = this.dataKey(id);
      const path = svgEl('path', { d, id: 'region-' + id, class: 'region', fill: this.fillFor(key) });
      path.dataset.id = id;
      this.regions.set(id, { path, key });
      if (key) {
        path.classList.add('has-data');
        path.dataset.key = key;
        withData.push({ id, path, label: String(this.labelFor(key)) });
      } else {
        path.setAttribute('aria-hidden', 'true');
        group.append(path);
      }
    }
    // Regions with data go last, in label order, so Tab moves through them alphabetically.
    withData.sort((a, b) => a.label.localeCompare(b.label));
    const focusable = withData.length <= FOCUSABLE_LIMIT;
    for (const { path, label } of withData) {
      if (focusable) {
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', label);
      }
      group.append(path);
    }
    svg.append(group);
    this.initRegionFinder(withData);
    this.mapEl.replaceChildren(svg);
    this.svg = svg;

    const initial = (this.mapEl.dataset.initialView || '').trim().split(/[\s,]+/).map(Number);
    this.view =
      initial.length === 4 && initial.every(Number.isFinite)
        ? { x: initial[0], y: initial[1], width: initial[2], height: initial[3] }
        : { ...this.full };
    this.applyView();
    this.initPointer();
  }

  labelFor(key) {
    const row = this.data[key];
    return row && row.label !== undefined && row.label !== null && row.label !== '' ? row.label : key;
  }

  /** Show a region's information, mark it as selected and optionally zoom to it. */
  selectRegion(id, { zoom = false } = {}) {
    const region = this.regions.get(id);
    if (!region || !region.key) return;
    this.svg.querySelector('.region.selected')?.classList.remove('selected');
    region.path.classList.add('selected');
    this.showInfo(this.labelFor(region.key), this.data[region.key]);
    if (zoom) this.zoomTo(region.path);
  }

  zoomTo(path) {
    const box = path.getBBox();
    const f = this.full;
    const width = Math.min(Math.max(box.width * 6, box.height * 6, f.width * MIN_ZOOM * 2), f.width);
    const height = width * (f.height / f.width);
    this.view = {
      x: box.x + box.width / 2 - width / 2,
      y: box.y + box.height / 2 - height / 2,
      width,
      height,
    };
    this.applyView();
  }

  /** Keyboard/screen-reader route to every region: a text box with suggestions. */
  initRegionFinder(regions) {
    const input = $('#regionsearch');
    const list = $('#regionlist');
    if (!input || !list) return;
    if (!regions.length) {
      $('#regionfinder').hidden = true;
      return;
    }
    const byLabel = new Map();
    for (const { id, label } of regions) {
      const k = label.toLocaleLowerCase();
      if (byLabel.has(k)) continue;
      byLabel.set(k, id);
      list.append(el('option', { value: label }));
    }
    const go = () => {
      const id = byLabel.get(input.value.trim().toLocaleLowerCase());
      input.setAttribute('aria-invalid', String(!id && input.value.trim() !== ''));
      if (id) this.selectRegion(id, { zoom: true });
      return id;
    };
    // Picking a suggestion fires "input" with the full value.
    input.addEventListener('input', () => {
      if (byLabel.has(input.value.trim().toLocaleLowerCase())) go();
      else input.removeAttribute('aria-invalid');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    });
  }

  applyView() {
    const v = this.view;
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.width} ${v.height}`);
  }

  /** Client (screen) coordinates -> map coordinates under the current viewBox. */
  toMap(clientX, clientY) {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  zoom(factor, clientX, clientY) {
    const v = this.view;
    const rect = this.svg.getBoundingClientRect();
    const anchor =
      clientX === undefined
        ? this.toMap(rect.left + rect.width / 2, rect.top + rect.height / 2)
        : this.toMap(clientX, clientY);
    const width = v.width * factor;
    if (width > this.full.width) {
      this.reset(); // fully zoomed out: recentre
      return;
    }
    if (width / this.full.width < MIN_ZOOM) return;
    v.x = anchor.x - (anchor.x - v.x) * factor;
    v.y = anchor.y - (anchor.y - v.y) * factor;
    v.width = width;
    v.height *= factor;
    this.applyView();
  }

  pan(dxClient, dyClient) {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return;
    const v = this.view;
    const f = this.full;
    v.x = Math.min(Math.max(v.x - dxClient / ctm.a, f.x - v.width / 2), f.x + f.width - v.width / 2);
    v.y = Math.min(Math.max(v.y - dyClient / ctm.d, f.y - v.height / 2), f.y + f.height - v.height / 2);
    this.applyView();
  }

  reset() {
    this.view = { ...this.full };
    this.applyView();
  }

  initPointer() {
    const svg = this.svg;
    const tooltip = $('#tooltip');
    const pointers = new Map(); // pointerId -> {x, y}
    let moved = 0;
    let pinchDist = 0;

    const hideTooltip = () => {
      tooltip.hidden = true;
    };

    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });

    svg.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (prev) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4 && !svg.hasPointerCapture(e.pointerId)) {
          svg.setPointerCapture(e.pointerId);
          svg.classList.add('dragging');
          hideTooltip();
        }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1 && moved > 4) {
          this.pan(dx, dy);
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0 && dist > 0) this.zoom(pinchDist / dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinchDist = dist;
        }
        return;
      }
      // Hover tooltip (mouse/pen only)
      const path = e.target.closest?.('.region.has-data');
      if (!path || e.pointerType === 'touch') {
        hideTooltip();
        return;
      }
      tooltip.textContent = this.labelFor(path.dataset.key);
      tooltip.hidden = false;
      const pad = 14;
      const { innerWidth: w, innerHeight: h } = window;
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      tooltip.style.left = Math.min(e.clientX + pad, w - tw - 4) + 'px';
      tooltip.style.top = Math.min(e.clientY + pad, h - th - 4) + 'px';
    });

    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (!pointers.size) svg.classList.remove('dragging');
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', hideTooltip);

    svg.addEventListener('click', (e) => {
      if (moved > 4) return; // that was a drag, not a click
      const path = e.target.closest?.('.region.has-data');
      if (path) this.selectRegion(path.dataset.id);
    });

    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const path = e.target.closest?.('.region.has-data');
      if (!path) return;
      e.preventDefault();
      this.selectRegion(path.dataset.id);
    });

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.deltaY) this.zoom(e.deltaY > 0 ? ZOOM_OUT : ZOOM_IN, e.clientX, e.clientY);
      },
      { passive: false }
    );
  }

  initZoomControls() {
    $('#zoomIn').addEventListener('click', () => this.zoom(ZOOM_IN));
    $('#zoomOut').addEventListener('click', () => this.zoom(ZOOM_OUT));
    $('#reset').addEventListener('click', () => this.reset());
  }

  /* ---------- information pane ---------- */

  initPanel() {
    $('#attributepane .left-close').addEventListener('click', () => {
      $('#attributepane').hidden = true;
      this.svg.querySelector('.region.selected')?.classList.remove('selected');
    });
  }

  initChart() {
    const chart = $('#chart');
    chart.replaceChildren();
    this.bars = [];
    if (!this.barStats.length) {
      chart.hidden = true;
      return;
    }
    const bars = this.features.bars || {};
    this.chartUnits = bars.units ?? '';
    this.chartMax = Number(bars.maxvalue) || 100;
    for (const { label, color } of this.barStats) {
      const fill = el('div', { class: 'bar-fill', style: { backgroundColor: color } });
      const value = el('span', { class: 'bar-value', text: '0' + this.chartUnits });
      const track = el('div', { class: 'bar-track' }, fill, value);
      chart.append(el('div', { class: 'bar' }, track, el('div', { class: 'bar-label', text: label ?? '' })));
      this.bars.push({ fill, value });
    }
  }

  showInfo(name, row) {
    const pane = $('#attributepane');
    const animate = !pane.hidden; // only animate when the pane is already shown
    pane.hidden = false;
    pane.classList.toggle('animate', animate);
    $('#chartname').textContent = name;

    this.barStats.forEach(({ stat }, i) => {
      const { fill, value } = this.bars[i];
      const ok = row && isNum(row[stat]);
      const pct = ok ? Math.min(Math.max((Number(row[stat]) / this.chartMax) * 100, 0), 100) : 0;
      fill.style.height = pct + '%';
      value.textContent = ok ? String(row[stat]) + this.chartUnits : 'n/a';
      value.classList.toggle('na', !ok);
      value.classList.toggle('outside', ok && pct < 12); // too short to hold its label
      value.style.setProperty('--pct', pct + '%');
      if (animate) {
        value.classList.remove('shown');
        setTimeout(() => value.classList.add('shown'), 500);
      } else {
        value.classList.add('shown');
      }
    });

    const text = $('#attributeText');
    text.replaceChildren();
    if (this.textStats.length) {
      const list = el('ul');
      for (const { stat, label } of this.textStats) {
        const v = row && row[stat];
        if (v === undefined || v === null || v === '') continue;
        list.append(el('li', {}, el('span', { class: 'label', text: label ?? stat }), String(v)));
      }
      text.append(list);
    }
    const rightPanelText = this.config.global && this.config.global.rightPanelText;
    if (rightPanelText) {
      const p = el('p');
      p.innerHTML = rightPanelText; // author HTML from config
      text.append(p);
    }
  }

  /* ---------- "more information" dialog ---------- */

  initDialog() {
    const dialog = $('#information');
    $('#moreinformation a').addEventListener('click', (evt) => {
      evt.preventDefault();
      dialog.showModal();
    });
    // Close when the backdrop (outside the dialog box) is clicked.
    dialog.addEventListener('click', (evt) => {
      if (evt.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside =
        evt.clientX >= r.left && evt.clientX <= r.right && evt.clientY >= r.top && evt.clientY <= r.bottom;
      if (!inside) dialog.close();
    });
  }
}

start();
