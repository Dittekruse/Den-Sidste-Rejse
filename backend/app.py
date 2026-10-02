"""Den Sidste Rejse – lagerfunktion i EG. Flask API (logiklag).

Kravgrundlag: ../Kravspecifikation.md
Kør:  pip install -r requirements.txt  &&  python app.py  →  http://localhost:5109
"""
import os

from flask import jsonify, request

from core import ApiError, create_app, get_or_404, json_body, now, register_crud, require, run
from database import init_db, query_all, query_one, execute, transaction

PORT = int(os.environ.get("PORT", 5109))
app = create_app(__name__, "Den Sidste Rejse – Lager")


# ---------------------------------------------------------------- Forretningsregler
def stock_status(item):
    if item["quantity"] == 0:
        return "UDSOLGT"
    if item["quantity"] < item["min_quantity"]:
        return "LAV"
    return "OK"

def create_reorder_if_needed(item):
    """Opretter automatisk en genbestilling, hvis varen er under minimum
    og automatisk genbestilling er slået til.
    """

    # Automatisk genbestilling er slået fra
    if not item["auto_reorder"]:
        return None

    # Varen er ikke under minimum
    if item["quantity"] >= item["min_quantity"]:
        return None

    # Undgå flere åbne ordrer på samme vare
    existing = query_one(
        """
        SELECT *
        FROM purchase_order
        WHERE item_id = ?
          AND status IN ('BESTILT', 'UNDER_BEHANDLING', 'AFSENDT')
        ORDER BY id DESC
        LIMIT 1
        """,
        (item["id"],)
    )

    if existing:
        return existing

    # Brug det antal, der er angivet i varekartoteket
    reorder_quantity = item["reorder_quantity"]

    # Hvis der ikke er angivet et antal, bestil mindst 1
    if reorder_quantity <= 0:
        reorder_quantity = 1

    next_number = query_one(
        "SELECT COUNT(*) AS count FROM purchase_order"
    )["count"] + 1

    order_number = f"ORD-{next_number:03d}"

    order_id = execute(
        """
        INSERT INTO purchase_order
            (order_number, item_id, quantity, supplier, status)
        VALUES (?, ?, ?, ?, 'BESTILT')
        """,
        (
            order_number,
            item["id"],
            reorder_quantity,
            item["supplier"],
        )
    )

    return query_one(
        "SELECT * FROM purchase_order WHERE id = ?",
        (order_id,)
    )


def with_status(item):
    item["status"] = stock_status(item)

    # Vis det valgte genbestillingsantal,
    # men kun hvis automatisk genbestilling er slået til.
    if item["auto_reorder"]:
        item["reorder_quantity"] = item["reorder_quantity"]
    else:
        item["reorder_quantity"] = 0

    return item


def change_stock(item_id, change, change_type, employee, case_ref=None, note=None):
    """Den eneste måde lagerbeholdningen ændres på: opdatér antal og gem før/ændring/efter i historikken."""
    item = get_or_404("item", item_id, "Vare")
    after = item["quantity"] + change
    if after < 0:
        raise ApiError(f"Der er kun {item['quantity']} stk. {item['name']} på lager.")
    with transaction() as db:
        db.execute("UPDATE item SET quantity = ?, updated_at = ? WHERE id = ?", (after, now(), item_id))
        db.execute("""INSERT INTO stock_change (item_id, changed_at, before, change, after, change_type, employee, case_ref, note)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                   (item_id, now(), item["quantity"], change, after, change_type, employee, case_ref, note))
    updated = with_status(get_or_404("item", item_id))
    reorder = create_reorder_if_needed(updated)
    warning = None
    if updated["status"] != "OK":
        warning = (f"{updated['name']} er udsolgt" if updated["status"] == "UDSOLGT"
                   else f"{updated['name']} er under minimum ({updated['quantity']} af {updated['min_quantity']})")
    return jsonify(
        item=updated, 
        change={
            "before": item["quantity"], 
            "change": change,
            "after": after
        },
        low_stock_warning=warning,
        reorder=reorder
    )


def positive_amount(data):
    require(data, "amount", "employee")
    amount = int(data["amount"])
    if amount <= 0:
        raise ApiError("Antal skal være større end 0")
    return amount


# ---------------------------------------------------------------- CRUD
# Antal kan sættes ved oprettelse, men ændres derefter kun via modtag/brug/korrektion (så historikken passer)


register_crud(
    app,
    "items",
    "item",
    fields=[
        "name",
        "type",
        "barcode",
        "quantity",
        "min_quantity",
        "supplier",
        "location",
        "variant_type",
        "variant_options",
        "auto_reorder",
        "reorder_quantity"
    ],
    update_fields=[
        "name",
        "type",
        "barcode",
        "min_quantity",
        "supplier",
        "location",
        "variant_type",
        "variant_options",
        "auto_reorder",
        "reorder_quantity"
    ],
    required=["name", "type"],
    defaults={"updated_at": now}
)

register_crud(
    app,
    "employees",
    "employee",
    fields=["name"],
    required=["name"]
)

@app.get("/api/items/barcode/<barcode>")
def get_item_by_barcode(barcode):
    """Find en vare via dens stregkode."""
    item = query_all(
        "SELECT * FROM item WHERE barcode = ?",
        (barcode,)
    )

    if not item:
        raise ApiError(f"Ingen vare fundet med stregkoden {barcode}")

    return jsonify(item=with_status(item[0]))
@app.get("/api/orders")
def get_orders():
    orders = query_all(
        """
        SELECT
            po.id,
            po.order_number,
            po.item_id,
            po.quantity,
            po.supplier,
            po.status,
            po.ordered_at,
            po.received_at,
            i.name AS item_name,
            i.variant_options,
            i.barcode,
            i.location
        FROM purchase_order po
        JOIN item i ON i.id = po.item_id
        ORDER BY po.id DESC
        """
    )

    return jsonify(orders=orders)


# ---------------------------------------------------------------- Ordrestatus
@app.put("/api/orders/<int:order_id>/status")
def update_order_status(order_id):
    data = json_body()
    status = data.get("status")
    employee = data.get("employee") or "System"

    allowed_statuses = {
        "BESTILT",
        "UNDER_BEHANDLING",
        "AFSENDT",
        "MODTAGET",
    }

    if status not in allowed_statuses:
        raise ApiError("Ugyldig ordrestatus")

    order = get_or_404("purchase_order", order_id, "Ordre")

    # Hvis ordren allerede er modtaget, må lageret ikke opdateres igen.
    already_received = order["status"] == "MODTAGET"

    if status == "MODTAGET" and not already_received:
        item = query_one(
            "SELECT * FROM item WHERE id = ?",
            (order["item_id"],)
        )

        if not item:
            raise ApiError("Varen til ordren blev ikke fundet")

        before = item["quantity"]
        after = before + order["quantity"]

        execute(
            "UPDATE item SET quantity = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            (after, item["id"])
        )

        execute(
    """
    INSERT INTO stock_change
        (item_id, changed_at, change_type, before, change, after, employee, case_ref, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
            (
    item["id"],
    now(),
    "MODTAGET",
    before,
    order["quantity"],
    after,
    employee,
    None,
    f"Modtaget fra ordre {order['order_number']}",
)
        )

        execute(
            """
            UPDATE purchase_order
            SET status = ?,
                received_at = datetime('now', 'localtime')
            WHERE id = ?
            """,
            (status, order_id)
        )

    else:
        execute(
            "UPDATE purchase_order SET status = ? WHERE id = ?",
            (status, order_id)
        )

    return jsonify(
        order=query_one(
            "SELECT * FROM purchase_order WHERE id = ?",
            (order_id,)
        )
    )

# ---------------------------------------------------------------- Lageroversigt
@app.get("/api/inventory")
def inventory():
    """Søg, filtrér og sortér: ?q=urne&type=Urne&low=1&sort=quantity"""
    args = request.args
    sql, params = "SELECT * FROM item WHERE 1 = 1", []
    if args.get("q"):
        sql += " AND (name LIKE ? OR supplier LIKE ? OR location LIKE ?)"
        params += [f"%{args['q']}%"] * 3
    if args.get("type"):
        sql += " AND type = ?"
        params.append(args["type"])
    order = {"quantity": "quantity ASC", "name": "name", "updated": "updated_at DESC"}.get(args.get("sort"), "type, name")
    items = [with_status(i) for i in query_all(f"{sql} ORDER BY {order}", params)]
    if args.get("low") in ("1", "true"):
        items = [i for i in items if i["status"] != "OK"]
    return jsonify(
        summary={"items": len(items), "low": sum(i["status"] == "LAV" for i in items),
                 "sold_out": sum(i["status"] == "UDSOLGT" for i in items)},
        types=[r["type"] for r in query_all("SELECT DISTINCT type FROM item ORDER BY type")],
        items=items,
    )


# ---------------------------------------------------------------- Lagerbevægelser
@app.post("/api/items/<int:item_id>/receive")
def receive(item_id):
    """Nye varer kommer på lager."""
    data = json_body()
    return change_stock(item_id, positive_amount(data), "MODTAGET", data["employee"], note=data.get("note"))


@app.post("/api/items/<int:item_id>/use")
def use(item_id):
    """Varer tages fra lageret – evt. koblet til en sag."""
    data = json_body()
    return change_stock(item_id, -positive_amount(data), "BRUGT", data["employee"],
                        case_ref=data.get("case_ref"), note=data.get("note"))


@app.post("/api/items/<int:item_id>/adjust")
def adjust(item_id):
    """Manuel korrektion efter optælling. Kræver en begrundelse."""
    data = json_body()
    require(data, "new_quantity", "employee", "note")
    item = get_or_404("item", item_id, "Vare")
    new_quantity = int(data["new_quantity"])
    if new_quantity < 0:
        raise ApiError("Antal kan ikke være negativt")
    if new_quantity == item["quantity"]:
        raise ApiError("Det nye antal er det samme som det nuværende")
    return change_stock(item_id, new_quantity - item["quantity"], "KORREKTION", data["employee"], note=data["note"])


@app.get("/api/history")
def history():
    """Lagerhistorik (før/ændring/efter) – evt. for én vare: ?item_id=1"""
    item_id = request.args.get("item_id")
    sql = """SELECT c.*, i.name AS item_name FROM stock_change c JOIN item i ON i.id = c.item_id"""
    rows = query_all(sql + (" WHERE c.item_id = ?" if item_id else "") + " ORDER BY c.changed_at DESC, c.id DESC LIMIT 100",
                     (item_id,) if item_id else ())
    return jsonify(rows)


# ---------------------------------------------------------------- Genbestilling og statistik
@app.get("/api/reorder-list")
def reorder_list():
    """Viser kun varer med automatisk genbestilling, som er under minimum."""
    items = [
        with_status(i)
        for i in query_all("SELECT * FROM item ORDER BY supplier, name")
    ]

    by_supplier = {}

    for item in items:
        # Kun varer med automatisk genbestilling
        

        # Kun hvis lageret er under minimum
        if item["quantity"] >= item["min_quantity"]:
            continue

        # Opret automatisk genbestilling
        create_reorder_if_needed(item)

        by_supplier.setdefault(
            item["supplier"] or "Ukendt leverandør",
            []
        ).append(item)

    return jsonify([
        {"supplier": supplier, "items": rows}
        for supplier, rows in by_supplier.items()
    ])
@app.get("/api/stats/most-used")
def most_used():
    """Mest brugte varer: ?days=90"""
    days = int(request.args.get("days", 90))
    return jsonify(query_all("""
        SELECT i.id, i.name, i.type, -SUM(c.change) AS used, COUNT(*) AS times
        FROM stock_change c JOIN item i ON i.id = c.item_id
        WHERE c.change_type = 'BRUGT' AND c.changed_at >= datetime('now', ?)
        GROUP BY i.id ORDER BY used DESC LIMIT 10
    """, (f"-{days} days",)))


if __name__ == "__main__":
    init_db()
    run(app, PORT)
