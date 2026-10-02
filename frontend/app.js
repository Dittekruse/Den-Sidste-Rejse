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
// ---------------------------------------------------------------- Stregkodescanner
$("#barcode-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = $("#barcode-input");
  const barcode = input.value.trim();
  const result = $("#barcode-result");

  if (!barcode) return;

  result.replaceChildren(
    h("p", { class: "muted" }, "Søger...")
  );

  try {
    const data = await api(`/items/barcode/${encodeURIComponent(barcode)}`);
    const item = data.item;

    result.replaceChildren(
      h("div", { class: "barcode-result" },
        h("h3", {}, item.name),
        h("p", {}, `Stregkode: ${item.barcode}`),
        h("p", {}, `Lager: ${item.quantity} stk. · Minimum: ${item.min_quantity}`),
        h("p", {}, `Placering: ${item.location || "Ikke angivet"}`),
        h("div", { class: "actions" },
          h("button", {
            type: "button",
            onclick: () => openAction(item, "use"),
          }, "Brug vare"),
          h("button", {
            type: "button",
            class: "secondary",
            onclick: () => {
              result.replaceChildren();
              input.value = "";
              input.focus();
            },
          }, "Luk")
        )
      )
    );
  } catch (err) {
    result.replaceChildren(
      h("p", { class: "error" }, `Ingen vare fundet med stregkoden ${barcode}`)
    );
  }

  input.focus();
});

// ---------------------------------------------------------------- Kamerascanner
// ---------------------------------------------------------------- Kamerascanner
let html5QrCode = null;

$("#camera-scan-button").addEventListener("click", async () => {
  const scannerElement = $("#camera-scanner");
  const button = $("#camera-scan-button");

  if (scannerElement.style.display === "none") {
    scannerElement.style.display = "block";
    button.textContent = "✕ Luk kamera";

    html5QrCode = new Html5Qrcode("camera-scanner");

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 320, height: 140 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
        },
        async (decodedText) => {
          try {
            // Sørg for at vi kun behandler scanningen én gang
            const barcode = String(decodedText).trim();

            console.log("Scannet stregkode:", barcode);

            // Stop kameraet
            await html5QrCode.stop();
            await html5QrCode.clear();
            html5QrCode = null;

            scannerElement.style.display = "none";
            button.textContent = "📷 Scan med kamera";

            // Find varen direkte via stregkoden
            const data = await api(
              `/items/barcode/${encodeURIComponent(barcode)}`
            );

            const item = data.item;

            // Træk automatisk 1 stk. fra lageret
            const result = await api(`/items/${item.id}/use`, {
              method: "POST",
              body: {
                amount: 1,
                employee: state.employee,
              },
            });

            // Vis resultatet
            $("#barcode-result").replaceChildren(
              h(
                "div",
                { class: "barcode-result" },
                h("h3", {}, "Vare registreret"),
                h("p", {}, item.name),
                h(
                  "p",
                  {},
                  `1 stk. brugt · Ny beholdning: ${result.item.quantity} stk.`
                )
              )
            );

            // Opdater hele systemet
            await loadAll();

            toast(
              `${item.name}: 1 stk. trukket fra lageret`,
              "success"
            );

          } catch (error) {
            console.error("Scannerfejl:", error);

            if (html5QrCode) {
              try {
                await html5QrCode.stop();
              } catch {}

              try {
                await html5QrCode.clear();
              } catch {}

              html5QrCode = null;
            }

            scannerElement.style.display = "none";
            button.textContent = "📷 Scan med kamera";

            $("#barcode-result").replaceChildren(
              h(
                "p",
                { class: "error" },
                error?.message || "Kunne ikke finde eller registrere den scannede vare."
              )
            );
          }
        }
      );
    } catch (error) {
      console.error(error);

      scannerElement.style.display = "none";
      button.textContent = "📷 Scan med kamera";

      toast(
        "Kunne ikke åbne kameraet. Tjek kamera-tilladelsen.",
        "error"
      );

      if (html5QrCode) {
        try {
          await html5QrCode.clear();
        } catch {}

        html5QrCode = null;
      }
    }

  } else {

    if (html5QrCode) {
      try {
        await html5QrCode.stop();
      } catch {}

      try {
        await html5QrCode.clear();
      } catch {}

      html5QrCode = null;
    }

    scannerElement.style.display = "none";
    button.textContent = "📷 Scan med kamera";
  }
});
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
    if (result.low_stock_warning) {
  let message = result.low_stock_warning;

  try {
    const orderData = await api("/orders");

    const activeOrder = orderData.orders?.find(
      (order) =>
        order.item_id === item.id &&
        ["BESTILT", "UNDER_BEHANDLING", "AFSENDT"].includes(order.status)
    );

    if (activeOrder) {
      message = `${result.low_stock_warning} — automatisk genbestilling oprettet: ${activeOrder.order_number} (${activeOrder.quantity} stk.)`;
    }
  } catch (error) {
    console.error("Kunne ikke hente ordrestatus:", error);
  }

  setTimeout(() => toast(`⚠ ${message}`, "error"), 1200);
}   
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
  const allItems = groups.flatMap((g) =>
  g.items.map((item) => ({
    ...item,
    supplier: g.supplier
  }))
);

const automaticItems = allItems.filter((item) => item.auto_reorder);
const manualItems = allItems.filter((item) => !item.auto_reorder);

function renderReorderItem(item) {
  return h(
    "div",
    { class: "reorder-item" },

    h(
      "div",
      { class: "reorder-item-header" },

      h(
        "div",
        {},
        h("strong", {}, item.name),

        item.variant_options
          ? h(
              "div",
              { class: "muted" },
              `Variant: ${item.variant_options}`
            )
          : ""
      ),

      badge(
        "Lav beholdning",
        STATUS.LAV
      )
    ),

    h(
      "div",
      { class: "reorder-item-details" },

      h("span", {}, `Lager: ${item.quantity} stk.`),
      h("span", {}, `Minimum: ${item.min_quantity} stk.`),

      h(
        "span",
        {},
        `Automatisk genbestilling: ${
          item.auto_reorder ? "Aktiv" : "Deaktiveret"
        }`
      ),

      item.auto_reorder
        ? h(
            "span",
            {},
            `Genbestiller automatisk: ${item.reorder_quantity} stk.`
          )
        : "",

      h(
        "span",
        {},
        `Leverandør: ${item.supplier || "Ukendt leverandør"}`
      )
    )
  );
}

$("#reorder-list").replaceChildren(
  h(
    "div",
    { class: "card" },

    h("h2", {}, "Automatisk genbestilling"),

    h(
      "p",
      { class: "muted" },
      "Varer under minimum, hvor systemet automatisk opretter en genbestilling."
    ),

    automaticItems.length
      ? h(
          "div",
          { class: "reorder-items" },
          ...automaticItems.map(renderReorderItem)
        )
      : h(
          "p",
          { class: "empty" },
          "Ingen varer kræver automatisk genbestilling."
        )
  ),

  h(
    "div",
    { class: "card" },

    h("h2", {}, "Manuel genbestilling"),

    h(
      "p",
      { class: "muted" },
      "Varer under minimum, hvor genbestillingen skal foretages manuelt."
    ),

    manualItems.length
      ? h(
          "div",
          { class: "reorder-items" },
          ...manualItems.map(renderReorderItem)
        )
      : h(
          "p",
          { class: "empty" },
          "Ingen varer kræver manuel genbestilling."
        )
  )
);
  renderTable($("#most-used"), mostUsed, [
    { label: "Vare", key: "name" },
    { label: "Type", key: "type" },
    { label: "Brugt", class: "num", key: "used" },
    { label: "Gange", class: "num", key: "times" },
  ]);
}
// ---------------------------------------------------------------- Ordrer
async function loadOrders() {
  const container = $("#order-list");

  container.replaceChildren(
    h("p", { class: "muted" }, "Henter ordrer...")
  );

  try {
    const data = await api("/orders");

    if (!data.orders || data.orders.length === 0) {
      container.replaceChildren(
        h("p", { class: "muted" }, "Der er ingen ordrer endnu.")
      );
      return;
    }

    const statuses = [
      {
        key: "BESTILT",
        label: "Bestilt",
      },
      {
        key: "UNDER_BEHANDLING",
        label: "Under behandling",
      },
      {
        key: "AFSENDT",
        label: "Afsendt",
      },
      {
        key: "MODTAGET",
        label: "Modtaget",
      },
    ];

    const statusText = {
      BESTILT: "Ordren er registreret",
      UNDER_BEHANDLING: "Ordren behandles hos leverandøren",
      AFSENDT: "Ordren er afsendt og er på vej",
      MODTAGET: "Ordren er modtaget på lageret",
    };

    container.replaceChildren(
      ...data.orders.map((order) => {
        const currentIndex = statuses.findIndex(
          (status) => status.key === order.status
        );

        const progress = h(
          "div",
          { class: "order-progress" },
          ...statuses.flatMap((status, index) => {
            const stepClass =
              index < currentIndex
                ? "order-progress-step completed"
                : index === currentIndex
                  ? "order-progress-step active"
                  : "order-progress-step";

            const step = h(
              "div",
              { class: stepClass },
              h("div", { class: "order-progress-dot" })
            );

            if (index < statuses.length - 1) {
              const lineClass =
                index < currentIndex
                  ? "order-progress-line completed"
                  : "order-progress-line";

              return [
                step,
                h("div", { class: lineClass }),
              ];
            }

            return [step];
          })
        );

        const labels = h(
          "div",
          { class: "order-progress-labels" },
          ...statuses.map((status) =>
            h(
              "span",
              {},
              status.label
            )
          )
        );

        const statusClass = order.status
          .toLowerCase()
          .replace("_", "-");

        return h(
          "div",
          { class: "card order-card" },

          h(
            "div",
            { class: "order-header" },
            h(
              "div",
              {},
              h("h3", {}, order.order_number),
              h(
  "div",
  {},
  h(
    "p",
    { class: "order-item-name" },
    order.item_name
  ),
  order.variant_options
    ? h(
        "p",
        { class: "muted" },
        `Variant: ${order.variant_options}`
      )
    : ""
)
            ),

            h(
              "span",
              { class: `order-status ${statusClass}` },
              statuses[currentIndex]?.label || order.status
            )
          ),

          h(
            "div",
            { class: "order-details" },
            h("span", {}, `${order.quantity} stk.`),
            h(
              "span",
              {},
              `Leverandør: ${order.supplier || "Ikke angivet"}`
            )
          ),

          progress,

          labels,

          h(
            "p",
            { class: "order-status-text" },
            statusText[order.status] || ""
          )
        );
      })
    );
  } catch (err) {
    console.error(err);

    container.replaceChildren(
      h(
        "p",
        { class: "error" },
        "Kunne ikke hente ordrerne."
      )
    );
  }
}
// ---------------------------------------------------------------- Varer (CRUD)
function setupVariantSelectors() {
  const typeSelect = document.querySelector("#item-type");
  const productSelect = document.querySelector("#item-product");
  const variantOptionsSelect = document.querySelector("#variant-options");
  const otherVariantRow = document.querySelector("#other-variant-row");
  const otherVariantInput = document.querySelector("#other-variant");
  const autoReorderCheckbox = document.querySelector("#auto-reorder");
  const reorderSettings = document.querySelector("#reorder-settings");

  const products = {
    "Urne": {
      "Askerør til askespredning": {
        variantType: "Motiv",
        options: [
          "Solnedgang",
          "Blå himmel",
          "Fugl",
          "Nattehimmel",
          "Sommerfugl",
          "Skov",
          "Andet motiv"
        ]
      },

      "Barkurne": {
        variantType: "Farve",
        options: [
          "Sort",
          "Hvid",
          "Blå",
          "Rød",
          "Grøn",
          "Anden farve"
        ]
      },

      "Heimurne – plantefiber": {
        variantType: "Farve",
        options: [
          "Sort",
          "Rød",
          "Hvid",
          "Grøn",
          "Blå",
          "Anden farve"
        ]
      },

      "Ler- eller keramikurne": {
        variantType: "Farve",
        options: [
          "Sort",
          "Grå",
          "Mørkerød",
          "Beige",
          "Brun",
          "Hvid",
          "Blå",
          "Grøn",
          "Gul",
          "Rød",
          "Anden farve"
        ]
      },

      "Od-stone urne – plantefiber": {
        variantType: "Farve",
        options: [
          "Grå",
          "Blå",
          "Beige",
          "Anden farve"
        ]
      },

      "Sfera søkugle – presset sandsten": {
        variantType: "Farve",
        options: [
          "Rød",
          "Brun",
          "Grå",
          "Blå",
          "Grøn",
          "Anden farve"
        ]
      }
    },

   "Kiste": {
  "Begravelseskiste med perlebort": {},
  
  "Farvet kiste til kremering": {
    variantType: "Farve",
    options: [
      "Sort",
      "Hvid",
      "Rød",
      "Blå",
      "Grøn",
      "Anden farve"
    ]
  },

  "Egetræskiste": {},
  
  "Mahognikiste": {},
  
  "Klassisk hvid begravelseskiste": {},
  
  "Fyrretræskiste": {},
  
  "Klassisk hvid kiste til kremering m guirlande": {},
  
  "Klassisk hvid kiste til kremering": {}
},

    "Tekstil": {},
    "Tryksager": {},
    "Dekoration": {}
  };

  function resetProduct() {
    productSelect.innerHTML =
      '<option value="">Vælg først type</option>';

    productSelect.disabled = true;

    resetVariant();
  }

  function resetVariant() {
    variantOptionsSelect.innerHTML =
      '<option value="">Ingen variant</option>';

    variantOptionsSelect.disabled = true;

    otherVariantRow.style.display = "none";
    otherVariantInput.value = "";
  }

  function updateProducts() {
    resetProduct();

    const selectedType = typeSelect.value;
    const typeProducts = products[selectedType];

    if (!typeProducts) {
      return;
    }

    const productNames = Object.keys(typeProducts);

    if (productNames.length === 0) {
      productSelect.innerHTML =
        '<option value="">Ingen produkter oprettet endnu</option>';
      return;
    }

    productSelect.innerHTML =
      '<option value="">Vælg vare</option>';

    for (const productName of productNames) {
      const option = document.createElement("option");

      option.value = productName;
      option.textContent = productName;

      productSelect.appendChild(option);
    }

    productSelect.disabled = false;
  }

  function updateVariants() {
    resetVariant();

    const selectedType = typeSelect.value;
    const selectedProduct = productSelect.value;

    const product =
      products[selectedType]?.[selectedProduct];

    if (!product || !product.options?.length) {
      return;
    }

    variantOptionsSelect.innerHTML =
      `<option value="">Vælg ${product.variantType.toLowerCase()}</option>`;

    for (const optionText of product.options) {
      const option = document.createElement("option");

      option.value = optionText;
      option.textContent = optionText;

      variantOptionsSelect.appendChild(option);
    }

    variantOptionsSelect.disabled = false;
  }

  function checkForOtherVariant() {
    const value = variantOptionsSelect.value;

    if (
      value === "Anden farve" ||
      value === "Andet motiv"
    ) {
      otherVariantRow.style.display = "";
      otherVariantInput.required = true;
    } else {
      otherVariantRow.style.display = "none";
      otherVariantInput.required = false;
      otherVariantInput.value = "";
    }
  }

  function updateReorderSettings() {
    if (autoReorderCheckbox.checked) {
      reorderSettings.style.display = "";
    } else {
      reorderSettings.style.display = "none";
    }
  }

  typeSelect.addEventListener(
    "change",
    updateProducts
  );

  productSelect.addEventListener(
    "change",
    updateVariants
  );

  variantOptionsSelect.addEventListener(
    "change",
    checkForOtherVariant
  );

  autoReorderCheckbox.addEventListener(
    "change",
    updateReorderSettings
  );

  resetProduct();
  updateReorderSettings();
}
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
setupVariantSelectors();
async function loadAll() {
  await Promise.all([
    loadInventory(), 
    loadHistory(), 
    loadReorder(),
    loadOrders(),
     loadItems(),
    ]);
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
