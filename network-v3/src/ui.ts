// The panels around the graph: the left panel (logo, text, legend, search,
// group selector), the information pane, the "more information" dialog and
// #hash links. Text from the data is always inserted as text; only the
// config's author fields (logo, title, intro, more, legend) are HTML, as in
// the sigma 0.1 viewer.

import type Sigma from "sigma";
import type { ViewerConfig } from "./config";
import type { AttributeValue, IVGraph } from "./data";
import { findGroup, listGroups, type Group } from "./groups";
import { allNeighbors, neighborsByDirection, sortByLabel } from "./neighbors";
import { MIN_QUERY_LENGTH, searchNodes } from "./search";
import { clearSelection, selectGroup, selectNode, type ViewState } from "./view";

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const URL_PATTERN = /^https?:\/\/\S+$/i;

/** An attribute value as text, or as a link when the whole value is a web address. */
function valueNode(value: AttributeValue): Node {
  const text = value === null ? "" : String(value);
  if (URL_PATTERN.test(text)) return el("a", { href: text, target: "_blank", rel: "noopener noreferrer", textContent: text });
  return document.createTextNode(text);
}

/** Hash text for a node or group name, encoded so readHash gives it back unchanged. */
function hashFor(name: string): string {
  return `#${encodeURIComponent(name)}`;
}

function readHash(): string {
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export class ViewerUI {
  private readonly groups: Group[];
  private readonly pane = $("#attributepane");
  private readonly dialog = $<HTMLDialogElement>("#information");
  private readonly searchResults = $("#search-results");
  private readonly searchInput = $<HTMLInputElement>("#search-input");
  private readonly groupList = $("#group-list");
  private readonly groupToggle = $<HTMLButtonElement>("#group-toggle");

  constructor(
    private readonly config: ViewerConfig,
    private readonly graph: IVGraph,
    private readonly renderer: Sigma,
    private readonly state: ViewState,
  ) {
    this.groups = config.groupBy ? listGroups(graph, config.groupBy) : [];
  }

  init(): void {
    this.fillPanel();
    this.bindSearch();
    this.bindGroups();
    this.bindPane();
    this.bindGraphEvents();
    this.bindKeys();
    window.addEventListener("hashchange", () => this.route(readHash()));
    this.route(readHash());
  }

  // ---- Left panel --------------------------------------------------------

  private fillPanel(): void {
    const { logo, text, legend } = this.config;
    const title = $("#maintitle");
    let logoNode: HTMLElement | null = null;
    // logo.text is author-written HTML, like the other text fields.
    if (logo.text) logoNode = el("h1", { innerHTML: logo.text });
    if (logo.file) logoNode = el("img", { src: logo.file, alt: logoNode?.textContent ?? "" });
    if (logoNode && logo.link) logoNode = el("a", { href: logo.link }, [logoNode]);
    if (logoNode) title.append(logoNode);

    $("#title").innerHTML = text.title;
    $("#titletext").innerHTML = text.intro;
    if (text.more) {
      this.dialog.querySelector(".content")!.innerHTML = text.more;
      $("#moreinformation").hidden = false;
    }

    const rows: [string, string][] = [
      ["node", legend.nodeLabel],
      ["edge", legend.edgeLabel],
      ["colours", legend.colorLabel],
    ];
    for (const [name, html] of rows) {
      if (!html) continue;
      document.querySelectorAll<HTMLElement>(`#legend .${name}`).forEach((node) => (node.hidden = false));
      $(`#legend dd.${name}`).innerHTML = html;
    }
    $("#legend").hidden = rows.every(([, html]) => !html);

    const panel = $("#mainpanel");
    const toggle = $<HTMLButtonElement>("#panel-toggle");
    toggle.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "Show panel" : "Hide panel";
    });
    // On a phone the panel starts folded so the network is visible.
    if (window.matchMedia("(max-width: 700px)").matches) toggle.click();
  }

  // ---- Search ------------------------------------------------------------

  private bindSearch(): void {
    $("#search").hidden = !this.config.search.enabled;
    const form = $<HTMLFormElement>("#search");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.runSearch(this.searchInput.value, true);
    });
    let timer: number | undefined;
    this.searchInput.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.runSearch(this.searchInput.value, false), 150);
    });
  }

  /**
   * Lists matches as the user types; Enter (or the button) also opens the
   * first match, or a group of that name when no node matches, like sigma 0.1.
   */
  runSearch(query: string, open: boolean): void {
    const results = this.searchResults;
    results.replaceChildren();
    if (!query.trim()) {
      results.hidden = true;
      return;
    }
    results.hidden = false;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      results.append(el("p", {}, [el("i", { textContent: `You must search for a name with a minimum of ${MIN_QUERY_LENGTH} letters.` })]));
      return;
    }
    const hits = searchNodes(this.graph, query, { fulltext: this.config.search.fulltext });
    if (hits.length === 0) {
      const group = findGroup(this.groups, query);
      if (group && open) {
        this.openGroup(group);
        results.hidden = true;
        return;
      }
      results.append(el("p", {}, [el("i", { textContent: "No results found." })]));
      return;
    }
    if (open && hits.length === 1) {
      this.openNode(hits[0].key);
      results.hidden = true;
      return;
    }
    results.append(el("p", {}, [el("b", { textContent: `Search results (${hits.length}):` })]));
    for (const hit of hits) {
      const button = el("button", { type: "button", textContent: hit.label });
      button.addEventListener("click", () => this.openNode(hit.key));
      results.append(button);
    }
    if (open) this.openNode(hits[0].key);
  }

  private clearSearch(): void {
    this.searchInput.value = "";
    this.searchResults.replaceChildren();
    this.searchResults.hidden = true;
  }

  // ---- Group selector ----------------------------------------------------

  private bindGroups(): void {
    $("#attributeselect").hidden = this.groups.length === 0;
    for (const group of this.groups) {
      const swatch = el("span", { className: "swatch" });
      swatch.style.background = group.color;
      const button = el("button", { type: "button" }, [
        swatch,
        `${group.name} (${group.members.length} member${group.members.length === 1 ? "" : "s"})`,
      ]);
      button.addEventListener("click", () => this.openGroup(group));
      this.groupList.append(el("li", {}, [button]));
    }
    this.groupToggle.addEventListener("click", () => this.showGroupList(!this.groupListOpen));
  }

  private get groupListOpen(): boolean {
    return this.groupToggle.getAttribute("aria-expanded") === "true";
  }

  private showGroupList(show: boolean): void {
    this.groupList.hidden = !show;
    this.groupToggle.setAttribute("aria-expanded", String(show));
  }

  // ---- Selection and the information pane --------------------------------

  openNode(key: string): void {
    if (!this.graph.hasNode(key)) return;
    selectNode(this.state, this.graph, key);
    this.renderNodePane(key);
    this.refresh();
    this.setHash(this.graph.getNodeAttribute(key, "label"));
  }

  openGroup(group: Group): void {
    selectGroup(this.state, group.name, group.members);
    this.showGroupList(false);
    this.clearSearch();
    const pane = this.paneParts();
    pane.name.replaceChildren(el("b", { textContent: group.name }));
    pane.data.replaceChildren();
    pane.data.hidden = true;
    pane.heading.textContent = "Group Members:";
    pane.list.replaceChildren(this.nodeList(sortByLabel(this.graph, group.members)));
    this.showPane(true);
    this.refresh();
    this.setHash(group.name);
  }

  /** Back to the full network, as the pane's close link and Esc do. */
  close(writeHistory = true): void {
    if (!this.state.focus) return;
    clearSelection(this.state);
    this.showPane(false);
    this.refresh();
    if (writeHistory && window.location.hash) history.pushState(null, "", window.location.pathname + window.location.search);
  }

  /** Shows or hides the information pane; on a phone it replaces the folded-up panel. */
  private showPane(show: boolean): void {
    this.pane.hidden = !show;
    document.body.classList.toggle("pane-open", show);
    if (show && window.matchMedia("(max-width: 700px)").matches && !$("#mainpanel").classList.contains("collapsed")) {
      $<HTMLButtonElement>("#panel-toggle").click();
    }
  }

  private paneParts() {
    return {
      name: this.pane.querySelector<HTMLElement>(".name")!,
      data: this.pane.querySelector<HTMLElement>(".data")!,
      heading: this.pane.querySelector<HTMLElement>(".p")!,
      list: this.pane.querySelector<HTMLElement>(".link")!,
    };
  }

  private renderNodePane(key: string): void {
    const attrs = this.graph.getNodeAttributes(key);
    const imageAttribute = this.config.informationPanel.imageAttribute;
    const pane = this.paneParts();

    const name = el("span", { textContent: attrs.label });
    this.bindHighlight(name, key);
    const image = imageAttribute ? attrs.attributes[imageAttribute] : null;
    pane.name.replaceChildren(...(image ? [el("img", { src: String(image), alt: "" }), name] : [name]));

    pane.data.replaceChildren(
      ...Object.entries(attrs.attributes)
        .filter(([column]) => column !== imageAttribute)
        .map(([column, value]) => el("div", {}, [el("dt", { textContent: column }), el("dd", {}, [valueNode(value)])])),
    );
    pane.data.hidden = false;
    pane.heading.textContent = "Connections:";

    if (this.config.informationPanel.groupByEdgeDirection) {
      const lists = neighborsByDirection(this.graph, key);
      const section = (title: string, keys: string[], none: string) => [
        el("h4", { textContent: `${title} (${keys.length})` }),
        keys.length ? this.nodeList(keys) : el("p", { className: "empty", textContent: none }),
      ];
      pane.list.replaceChildren(
        ...section("Mutual", lists.mutual, "No mutual links"),
        ...section("Incoming", lists.incoming, "No incoming links"),
        ...section("Outgoing", lists.outgoing, "No outgoing links"),
      );
    } else {
      pane.list.replaceChildren(this.nodeList(allNeighbors(this.graph, key)));
    }
    this.showPane(true);
    this.pane.querySelector(".nodeattributes")!.scrollTop = 0;
  }

  private nodeList(keys: string[]): HTMLUListElement {
    const list = el("ul");
    for (const key of keys) {
      const button = el("button", { type: "button", textContent: this.graph.getNodeAttribute(key, "label") });
      button.addEventListener("click", () => this.openNode(key));
      this.bindHighlight(button, key);
      list.append(el("li", {}, [button]));
    }
    return list;
  }

  /** Hovering a name in the pane highlights its node, as sigma 0.1's drawHoverNode did. */
  private bindHighlight(target: HTMLElement, key: string): void {
    const set = (value: string | null) => {
      this.state.highlighted = value;
      this.refresh();
    };
    target.addEventListener("mouseenter", () => set(key));
    target.addEventListener("mouseleave", () => set(null));
    target.addEventListener("focus", () => set(key));
    target.addEventListener("blur", () => set(null));
  }

  private bindPane(): void {
    $("#pane-close").addEventListener("click", () => this.close());
    // The link navigates to #information, which opens the dialog through route().
    // When the hash is already #information, hashchange won't fire, so open it here.
    $("#moreinformation-link").addEventListener("click", (event) => {
      if (readHash() !== "information") return;
      event.preventDefault();
      if (!this.dialog.open) this.dialog.showModal();
    });
    // Closing the dialog leaves #information without adding a history entry.
    this.dialog.addEventListener("close", () => {
      if (readHash() === "information") history.replaceState(null, "", window.location.pathname + window.location.search);
    });
    // Clicking the backdrop closes the dialog, as fancyBox did.
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
  }

  private bindGraphEvents(): void {
    this.renderer.on("clickNode", ({ node }) => this.openNode(node));
    this.renderer.on("clickStage", () => this.close());
    this.renderer.on("enterNode", () => this.renderer.getContainer().style.setProperty("cursor", "pointer"));
    this.renderer.on("leaveNode", () => this.renderer.getContainer().style.removeProperty("cursor"));
  }

  private bindKeys(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || this.dialog.open) return;
      if (this.groupListOpen) this.showGroupList(false);
      else this.close();
    });
  }

  // ---- #hash links -------------------------------------------------------

  private setHash(name: string): void {
    if (readHash() !== name) history.pushState(null, "", hashFor(name));
  }

  /**
   * `#information` opens the dialog, `#Groups` the group selector, and any
   * other hash opens the node with that exact label, or else the group of
   * that name. An empty hash (back to the start) closes the pane.
   */
  route(hash: string): void {
    // The dialog and group list only stay open while their own hash is current.
    if (hash !== "information" && this.dialog.open) this.dialog.close();
    if (hash !== "Groups" && this.groupListOpen) this.showGroupList(false);
    if (!hash) {
      // Back or Forward got here, so don't write history (that would drop Forward entries).
      this.close(false);
      return;
    }
    if (hash === "information") {
      if (this.config.text.more && !this.dialog.open) this.dialog.showModal();
      return;
    }
    if (hash === "Groups") {
      if (this.groups.length) this.showGroupList(true);
      return;
    }
    const hits = searchNodes(this.graph, hash, { fulltext: false, exact: true });
    if (hits.length) {
      if (this.state.selected !== hits[0].key) this.openNode(hits[0].key);
      return;
    }
    const group = findGroup(this.groups, hash);
    if (group && this.state.group !== group.name) this.openGroup(group);
  }

  private refresh(): void {
    this.renderer.refresh({ skipIndexation: true });
  }
}
