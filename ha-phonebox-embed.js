/**
 * PhoneBox embed for Home Assistant
 * https://github.com/dancho12/ha-phonebox-embed
 *
 * Makes a Home Assistant dashboard fit a PhoneBox desk panel widget (or any other app that shows it in a frame).
 * Turn it on per dashboard in its raw configuration:
 *
 *   phonebox:
 *     columns: 12   # grid columns across the whole width (default 12, like PhoneBox)
 *     rows: 6       # rows that fill the frame height (default 6)
 *     views:        # optional, per view (by path or index): other numbers
 *       climate: { rows: 4 }
 *
 * On a dashboard with `phonebox`, in Sections views:
 * - always (also in the editor on the computer): the card grid has `columns` columns across the full width of the
 *   view, so a card's size in the editor is its share of the widget: 6 columns = half the width;
 * - only inside a frame (the app): `rows` rows fill the frame height exactly (2 rows = a third of 6), the page has no
 *   background of its own so the app's shows through, and the view has no outer padding.
 * Other dashboards, and the same dashboard opened directly, are left alone (apart from the grid columns).
 */

const VERSION = "1.0.2";
const ATTR = "data-phonebox-embed";
const DEFAULTS = { columns: 12, rows: 6 };

const FRAMED = (() => {
  try {
    return window.top !== window.self;
  } catch (_) {
    return true; // a cross-origin parent: framed
  }
})();

const positiveInt = (value, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 48 ? n : fallback;
};

/** The settings for the current view, or null when the dashboard does not use PhoneBox embed. */
function viewSettings(root) {
  const config = root?.lovelace?.config;
  const own = config?.phonebox;
  if (!own) return null;
  const base = own === true || typeof own !== "object" ? {} : own;
  let view = {};
  const views = base.views && typeof base.views === "object" ? base.views : null;
  if (views) {
    // /dashboard-url/<view path or index>
    const key = decodeURIComponent(window.location.pathname.split("/")[2] || "0");
    const index = (config.views || []).findIndex((v, i) => (v.path ?? String(i)) === key || String(i) === key);
    view = views[config.views?.[index]?.path] || views[index] || {};
  }
  const columns = positiveInt(view.columns ?? base.columns, DEFAULTS.columns);
  const rows = positiveInt(view.rows ?? base.rows, DEFAULTS.rows);
  return { columns, rows };
}

/** Styles by where they go: "document", or the shadow root of an element with this tag name. */
function stylesFor({ columns, rows }) {
  const styles = {
    // A section spanning N of the view's columns gets N × (columns / view columns) grid columns, so a section as wide
    // as the view has `columns` of them, whatever number of columns the view shows.
    "hui-grid-section": `:host { --base-column-count: calc(${columns} / var(--column-count, 1)) !important; }`,
  };
  // On the computer as wide as two section columns of Home Assistant (about 1000px): one column is at most 500px wide,
  // which squeezes a dashboard made for a wide panel, and the whole window is too wide. Inside the frame it fills the
  // frame, with no margins.
  styles["hui-sections-view"] = `.wrapper { max-width: calc(2 * var(--column-max-width, 500px) + var(--column-gap, 32px)) !important; }`;
  if (!FRAMED) return styles;
  // Rows: the frame height (100vh inside a frame) split into `rows` rows and the gaps between them.
  styles.document = `
    html {
      background: transparent !important;
      --view-background: transparent !important;
      --ha-section-grid-row-height: calc((100vh - ${rows - 1} * var(--ha-section-grid-row-gap, 8px)) / ${rows});
    }`;
  styles["home-assistant-main"] = "partial-panel-resolver::before { background: transparent !important; }";
  styles["hui-sections-view"] = `
    .wrapper { padding-left: 0 !important; padding-right: 0 !important; max-width: none !important; }
    .container { padding-top: 0 !important; padding-bottom: 0 !important; }`;
  return styles;
}

const PHONEBOX_EMBED = {
  version: VERSION,
  framed: FRAMED,
  settings: null,
  scheduled: false,
  observer: null,
  observed: new WeakSet(),

  start() {
    this.observer = new MutationObserver(() => this.schedule());
    this.observe(document.documentElement);
    for (const event of ["location-changed", "popstate"]) window.addEventListener(event, () => this.schedule());
    // HA renders views into shadow roots that may be attached after a scan, so it does not see them change. While a
    // PhoneBox dashboard is open, check again every second (a scan walks the page, so only then).
    setInterval(() => {
      if (this.settings) this.schedule();
    }, 1000);
    this.scan();
  },

  observe(root) {
    if (!root || this.observed.has(root)) return;
    this.observed.add(root);
    this.observer.observe(root, { childList: true, subtree: true });
  },

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.scan();
    });
  },

  /** Every shadow root on the page, watched for changes. */
  roots(root = document, out = []) {
    this.observe(root);
    for (const element of root.querySelectorAll("*")) {
      if (!element.shadowRoot) continue;
      out.push(element.shadowRoot);
      this.roots(element.shadowRoot, out);
    }
    return out;
  },

  put(parent, css) {
    const old = [...parent.children].find((child) => child.localName === "style" && child.hasAttribute(ATTR));
    if (old?.textContent === css) return;
    old?.remove();
    if (!css) return;
    const style = document.createElement("style");
    style.setAttribute(ATTR, VERSION);
    style.textContent = css;
    parent.append(style);
  },

  scan() {
    const roots = this.roots();
    const huiRoot = roots.find((root) => root.host.localName === "hui-root")?.host;
    // Only the Lovelace panel on screen counts (others stay in the page, disconnected or hidden).
    this.settings = huiRoot?.isConnected ? viewSettings(huiRoot) : null;
    const styles = this.settings ? stylesFor(this.settings) : {};
    this.put(document.head, styles.document);
    for (const root of roots) this.put(root, styles[root.host.localName]);
  },
};

window.PHONEBOX_EMBED = PHONEBOX_EMBED;
PHONEBOX_EMBED.start();
console.info(`%c PHONEBOX-EMBED %c ${VERSION} `, "color:#fff;background:#0d9488;font-weight:700", "color:#0d9488");
