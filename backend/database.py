"""DATALAG – SQLite3-forbindelse og hjælpefunktioner.

Filen er ens i alle prototyper. Det er det eneste sted, der kender sqlite3.
Tabeller står i schema.sql og testdata i seed.sql.

    python database.py          # opretter databasen, hvis den ikke findes
    python database.py --reset  # sletter databasen og indlæser testdata forfra
"""
import os
import sqlite3
import sys

from flask import g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "database.db"))


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db():
    """Én forbindelse pr. HTTP-request, lukkes igen af close_db()."""
    if "db" not in g:
        g.db = connect()
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query_all(sql, params=()):
    return [dict(row) for row in get_db().execute(sql, params).fetchall()]


def query_one(sql, params=()):
    row = get_db().execute(sql, params).fetchone()
    return dict(row) if row else None


def execute(sql, params=()):
    """Kør én INSERT/UPDATE/DELETE og gem med det samme. Returnerer nyt id."""
    db = get_db()
    cursor = db.execute(sql, params)
    db.commit()
    return cursor.lastrowid


def transaction():
    """Flere ændringer som én atomar enhed:

        with transaction() as db:
            db.execute(...)
            db.execute(...)

    Går noget galt (fx en ApiError), rulles det hele tilbage.
    """
    return get_db()

def init_db(reset=False):
    """Opretter databasen og sikrer, at nødvendige kolonner findes."""
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = connect()

    tables_exist = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'"
    ).fetchone()[0]

    if tables_exist:
        columns = [
            row["name"]
            for row in conn.execute("PRAGMA table_info(item)").fetchall()
        ]

        if "barcode" not in columns:
            conn.execute("ALTER TABLE item ADD COLUMN barcode TEXT")
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_item_barcode "
                "ON item(barcode) WHERE barcode IS NOT NULL"
            )

        if "variant_type" not in columns:
            conn.execute(
                "ALTER TABLE item ADD COLUMN variant_type TEXT"
            )

        if "variant_options" not in columns:
            conn.execute(
                "ALTER TABLE item ADD COLUMN variant_options TEXT"
            )

        if "auto_reorder" not in columns:
             conn.execute(
               "ALTER TABLE item ADD COLUMN auto_reorder INTEGER NOT NULL DEFAULT 0"
    )

        if "reorder_quantity" not in columns:
           conn.execute(
                "ALTER TABLE item ADD COLUMN reorder_quantity INTEGER NOT NULL DEFAULT 0"
    )

        conn.execute("""
            CREATE TABLE IF NOT EXISTS purchase_order (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number  TEXT NOT NULL UNIQUE,
                item_id       INTEGER NOT NULL,
                quantity      INTEGER NOT NULL CHECK (quantity > 0),
                supplier      TEXT,
                status        TEXT NOT NULL DEFAULT 'BESTILT',
                ordered_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                received_at  TEXT,
                FOREIGN KEY (item_id) REFERENCES item(id)
            )
        """)

        conn.commit()
        conn.close()
        return False

    for filename in ("schema.sql", "seed.sql"):
        with open(os.path.join(BASE_DIR, filename), encoding="utf-8") as f:
            conn.executescript(f.read())

    conn.commit()
    conn.close()
    return True

if __name__ == "__main__":
    created = init_db(reset="--reset" in sys.argv)
    print(("Database oprettet: " if created else "Database findes allerede: ") + DB_PATH)
