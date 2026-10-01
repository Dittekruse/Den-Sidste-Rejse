"""Fælles Flask-kode, ens i alle prototyper.

- create_app():     opretter Flask-appen, serverer ../frontend og sætter CORS
- run():            starter serveren på en ledig port
- ApiError:         forretningsfejl, der sendes til klienten som JSON
- register_crud():  standard CRUD-endepunkter for én tabel
"""
import os
import socket
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory

from database import close_db, execute, query_all, query_one

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def now():
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def create_app(name, title):
    app = Flask(name, static_folder=None)
    app.json.ensure_ascii = False
    app.json.sort_keys = False
    app.teardown_appcontext(close_db)

    @app.after_request
    def add_cors_headers(response):
        # Tillader at index.html åbnes direkte fra disken eller fra en anden port
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-User-Id"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    @app.errorhandler(ApiError)
    def handle_api_error(err):
        return jsonify(error=err.message, path=request.path), err.status

    @app.errorhandler(sqlite3.IntegrityError)
    def handle_integrity_error(err):
        return jsonify(error=f"Konflikt med eksisterende data: {err}", path=request.path), 409

    @app.errorhandler(404)
    def handle_not_found(_err):
        return jsonify(error="Endepunktet findes ikke", path=request.path), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(_err):
        return jsonify(error=f"Metoden {request.method} er ikke tilladt her", path=request.path), 405

    @app.errorhandler(500)
    def handle_server_error(_err):
        return jsonify(error="Uventet serverfejl", path=request.path), 500

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", app=title, time=now())

    @app.get("/")
    def frontend_index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/<path:filename>")
    def frontend_files(filename):
        return send_from_directory(FRONTEND_DIR, filename)

    return app


def port_in_use(port):
    """Porten er optaget, hvis noget allerede svarer på den (IPv4 eller IPv6), eller den ikke kan bindes."""
    for family, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.settimeout(0.2)
                if s.connect_ex((host, port)) == 0:
                    return True
        except OSError:
            pass
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
        except OSError:
            return True
    return False


def run(app, port):
    """Starter udviklingsserveren. Er porten optaget, bruges den næste ledige port."""
    if not os.environ.get("WERKZEUG_RUN_MAIN"):   # kun første gang – ikke når Flask genstarter ved kodeændringer
        wanted = port
        while port_in_use(port):
            port += 1
            if port > wanted + 100:
                raise SystemExit(f"Ingen ledig port fundet mellem {wanted} og {port}")
        if port != wanted:
            print(f" * Port {wanted} er optaget – bruger port {port} i stedet")
        print(f" * Åbn http://localhost:{port}")
        os.environ["PORT"] = str(port)   # genstarten læser porten herfra, så den ikke skifter
    app.run(port=int(os.environ.get("PORT", port)), debug=True)


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Request-body skal være et JSON-objekt")
    return data


def require(data, *fields):
    missing = [f for f in fields if data.get(f) in (None, "")]
    if missing:
        raise ApiError("Mangler felt(er): " + ", ".join(missing))


def get_or_404(table, item_id, label=None):
    row = query_one(f"SELECT * FROM {table} WHERE id = ?", (item_id,))
    if row is None:
        raise ApiError(f"{label or table} med id {item_id} findes ikke", 404)
    return row


def register_crud(app, name, table, fields, required=(), defaults=None,
                  update_fields=None, read_only=False, order_by="id", validate=None):
    """Opretter REST-endepunkter for én tabel:

        GET    /api/<name>          liste (filtrér med ?felt=værdi)
        GET    /api/<name>/<id>     én række
        POST   /api/<name>          opret          (ikke hvis read_only)
        PUT    /api/<name>/<id>     opdatér        (ikke hvis read_only)
        DELETE /api/<name>/<id>     slet           (ikke hvis read_only)

    defaults må gerne være funktioner, fx {"created_at": now}.
    validate(data, existing) kan kaste ApiError for at håndhæve forretningsregler.
    """
    update_fields = update_fields or fields

    def list_items():
        filters = {k: v for k, v in request.args.items() if k in fields}
        where = " AND ".join(f"{k} = ?" for k in filters)
        sql = f"SELECT * FROM {table}" + (f" WHERE {where}" if where else "") + f" ORDER BY {order_by}"
        return jsonify(query_all(sql, tuple(filters.values())))

    def get_item(item_id):
        return jsonify(get_or_404(table, item_id))

    def create_item():
        defaults_now = {k: v() if callable(v) else v for k, v in (defaults or {}).items()}
        data = {**defaults_now, **{k: v for k, v in json_body().items() if k in fields}}
        require(data, *required)
        if validate:
            validate(data, None)
        columns = ", ".join(data)
        marks = ", ".join("?" for _ in data)
        new_id = execute(f"INSERT INTO {table} ({columns}) VALUES ({marks})", tuple(data.values()))
        return jsonify(get_or_404(table, new_id)), 201

    def update_item(item_id):
        existing = get_or_404(table, item_id)
        data = {k: v for k, v in json_body().items() if k in update_fields}
        if not data:
            raise ApiError("Ingen felter at opdatere. Tilladte felter: " + ", ".join(update_fields))
        if validate:
            validate({**existing, **data}, existing)
        assignments = ", ".join(f"{k} = ?" for k in data)
        execute(f"UPDATE {table} SET {assignments} WHERE id = ?", (*data.values(), item_id))
        return jsonify(get_or_404(table, item_id))

    def delete_item(item_id):
        get_or_404(table, item_id)
        execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
        return "", 204

    app.add_url_rule(f"/api/{name}", f"{name}_list", list_items, methods=["GET"])
    app.add_url_rule(f"/api/{name}/<int:item_id>", f"{name}_get", get_item, methods=["GET"])
    if not read_only:
        app.add_url_rule(f"/api/{name}", f"{name}_create", create_item, methods=["POST"])
        app.add_url_rule(f"/api/{name}/<int:item_id>", f"{name}_update", update_item, methods=["PUT"])
        app.add_url_rule(f"/api/{name}/<int:item_id>", f"{name}_delete", delete_item, methods=["DELETE"])
