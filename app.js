// Eksoch Data Store: loads data.json (made by build_data_app.py) and renders the catalogue.
const ALL = "All";
const state = { tab: ALL, freeOnly: false, query: "" };
let data;

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};
const byId = (id) => data.products.find((p) => p.id === id);

function matches(p, q) {
  if (!q) return true;
  const hay = [p.name, p.summary, p.category, ...p.highlights, ...p.details.flat()].join(" ").toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function visible() {
  const q = state.query.trim().toLowerCase();
  return data.products
    .filter((p) => state.tab === ALL || p.category === state.tab)
    .filter((p) => !state.freeOnly || p.free)
    .filter((p) => matches(p, q));
}

function renderStats() {
  const n = data.products.length;
  const free = data.products.filter((p) => p.free).length;
  const items = [[n, "products"], [data.categories.length, "categories"], [free, "free downloads"]];
  $("stats").replaceChildren(...items.map(([v, l]) => el("div", { className: "stat" },
    el("strong", { textContent: v }), el("span", { textContent: l }))));
}

function renderTabs() {
  const tabs = [[ALL, data.products.length],
    ...data.categories.map((c) => [c.name, data.products.filter((p) => p.category === c.name).length])];
  $("tabs").replaceChildren(...tabs.map(([name, n]) => {
    const b = el("button", { className: "tab", type: "button" }, name, el("span", { className: "n", textContent: n }));
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(state.tab === name));
    b.onclick = () => { state.tab = name; render(); };
    return b;
  }));
}

function renderBanner() {
  const banner = $("banner");
  const cat = data.categories.find((c) => c.name === state.tab);
  if (!cat) { banner.hidden = true; return; }
  const kids = [el("p", { textContent: cat.description })];
  if (cat.path) {
    // A learning path, e.g. SQL Volume 1 → 2 → 3 → interview guide.
    const steps = cat.path.map(byId).filter(Boolean);
    kids.push(el("ol", { className: "path" }, ...steps.map((p, i) => {
      const b = el("button", { type: "button" },
        el("span", { className: "step", textContent: i + 1 }),
        el("span", { textContent: shortName(p.name) }));
      b.onclick = () => openViewer(p);
      return el("li", {}, b);
    })));
  }
  banner.replaceChildren(...kids);
  banner.hidden = false;
}

// "SQL Basics, Volume 1: Learn SQL…" → "SQL Basics, Volume 1"
const shortName = (name) => name.split(/[:–(]/)[0].trim();

function card(p) {
  const img = p.images[0];
  const c = el("button", { className: "card", type: "button" },
    el("div", { className: "ph" }, el("img", { src: img.thumb, alt: "", loading: "lazy", decoding: "async" })),
    el("div", { className: "c-body" },
      el("p", { className: "c-cat", textContent: p.category }),
      el("p", { className: "t", textContent: p.name }),
      el("p", { className: "s", textContent: p.summary }),
      el("div", { className: "c-foot" },
        el("span", { className: `price${p.free ? " free" : ""}`, textContent: p.price }),
        el("span", { className: "more", textContent: "Details →" }))),
  );
  if (p.badge) c.append(el("span", { className: "badge", textContent: p.badge }));
  c.setAttribute("aria-label", `${p.name}, ${p.price}`);
  c.onclick = () => openViewer(p);
  return c;
}

function renderGrid() {
  const items = visible();
  $("grid").replaceChildren(...items.map(card));
  $("empty").hidden = items.length > 0;
}

function showImage(p, i) {
  $("v-img").src = p.images[i].full;
  [...$("v-thumbs").children].forEach((t, j) => t.setAttribute("aria-current", String(i === j)));
}

function openViewer(p) {
  $("v-img").alt = p.name;
  $("v-thumbs").replaceChildren(...(p.images.length > 1 ? p.images.map((im, i) => {
    const t = el("button", { type: "button", className: "thumb" }, el("img", { src: im.thumb, alt: `Image ${i + 1}` }));
    t.onclick = () => showImage(p, i);
    return t;
  }) : []));
  showImage(p, 0);
  $("v-cat").textContent = p.category + (p.badge ? ` · ${p.badge}` : "");
  $("v-title").textContent = p.name;
  $("v-summary").textContent = p.summary;
  $("v-details").replaceChildren(...p.details.flatMap(([k, v]) => [el("dt", { textContent: k }), el("dd", { textContent: v })]));
  $("v-highlights").replaceChildren(...p.highlights.map((h) => el("li", { textContent: h })));
  $("v-price").textContent = p.price;
  $("v-price").className = `price big${p.free ? " free" : ""}`;
  $("v-buy").href = p.url;
  $("v-buy").textContent = p.free ? "Download free on Gumroad" : "Buy on Gumroad";
  history.replaceState(null, "", `?p=${p.id}`);
  $("viewer").scrollTop = 0;
  if (!$("viewer").open) $("viewer").showModal();
}

function render() {
  renderTabs();
  renderBanner();
  renderGrid();
}

async function start() {
  data = await (await fetch("data.json")).json();
  $("store-link").href = data.store_url;
  $("free-only").onchange = (e) => { state.freeOnly = e.target.checked; renderGrid(); };
  $("search").oninput = (e) => { state.query = e.target.value; renderGrid(); };
  $("viewer").addEventListener("click", (e) => { if (e.target === $("viewer")) $("viewer").close(); });
  $("viewer").addEventListener("close", () => history.replaceState(null, "", location.pathname));
  // Shareable links: ?tab=SQL%20Courses opens a category, ?p=<id> opens a product, &free=1 filters.
  const params = new URLSearchParams(location.search);
  if (data.categories.some((c) => c.name === params.get("tab"))) state.tab = params.get("tab");
  if (params.get("free") === "1") state.freeOnly = $("free-only").checked = true;
  renderStats();
  render();
  const linked = byId(params.get("p"));
  if (linked) openViewer(linked);
}

start();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
