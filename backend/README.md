# Den Sidste Rejse – Lager i EG – prototype

Lageroversigt med søgning, filtrering og sortering. Beholdningen ændres kun via Modtag, Brug (evt. koblet til en sag) og Korrektion, og hver ændring gemmes med før/ændring/efter. Varer under minimum markeres og kommer på genbestillingslisten.

Kravgrundlag: [`../Kravspecifikation.md`](../Kravspecifikation.md)

## Kør prototypen

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # første gang
pip install -r requirements.txt                       # første gang
python app.py
```

Åbn **http://localhost:5109** – Flask serverer både API'et (`/api/...`) og frontenden fra `../frontend`.
Er porten optaget, vælger serveren selv den næste ledige port og skriver adressen i terminalen
(fx ` * Port 5109 er optaget – bruger port 5110 i stedet`). Du kan også vælge port selv med `PORT=5200 python app.py`.
`frontend/index.html` kan også åbnes direkte fra disken. Så kalder den `http://localhost:5109/api` (attributten `data-api-port` i `index.html`).

Databasen `backend/database.db` (SQLite3) oprettes og fyldes med fiktive testdata fra `seed.sql` ved første start.
Nulstil den med `python database.py --reset`.

## Struktur

```
backend/
  app.py            logiklag: forretningsregler og endepunkter for netop dette projekt
  core.py           fælles for alle prototyper: Flask-app, JSON-fejl, CORS og generisk CRUD
  database.py       fælles for alle prototyper: SQLite3-forbindelse og hjælpefunktioner
  schema.sql        tabeller: employee, item, stock_change
  seed.sql          fiktive testdata
  requirements.txt
frontend/
  index.html        skærmbilleder: Lageroversigt · Historik · Genbestilling · Varer
  style.css         fælles stylesheet (projektfarver står i index.html)
  api.js            fælles klient: fetch() + JSON og små DOM-hjælpere
  app.js            præsentationslag for netop dette projekt
```

Klienten og serveren taler kun sammen via HTTP og JSON. Svarene vises i DOM'en, og det seneste
rå JSON-svar kan ses nederst på siden under "Seneste JSON-svar fra API'et".

Fejl returneres altid som JSON: `{"error": "…", "path": "/api/…"}` med statuskode 400, 401, 403, 404 eller 409.

## API

| Metode | Endepunkt | Beskrivelse |
| --- | --- | --- |
| `GET` | `/api/employees` | Hent liste (filtrér med ?felt=værdi) (CRUD) |
| `POST` | `/api/employees` | Opret (CRUD) |
| `DELETE` | `/api/employees/<item_id>` | Slet (CRUD) |
| `GET` | `/api/employees/<item_id>` | Hent én (CRUD) |
| `PUT` | `/api/employees/<item_id>` | Opdatér (CRUD) |
| `GET` | `/api/health` | Systemstatus |
| `GET` | `/api/history` | Lagerhistorik (før/ændring/efter) – evt. for én vare: ?item_id=1 |
| `GET` | `/api/inventory` | Søg, filtrér og sortér: ?q=urne&type=Urne&low=1&sort=quantity |
| `GET` | `/api/items` | Hent liste (filtrér med ?felt=værdi) (CRUD) |
| `POST` | `/api/items` | Opret (CRUD) |
| `DELETE` | `/api/items/<item_id>` | Slet (CRUD) |
| `GET` | `/api/items/<item_id>` | Hent én (CRUD) |
| `PUT` | `/api/items/<item_id>` | Opdatér (CRUD) |
| `POST` | `/api/items/<item_id>/adjust` | Manuel korrektion efter optælling. Kræver en begrundelse. |
| `POST` | `/api/items/<item_id>/receive` | Nye varer kommer på lager. |
| `POST` | `/api/items/<item_id>/use` | Varer tages fra lageret – evt. koblet til en sag. |
| `GET` | `/api/reorder-list` | Varer under minimumsbeholdning, grupperet pr. leverandør. |
| `GET` | `/api/stats/most-used` | Mest brugte varer: ?days=90 |
