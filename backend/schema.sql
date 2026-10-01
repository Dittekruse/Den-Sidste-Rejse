-- Den Sidste Rejse – lagerfunktion i EG

CREATE TABLE employee (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

-- Vare
CREATE TABLE item (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,                  -- Urne, Kiste, Tekstil, Tryksag, Pynt
    quantity     INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER NOT NULL DEFAULT 0,
    supplier     TEXT,
    location     TEXT,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Lagerændring: før, ændring og efter gemmes, så man kan se hvorfor antallet har ændret sig
CREATE TABLE stock_change (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    changed_at  TEXT NOT NULL,
    before      INTEGER NOT NULL,
    change      INTEGER NOT NULL,
    after       INTEGER NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('MODTAGET', 'BRUGT', 'KORREKTION')),
    employee    TEXT NOT NULL,
    case_ref    TEXT,                             -- evt. kobling til en sag i EG
    note        TEXT
);
