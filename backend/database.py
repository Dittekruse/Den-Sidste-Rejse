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
    """Opretter tabeller og testdata, hvis databasen er tom. Returnerer True, hvis den blev oprettet."""
    if reset and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = connect()
    if conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'").fetchone()[0]:
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
