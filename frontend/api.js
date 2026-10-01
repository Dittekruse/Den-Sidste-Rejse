// Fælles klientkode, ens i alle prototyper.
// api() er det eneste sted i frontenden, der kender HTTP og fetch().

// API'et kaldes relativt til den mappe, siden er hentet fra. Det virker både direkte
// (http://localhost:5101/ → /api/...) og bag Nginx under en sti (/stockup/ → /stockup/api/...).
// Åbnes index.html direkte fra disken (file://), sendes kaldene til backendens port på localhost.
const API_BASE = location.protocol === "file:"
  ? `http://localhost:${document.body.dataset.apiPort}`
  : location.pathname.replace(/\/[^/]*$/, "");

async function api(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  showLastResponse(method, path, response.status, data);
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}

// Viser det seneste rå JSON-svar i <pre id="last-response">, så dataudvekslingen kan ses
function showLastResponse(method, path, status, data) {
  const box = document.getElementById("last-response");
  if (box) box.textContent = `${method} /api${path}  →  ${status}\n\n${JSON.stringify(data, null, 2)}`;
}

// Lille DOM-hjælper: h("td", { class: "num" }, "42") -> <td class="num">42</td>
// Tekst indsættes altid som tekst (ikke HTML), så data fra serveren ikke kan køre som kode.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function $(selector) {
  return document.querySelector(selector);
}

// Tegner en tabel. columns: [{ label, key } eller { label, render: row => node/tekst }]
function renderTable(container, rows, columns, emptyText = "Ingen data") {
  container.replaceChildren();
  if (!rows.length) {
    container.append(h("p", { class: "empty" }, emptyText));
    return;
  }
  container.append(
    h("div", { class: "table-wrap" },
      h("table", {},
        h("thead", {}, h("tr", {}, columns.map((c) => h("th", {}, c.label)))),
        h("tbody", {}, rows.map((row) =>
          h("tr", {}, columns.map((c) => h("td", { class: c.class }, c.render ? c.render(row) : row[c.key] ?? "–"))),
        )),
      ),
    ),
  );
}

// Fylder en <select> med rækker fra API'et
function fillSelect(select, rows, label, { valueKey = "id", placeholder } = {}) {
  select.replaceChildren(
    ...(placeholder ? [h("option", { value: "" }, placeholder)] : []),
    ...rows.map((row) => h("option", { value: row[valueKey] }, label(row))),
  );
}

// Læser en <form> til et JSON-objekt. Talfelter bliver til tal, tomme felter udelades.
function formToJson(form) {
  const data = {};
  for (const field of form.elements) {
    if (!field.name || field.disabled) continue;
    if (field.type === "checkbox") {
      if (field.dataset.list !== undefined) {
        data[field.name] ??= [];
        if (field.checked) data[field.name].push(field.value);
      } else data[field.name] = field.checked;
      continue;
    }
    if (field.value === "") continue;
    data[field.name] = field.type === "number" || field.dataset.number !== undefined
      ? Number(field.value)
      : field.value;
  }
  return data;
}

// Viser en kort besked i toppen af siden
function toast(message, type = "ok") {
  const box = $("#toast");
  box.textContent = message;
  box.className = `toast show ${type}`;
  clearTimeout(box._timer);
  box._timer = setTimeout(() => (box.className = "toast"), 4000);
}

// Kører en handling og viser succes- eller fejlbesked
async function run(action, successMessage) {
  try {
    const result = await action();
    if (successMessage) toast(typeof successMessage === "function" ? successMessage(result) : successMessage);
    return result;
  } catch (err) {
    toast(err.message, "error");
    throw err;
  }
}

// Faneblade: <nav class="tabs"><button data-tab="x"> og <section class="tab" id="tab-x">
function setupTabs(onChange) {
  const buttons = document.querySelectorAll(".tabs button");
  buttons.forEach((button) => button.addEventListener("click", () => {
    buttons.forEach((b) => b.classList.toggle("active", b === button));
    document.querySelectorAll(".tab").forEach((tab) =>
      tab.classList.toggle("active", tab.id === `tab-${button.dataset.tab}`));
    onChange?.(button.dataset.tab);
  }));
}

function badge(text, variant = "") {
  return h("span", { class: `badge ${variant}` }, text);
}

function formatDate(value) {
  return value ? new Date(value.replace(" ", "T")).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" }) : "–";
}

function formatKr(value) {
  return value === null || value === undefined ? "–" : `${Number(value).toLocaleString("da-DK")} kr.`;
}

// ---- CRUD-formularer ------------------------------------------------------
// En <form> med et skjult id-felt: tomt id → POST (opret), udfyldt id → PUT (opdatér)
function bindCrudForm(form, resource, onSaved) {
  const clear = () => { form.reset(); form.elements.id.value = ""; };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { id, ...data } = formToJson(form);
    await run(
      () => api(id ? `/${resource}/${id}` : `/${resource}`, { method: id ? "PUT" : "POST", body: data }),
      id ? "Ændringer gemt" : "Oprettet",
    );
    clear();
    onSaved?.();
  });
  form.querySelector("[data-reset]")?.addEventListener("click", clear);
}

function fillForm(form, row) {
  for (const field of form.elements) {
    if (field.name && field.name in row) field.value = row[field.name] ?? "";
  }
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Knapperne "Redigér" og "Slet" til en tabelrække
function crudButtons(resource, form, row, reload) {
  return h("div", { class: "actions" },
    h("button", { class: "small secondary", onclick: () => fillForm(form, row) }, "Redigér"),
    h("button", {
      class: "small danger",
      onclick: async () => {
        if (!confirm("Vil du slette denne post?")) return;
        await run(() => api(`/${resource}/${row.id}`, { method: "DELETE" }), "Slettet");
        reload();
      },
    }, "Slet"),
  );
}
