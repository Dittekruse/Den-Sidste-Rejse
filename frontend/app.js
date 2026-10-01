// EG Lager (Den Sidste Rejse) – præsentationslag. Henter JSON fra Flask-API'et og viser det i DOM'en.

const state = { employee: null, items: [] };

const STATUS = { OK: "ok", LAV: "warn", UDSOLGT: "danger" };
const CHANGE = { MODTAGET: "ok", BRUGT: "", KORREKTION: "warn" };

// ---------------------------------------------------------------- Lageroversigt
async function loadInventory() {
  const form = $("#filter-form");
  const params = new URLSearchParams(formToJson(form));
  if (!form.elements.low.checked) params.delete("low");
  const data = await api(`/inventory?${params}`);
  state.items = data.items;

  const typeSelect = form.elements.type;
  const selectedType = typeSelect.value;
  fillSelect(typeSelect, data.types.map((t) => ({ id: t })), (t) => t.id, { placeholder: "Alle typer" });
  typeSelect.value = selectedType;
  $("#type-list").replaceChildren(...data.types.map((t) => h("option", { value: t })));

  $("#kpis").replaceChildren(
    kpi(data.summary.items, "varer vist"),
    kpi(data.summary.low, "lav beholdning"),
    kpi(data.summary.sold_out, "udsolgt"),
  );

  renderTable($("#stock-table"), data.items, [
    { label: "Vare", render: (i) => h("strong", {}, i.name) },
    { label: "Type", key: "type" },
    { label: "Antal", class: "num", render: (i) => h("strong", {}, i.quantity) },
    { label: "Min.", class: "num", key: "min_quantity" },
    { label: "Status", render: (i) => badge(i.status === "LAV" ? "Lav beholdning" : i.status, STATUS[i.status]) },
    { label: "Placering", key: "location" },
    { label: "Seneste ændring", render: (i) => formatDate(i.updated_at) },
    {
      label: "",
      render: (i) => h("div", { class: "actions" },
        h("button", { class: "small", onclick: () => openAction(i, "use") }, "Brug"),
        h("button", { class: "small secondary", onclick: () => openAction(i, "receive") }, "Modtag"),
        h("button", { class: "small secondary", onclick: () => openAction(i, "adjust") }, "Korrigér")),
    },
  ], "Ingen varer matcher søgningen");
}

function kpi(value, label) {
  return h("div", { class: "kpi" }, h("div", { class: "value" }, value), h("div", { class: "label" }, label));
}

$("#filter-form").addEventListener("input", () => loadInventory());
$("#filter-form").addEventListener("submit", (event) => event.preventDefault());

// ---------------------------------------------------------------- Registrér ændring (modtag / brug / korrektion)
const ACTIONS = {
  receive: { title: "Modtag varer", button: "Registrér modtagelse" },
  use: { title: "Registrér brug", button: "Træk fra lager" },
  adjust: { title: "Manuel korrektion", button: "Gem korrektion" },
};

function openAction(item, action) {
  const panel = $("#action-panel");
  const form = h("form", {},
    action === "adjust"
      ? h("label", {}, "Optalt antal", h("input", { type: "number", name: "new_quantity", min: 0, value: item.quantity, required: true }))
      : h("label", {}, "Antal", h("input", { type: "number", name: "amount", min: 1, value: 1, required: true })),
    action === "use" ? h("label", {}, "Sag i EG (valgfri)", h("input", { name: "case_ref", placeholder: "SAG-2026-..." })) : "",
    h("label", {}, action === "adjust" ? "Begrundelse (påkrævet)" : "Note (valgfri)",
      h("input", { name: "note", required: action === "adjust" })),
    h("div", { class: "actions" },
      h("button", {}, ACTIONS[action].button),
      h("button", { type: "button", class: "secondary", onclick: () => (panel.hidden = true) }, "Annullér")));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await run(() => api(`/items/${item.id}/${action}`, {
      method: "POST", body: { ...formToJson(form), employee: state.employee },
    }), (r) => `${r.item.name}: ${r.change.before} → ${r.change.after} stk.`);
    if (result.low_stock_warning) setTimeout(() => toast(`⚠ ${result.low_stock_warning}`, "error"), 1200);
    panel.hidden = true;
    loadAll();
  });

  panel.hidden = false;
  panel.replaceChildren(h("h2", {}, `${ACTIONS[action].title}: ${item.name}`),
    h("p", { class: "muted" }, `Nuværende beholdning: ${item.quantity} stk. · Minimum: ${item.min_quantity}`), form);
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  form.querySelector("input").focus();
}

// ---------------------------------------------------------------- Historik
async function loadHistory() {
  const select = $("#history-form [name=item_id]");
  const selected = select.value;
  const items = await api("/items");
  fillSelect(select, items, (i) => i.name, { placeholder: "Alle varer" });
  select.value = selected;
  const rows = await api(`/history${selected ? `?item_id=${selected}` : ""}`);
  renderTable($("#history-table"), rows, [
    { label: "Dato", render: (c) => formatDate(c.changed_at) },
    { label: "Vare", key: "item_name" },
    { label: "Type", render: (c) => badge(c.change_type, CHANGE[c.change_type]) },
    { label: "Før", class: "num", key: "before" },
    { label: "Ændring", class: "num", render: (c) => `${c.change > 0 ? "+" : ""}${c.change}` },
    { label: "Efter", class: "num", key: "after" },
    { label: "Medarbejder", key: "employee" },
    { label: "Sag / note", render: (c) => [c.case_ref, c.note].filter(Boolean).join(" · ") || "–" },
  ], "Ingen ændringer endnu");
}

$("#history-form").addEventListener("change", loadHistory);

// ---------------------------------------------------------------- Genbestilling og statistik
async function loadReorder() {
  const [groups, mostUsed] = await Promise.all([api("/reorder-list"), api("/stats/most-used")]);
  $("#reorder-list").replaceChildren(...(groups.length
    ? groups.map((g) => h("div", { class: "card" },
        h("h3", {}, g.supplier),
        h("ul", { class: "list" }, g.items.map((i) => h("li", {},
          badge(i.status, STATUS[i.status]), ` ${i.name}: ${i.quantity} på lager (min. ${i.min_quantity}) → bestil `,
          h("strong", {}, `${i.reorder_quantity} stk.`))))))
    : [h("p", { class: "empty" }, "Intet skal bestilles 🎉")]));
  renderTable($("#most-used"), mostUsed, [
    { label: "Vare", key: "name" },
    { label: "Type", key: "type" },
    { label: "Brugt", class: "num", key: "used" },
    { label: "Gange", class: "num", key: "times" },
  ]);
}

// ---------------------------------------------------------------- Varer (CRUD)
async function loadItems() {
  const items = await api("/items");
  const form = $("#item-form");
  renderTable($("#item-table"), items, [
    { label: "Varenavn", key: "name" },
    { label: "Type", key: "type" },
    { label: "Min.", class: "num", key: "min_quantity" },
    { label: "Leverandør", key: "supplier" },
    { label: "Placering", key: "location" },
    { label: "", render: (i) => crudButtons("items", form, i, loadAll) },
  ]);
}

bindCrudForm($("#item-form"), "items", loadAll);

// ---------------------------------------------------------------- Start
async function loadAll() {
  await Promise.all([loadInventory(), loadHistory(), loadReorder(), loadItems()]);
}

async function start() {
  const employees = await api("/employees");
  fillSelect($("#employee-select"), employees, (e) => e.name, { valueKey: "name" });
  state.employee = $("#employee-select").value;
  await loadAll();
}

$("#employee-select").addEventListener("change", (event) => (state.employee = event.target.value));

setupTabs();
start().catch((err) => toast(`Kan ikke hente data fra backenden: ${err.message}`, "error"));
