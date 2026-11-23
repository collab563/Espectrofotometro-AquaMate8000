"""
database.py — Manejo de SQLite con CRUD completo para administración.
Incluye manejo de errores, context managers y operaciones seguras.
"""
import sqlite3
import os
import json
import hashlib
import hmac
import secrets
from contextlib import contextmanager
from typing import List, Tuple, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fiesta_app.db")


@contextmanager
def get_conn():
    """Context manager para conexiones SQLite - cierre automático."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


INITIAL_CATEGORIES = [
    ("Torterías", "red", "birthday-cake"),
    ("Dulcerías", "orange", "candy-cane"),
    ("Jugueterías", "blue", "gamepad"),
    ("Decoraciones", "purple", "balloon"),
]

INITIAL_STORES = [
    ("Tortería La Dulce Villa", "Torterías", -12.0864, -77.0358, "51999999991", "Av. Principal 123"),
    ("Pastelería El Castillo", "Torterías", -12.0890, -77.0320, "51999999992", "Calle Los Confites 456"),
    ("Crisydulce", "Torterías", -8.072218, -79.050920, "45661245", ""),
    ("Mundo Dulce & Piñatas", "Dulcerías", -12.0840, -77.0380, "51999999993", "Av. Fiestas 789"),
    ("Juguetería Mágica", "Jugueterías", -12.0875, -77.0300, "51999999994", "Calle Alegría 101"),
    ("Decoraciones Fantasía", "Decoraciones", -12.0820, -77.0340, "51999999995", "Av. Luces 202"),
    ("Dulsura Brava", "Torterías", -8.072427, -79.051330, "906201237", "Calle Fiesta 303"),
    ("Crisydulce", "Torterías", -8.073006, -79.052937, "51999999996", ""),
]

INITIAL_PRODUCTS = [
    (("Tortería La Dulce Villa", -12.0864, -77.0358), "Torta Tres Leches (15 porciones)", 45.00),
    (("Tortería La Dulce Villa", -12.0864, -77.0358), "Torta Temática Infantil", 80.00),
    (("Pastelería El Castillo", -12.0890, -77.0320), "Torta de Chocolate Fudge", 50.00),
    (("Crisydulce", -8.072218, -79.050920), "Bolsa Dulce Surtido 1kg", 15.00),
    (("Crisydulce", -8.072218, -79.050920), "Piñata Tambor Mediana", 25.00),
    (("Mundo Dulce & Piñatas", -12.0840, -77.0380), "Set Juguetes Sorpresa x10", 30.00),
    (("Juguetería Mágica", -12.0875, -77.0300), "Arco de Globos Desarmable", 60.00),
]


def _create_tables(cur):
    cur.execute('''
        CREATE TABLE IF NOT EXISTS tiendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            latitud REAL NOT NULL,
            longitud REAL NOT NULL,
            whatsapp TEXT NOT NULL,
            direccion TEXT,
            imagen_fachada TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_open INTEGER NOT NULL DEFAULT 1,
            free_delivery_enabled INTEGER NOT NULL DEFAULT 0,
            free_delivery_radius_m INTEGER NOT NULL DEFAULT 20,
            free_delivery_min_purchase REAL NOT NULL DEFAULT 0.0
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tienda_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 10,
            descripcion TEXT NOT NULL DEFAULT '',
            imagen TEXT NOT NULL DEFAULT '',
            imagenes TEXT NOT NULL DEFAULT '[]',
            FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE
        )
    ''')
    product_columns = {row[1] for row in cur.execute("PRAGMA table_info(productos)")}
    if "stock" not in product_columns:
        cur.execute("ALTER TABLE productos ADD COLUMN stock INTEGER NOT NULL DEFAULT 10")
    if "descripcion" not in product_columns:
        cur.execute("ALTER TABLE productos ADD COLUMN descripcion TEXT NOT NULL DEFAULT ''")
    if "imagen" not in product_columns:
        cur.execute("ALTER TABLE productos ADD COLUMN imagen TEXT NOT NULL DEFAULT ''")
    if "imagenes" not in product_columns:
        cur.execute("ALTER TABLE productos ADD COLUMN imagenes TEXT NOT NULL DEFAULT '[]'")
        cur.execute(
            """UPDATE productos SET imagenes = json_array(imagen)
               WHERE imagen IS NOT NULL AND imagen <> ''"""
        )
    store_columns = {row[1] for row in cur.execute("PRAGMA table_info(tiendas)")}
    if "imagen_fachada" not in store_columns:
        cur.execute("ALTER TABLE tiendas ADD COLUMN imagen_fachada TEXT NOT NULL DEFAULT ''")
    if "is_open" not in store_columns:
        cur.execute("ALTER TABLE tiendas ADD COLUMN is_open INTEGER NOT NULL DEFAULT 1")
    if "free_delivery_enabled" not in store_columns:
        cur.execute(
            "ALTER TABLE tiendas ADD COLUMN free_delivery_enabled INTEGER NOT NULL DEFAULT 0"
        )
    if "free_delivery_radius_m" not in store_columns:
        cur.execute(
            "ALTER TABLE tiendas ADD COLUMN free_delivery_radius_m INTEGER NOT NULL DEFAULT 20"
        )
    if "free_delivery_min_purchase" not in store_columns:
        cur.execute(
            "ALTER TABLE tiendas ADD COLUMN free_delivery_min_purchase REAL NOT NULL DEFAULT 0.0"
        )
    cur.execute('''
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL,
            color TEXT DEFAULT 'green',
            icono TEXT DEFAULT 'shopping-cart'
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS usuarios_tienda (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tienda_id INTEGER NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            activo INTEGER NOT NULL DEFAULT 1,
            auth_version INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tienda_id INTEGER NOT NULL,
            tracking_token TEXT NOT NULL UNIQUE,
            estado TEXT NOT NULL DEFAULT 'recibido'
                CHECK (estado IN ('recibido', 'aceptado', 'en_preparacion', 'enviado', 'cancelado')),
            productos_json TEXT NOT NULL,
            total REAL NOT NULL,
            entrega_lat REAL NOT NULL,
            entrega_lng REAL NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            cancelled_at TIMESTAMP,
            paid_at TIMESTAMP,
            payment_confirmed INTEGER NOT NULL DEFAULT 0
        )
    ''')
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_pedidos_tienda_fecha ON pedidos (tienda_id, created_at DESC)"
    )
    owner_columns = {row[1] for row in cur.execute("PRAGMA table_info(usuarios_tienda)")}
    if "auth_version" not in owner_columns:
        cur.execute("ALTER TABLE usuarios_tienda ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0")
    order_columns = {row[1] for row in cur.execute("PRAGMA table_info(pedidos)")}
    if "cancelled_at" not in order_columns:
        cur.execute("ALTER TABLE pedidos ADD COLUMN cancelled_at TIMESTAMP")
    if "paid_at" not in order_columns:
        cur.execute("ALTER TABLE pedidos ADD COLUMN paid_at TIMESTAMP")
    if "payment_confirmed" not in order_columns:
        cur.execute(
            "ALTER TABLE pedidos ADD COLUMN payment_confirmed INTEGER NOT NULL DEFAULT 0"
        )


def _ensure_categories(cur):
    cur.executemany(
        "INSERT OR IGNORE INTO categorias (nombre, color, icono) VALUES (?, ?, ?)",
        INITIAL_CATEGORIES,
    )


def _deduplicate_products(cur):
    cur.execute(
        """DELETE FROM productos
           WHERE id NOT IN (
               SELECT MIN(id)
               FROM productos
               GROUP BY tienda_id, nombre
           )"""
    )
    cur.execute(
        """CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_tienda_nombre
           ON productos (tienda_id, nombre)"""
    )


def _ensure_store(cur, store):
    name, category, lat, lng, whatsapp, address = store
    cur.execute(
        "SELECT id FROM tiendas WHERE nombre = ? AND latitud = ? AND longitud = ?",
        (name, lat, lng),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """INSERT INTO tiendas
           (nombre, categoria, latitud, longitud, whatsapp, direccion)
           VALUES (?, ?, ?, ?, ?, ?)""",
        store,
    )
    return cur.lastrowid


def _ensure_products(cur, store_key, products):
    name, lat, lng = store_key
    cur.execute(
        "SELECT id FROM tiendas WHERE nombre = ? AND latitud = ? AND longitud = ?",
        (name, lat, lng),
    )
    store = cur.fetchone()
    if not store:
        return
    for product_name, price, stock in products:
        cur.execute(
            "SELECT 1 FROM productos WHERE tienda_id = ? AND nombre = ?",
            (store[0], product_name),
        )
        if cur.fetchone() is None:
            cur.execute(
                     """INSERT INTO productos
                         (tienda_id, nombre, precio, stock, descripcion, imagen)
                         VALUES (?, ?, ?, ?, ?, ?)""",
                     (store[0], product_name, price, stock, "", ""),
            )


def init_db():
    """Inicializa las tablas y agrega datos iniciales sin duplicarlos."""
    with get_conn() as conn:
        cur = conn.cursor()
        _create_tables(cur)
        _deduplicate_products(cur)
        _ensure_categories(cur)

        for store in INITIAL_STORES:
            _ensure_store(cur, store)

        products_by_store = {}
        for store_key, product_name, price in INITIAL_PRODUCTS:
            products_by_store.setdefault(store_key, []).append((product_name, price, 10))
        products_by_store.setdefault(
            ("Dulsura Brava", -8.072427, -79.051330), []
        ).extend([
            ("Torta de Chocolate (12 porciones)", 55.00, 10),
            ("Caja de Cupcakes x12", 26.00, 10),
        ])
        for store_key, products in products_by_store.items():
            _ensure_products(cur, store_key, products)


# ============== READ ==============
def get_tiendas_por_categoria(categoria: Optional[str] = None) -> List[Tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        if categoria and categoria != "Todas":
            cur.execute(
                """SELECT id, nombre, categoria, latitud, longitud, whatsapp,
                         direccion, imagen_fachada, created_at, is_open,
                         free_delivery_enabled, free_delivery_radius_m,
                         free_delivery_min_purchase
                   FROM tiendas WHERE categoria = ? ORDER BY nombre""",
                (categoria,),
            )
        else:
            cur.execute(
                """SELECT id, nombre, categoria, latitud, longitud, whatsapp,
                         direccion, imagen_fachada, created_at, is_open,
                         free_delivery_enabled, free_delivery_radius_m,
                         free_delivery_min_purchase
                   FROM tiendas ORDER BY nombre"""
            )
        return cur.fetchall()


def get_tienda_by_id(tienda_id: int) -> Optional[Tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, nombre, categoria, latitud, longitud, whatsapp,
                       direccion, imagen_fachada, created_at, is_open,
                       free_delivery_enabled, free_delivery_radius_m,
                       free_delivery_min_purchase
               FROM tiendas WHERE id = ?""",
            (tienda_id,),
        )
        return cur.fetchone()


def get_productos_by_tienda(tienda_id: int) -> List[Tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM productos WHERE tienda_id = ? ORDER BY nombre", (tienda_id,))
        return cur.fetchall()


def get_producto_by_id(product_id: int) -> Optional[Tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM productos WHERE id = ?", (product_id,))
        return cur.fetchone()


def get_all_categorias() -> List[Tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT nombre, color, icono FROM categorias ORDER BY nombre")
        return cur.fetchall()


def get_all_tiendas() -> List[Tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, nombre, categoria, latitud, longitud, whatsapp,
                   direccion, imagen_fachada, created_at, is_open,
                   free_delivery_enabled, free_delivery_radius_m,
                   free_delivery_min_purchase
               FROM tiendas ORDER BY nombre"""
        )
        return cur.fetchall()


# ============== CREATE / UPDATE / DELETE (ADMIN) ==============
def add_tienda(nombre, categoria, lat, lng, whatsapp, direccion, imagen_fachada=""):
    with get_conn() as conn:
        cur = conn.execute(
            '''INSERT INTO tiendas
               (nombre, categoria, latitud, longitud, whatsapp, direccion, imagen_fachada)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (nombre, categoria, lat, lng, whatsapp, direccion, imagen_fachada),
        )
        return cur.lastrowid


def update_tienda(tienda_id, nombre, categoria, lat, lng, whatsapp, direccion, imagen_fachada=""):
    with get_conn() as conn:
        conn.execute(
            '''UPDATE tiendas
               SET nombre=?, categoria=?, latitud=?, longitud=?, whatsapp=?, direccion=?, imagen_fachada=?
               WHERE id=?''',
            (nombre, categoria, lat, lng, whatsapp, direccion, imagen_fachada, tienda_id),
        )


def delete_tienda(tienda_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM usuarios_tienda WHERE tienda_id = ?", (tienda_id,))
        conn.execute("DELETE FROM productos WHERE tienda_id = ?", (tienda_id,))
        conn.execute("DELETE FROM tiendas WHERE id = ?", (tienda_id,))


_PASSWORD_ITERATIONS = 310_000


def _hash_owner_password(password):
    if len(password) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres.")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PASSWORD_ITERATIONS
    )
    return f"pbkdf2_sha256${_PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def _verify_owner_password(password, encoded):
    try:
        algorithm, iterations, salt_hex, digest_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (TypeError, ValueError):
        return False


def create_store_owner(tienda_id, username, password):
    username = username.strip().casefold()
    if (
        not 3 <= len(username) <= 40
        or not username[0].isalnum()
        or any(not char.isalnum() and char not in "._-" for char in username)
    ):
        raise ValueError(
            "El usuario debe tener 3-40 caracteres: letras (también con ñ o tilde), "
            "números, punto, guion o guion bajo; sin espacios."
        )
    password_hash = _hash_owner_password(password)
    try:
        with get_conn() as conn:
            store = conn.execute("SELECT 1 FROM tiendas WHERE id = ?", (tienda_id,)).fetchone()
            if not store:
                raise ValueError("La tienda seleccionada no existe.")
            conn.execute(
                "INSERT INTO usuarios_tienda (tienda_id, username, password_hash) VALUES (?, ?, ?)",
                (tienda_id, username, password_hash),
            )
    except sqlite3.IntegrityError as exc:
        raise ValueError("La tienda ya tiene una cuenta o el nombre de usuario ya existe.") from exc


def get_store_owner_accounts():
    with get_conn() as conn:
        return conn.execute(
            """SELECT t.id, t.nombre, u.username, u.activo
               FROM usuarios_tienda u JOIN tiendas t ON t.id = u.tienda_id
               ORDER BY t.nombre"""
        ).fetchall()


def get_store_owner_by_username(username):
    username = username.strip().casefold()
    with get_conn() as conn:
        row = conn.execute(
                """SELECT id, tienda_id, username, password_hash, activo, auth_version
               FROM usuarios_tienda WHERE username = ? COLLATE NOCASE""",
            (username.strip(),),
        ).fetchone()
        return dict(row) if row else None


def authenticate_store_owner(username, password):
    owner = get_store_owner_by_username(username)
    if not owner or not owner["activo"]:
        return None
    if not _verify_owner_password(password, owner["password_hash"]):
        return None
    return {
        "id": owner["id"],
        "tienda_id": owner["tienda_id"],
        "username": owner["username"],
        "auth_version": owner["auth_version"],
    }


def set_store_owner_active(username, active):
    with get_conn() as conn:
        cur = conn.execute(
                """UPDATE usuarios_tienda
                    SET activo = ?, auth_version = auth_version + 1
                    WHERE username = ? COLLATE NOCASE""",
            (int(bool(active)), username),
        )
        return cur.rowcount == 1


def reset_store_owner_password(username, password):
    password_hash = _hash_owner_password(password)
    with get_conn() as conn:
        cur = conn.execute(
                """UPDATE usuarios_tienda
                    SET password_hash = ?, auth_version = auth_version + 1
                    WHERE username = ? COLLATE NOCASE""",
            (password_hash, username),
        )
        return cur.rowcount == 1


def change_store_owner_password(username, current_password, new_password):
    owner = get_store_owner_by_username(username)
    if not owner or not owner["activo"] or not _verify_owner_password(
        current_password, owner["password_hash"]
    ):
        return False
    password_hash = _hash_owner_password(new_password)
    with get_conn() as conn:
        cur = conn.execute(
                """UPDATE usuarios_tienda
                    SET password_hash = ?, auth_version = auth_version + 1
                    WHERE id = ? AND activo = 1""",
            (password_hash, owner["id"]),
        )
        return cur.rowcount == 1


def update_owner_store(
    tienda_id,
    nombre,
    categoria,
    lat,
    lng,
    whatsapp,
    direccion,
    free_delivery_enabled=False,
    free_delivery_radius_m=20,
    free_delivery_min_purchase=0.0,
):
    with get_conn() as conn:
        cur = conn.execute(
            """UPDATE tiendas
               SET nombre = ?, categoria = ?, latitud = ?, longitud = ?, whatsapp = ?, direccion = ?,
                   free_delivery_enabled = ?, free_delivery_radius_m = ?, free_delivery_min_purchase = ?
               WHERE id = ?""",
            (
                nombre, categoria, lat, lng, whatsapp, direccion,
                int(bool(free_delivery_enabled)),
                int(free_delivery_radius_m),
                float(free_delivery_min_purchase),
                tienda_id,
            ),
        )
        return cur.rowcount == 1


def update_owner_store_open(tienda_id, is_open):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE tiendas SET is_open = ? WHERE id = ?",
            (int(bool(is_open)), tienda_id),
        )
        return cur.rowcount == 1


def update_owner_store_image(tienda_id, image_path):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE tiendas SET imagen_fachada = ? WHERE id = ?",
            (image_path, tienda_id),
        )
        return cur.rowcount == 1


def add_owner_product(tienda_id, nombre, precio, stock=0, descripcion=""):
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO productos (tienda_id, nombre, precio, stock, descripcion)
               VALUES (?, ?, ?, ?, ?)""",
            (tienda_id, nombre, precio, stock, descripcion),
        )
        return cur.lastrowid


def update_owner_product(tienda_id, product_id, nombre, precio, stock, descripcion):
    with get_conn() as conn:
        cur = conn.execute(
            """UPDATE productos SET nombre = ?, precio = ?, stock = ?, descripcion = ?
               WHERE id = ? AND tienda_id = ?""",
            (nombre, precio, stock, descripcion, product_id, tienda_id),
        )
        return cur.rowcount == 1


def set_owner_product_images(tienda_id, product_id, images):
    with get_conn() as conn:
        cur = conn.execute(
            """UPDATE productos SET imagen = ?, imagenes = ?
               WHERE id = ? AND tienda_id = ?""",
            (images[0] if images else "", json.dumps(images), product_id, tienda_id),
        )
        return cur.rowcount == 1


def delete_owner_product(tienda_id, product_id):
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM productos WHERE id = ? AND tienda_id = ?",
            (product_id, tienda_id),
        )
        return cur.rowcount == 1


def add_producto(tienda_id, nombre, precio, stock=0, descripcion="", imagen=""):
    image_list = imagen if isinstance(imagen, list) else ([imagen] if imagen else [])
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO productos
               (tienda_id, nombre, precio, stock, descripcion, imagen, imagenes)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (tienda_id, nombre, precio, stock, descripcion,
             image_list[0] if image_list else "", json.dumps(image_list)),
        )
        return cur.lastrowid


def update_producto(prod_id, nombre, precio, stock, descripcion="", imagen=""):
    image_list = imagen if isinstance(imagen, list) else ([imagen] if imagen else [])
    with get_conn() as conn:
        conn.execute(
            """UPDATE productos
               SET nombre=?, precio=?, stock=?, descripcion=?, imagen=?, imagenes=?
               WHERE id=?""",
            (nombre, precio, stock, descripcion,
             image_list[0] if image_list else "", json.dumps(image_list), prod_id),
        )


def descontar_stock(product_id: int, cantidad: int) -> bool:
    """Descuenta unidades solo si hay stock suficiente."""
    with get_conn() as conn:
        cur = conn.execute(
            """UPDATE productos SET stock = stock - ?
               WHERE id = ? AND stock >= ?""",
            (cantidad, product_id, cantidad),
        )
        return cur.rowcount == 1


def descontar_stock_pedido(items) -> bool:
    """Descuenta todas las líneas del pedido o no descuenta ninguna."""
    with get_conn() as conn:
        for product_id, cantidad in items:
            cur = conn.execute(
                """UPDATE productos SET stock = stock - ?
                   WHERE id = ? AND stock >= ?""",
                (cantidad, product_id, cantidad),
            )
            if cur.rowcount != 1:
                raise ValueError("Uno de los productos ya no tiene stock suficiente.")
        return True


def create_order(tienda_id, tracking_token, items, total, delivery_lat, delivery_lng):
    """Reserve item stock and create the order in one SQLite transaction."""
    with get_conn() as conn:
        for item in items:
            cur = conn.execute(
                """UPDATE productos SET stock = stock - ?
                   WHERE id = ? AND stock >= ?""",
                (item["cantidad"], item["product_id"], item["cantidad"]),
            )
            if cur.rowcount != 1:
                raise ValueError("Uno de los productos ya no tiene stock suficiente.")
        cur = conn.execute(
            """INSERT INTO pedidos
               (tienda_id, tracking_token, productos_json, total, entrega_lat, entrega_lng)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                tienda_id,
                tracking_token,
                json.dumps(items, ensure_ascii=False),
                float(total),
                float(delivery_lat),
                float(delivery_lng),
            ),
        )
        return cur.lastrowid


def _order_dict(row):
    order = dict(row)
    order["payment_confirmed"] = bool(order.get("payment_confirmed", 0))
    try:
        order["productos"] = json.loads(order.pop("productos_json"))
    except (TypeError, json.JSONDecodeError):
        order["productos"] = []
    return order


def get_orders_for_store(tienda_id, estado=None):
    with get_conn() as conn:
        if estado:
            rows = conn.execute(
                """SELECT id, tienda_id, tracking_token, estado, productos_json, total,
                          entrega_lat, entrega_lng, created_at, updated_at, cancelled_at,
                          paid_at, payment_confirmed
                   FROM pedidos WHERE tienda_id = ? AND estado = ?
                   ORDER BY created_at DESC, id DESC""",
                (tienda_id, estado),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, tienda_id, tracking_token, estado, productos_json, total,
                          entrega_lat, entrega_lng, created_at, updated_at, cancelled_at,
                          paid_at, payment_confirmed
                   FROM pedidos WHERE tienda_id = ?
                   ORDER BY created_at DESC, id DESC""",
                (tienda_id,),
            ).fetchall()
    return [_order_dict(row) for row in rows]


def get_order_for_store(order_id, tienda_id):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT id, tienda_id, tracking_token, estado, productos_json, total,
                      entrega_lat, entrega_lng, created_at, updated_at, cancelled_at,
                      paid_at, payment_confirmed
               FROM pedidos WHERE id = ? AND tienda_id = ?""",
            (order_id, tienda_id),
        ).fetchone()
    return _order_dict(row) if row else None


def get_order_by_tracking_token(tracking_token):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT p.id, p.estado, p.created_at, p.updated_at, t.nombre AS tienda
               FROM pedidos p LEFT JOIN tiendas t ON t.id = p.tienda_id
               WHERE p.tracking_token = ?""",
            (tracking_token,),
        ).fetchone()
    return dict(row) if row else None


_ORDER_STATUS_TRANSITIONS = {
    "recibido": {"aceptado", "cancelado"},
    "aceptado": {"en_preparacion", "cancelado"},
    "en_preparacion": {"enviado", "cancelado"},
    "enviado": {"recibido", "cancelado"},
    "cancelado": {"recibido"},
}


def update_order_status(tienda_id, order_id, next_status):
    if next_status not in _ORDER_STATUS_TRANSITIONS:
        return False
    with get_conn() as conn:
        row = conn.execute(
            "SELECT estado, productos_json FROM pedidos WHERE id = ? AND tienda_id = ?",
            (order_id, tienda_id),
        ).fetchone()
        if not row or next_status not in _ORDER_STATUS_TRANSITIONS[row["estado"]]:
            return False
        if row["estado"] == "cancelado" and next_status == "recibido":
            for item in json.loads(row["productos_json"]):
                cur = conn.execute(
                    """UPDATE productos SET stock = stock - ?
                       WHERE id = ? AND stock >= ?""",
                    (item["cantidad"], item["product_id"], item["cantidad"]),
                )
                if cur.rowcount != 1:
                    raise ValueError(
                        "No hay suficiente stock para reabrir este pedido."
                    )
        cur = conn.execute(
            """UPDATE pedidos
               SET estado = ?,
                   updated_at = CURRENT_TIMESTAMP,
                   cancelled_at = CASE
                       WHEN ? = 'cancelado' THEN CURRENT_TIMESTAMP
                       WHEN estado = 'cancelado' THEN NULL
                       ELSE cancelled_at
                   END
               WHERE id = ? AND tienda_id = ? AND estado = ?""",
            (next_status, next_status, order_id, tienda_id, row["estado"]),
        )
        if cur.rowcount == 1 and next_status == "cancelado":
            for item in json.loads(row["productos_json"]):
                conn.execute(
                    "UPDATE productos SET stock = stock + ? WHERE id = ?",
                    (item["cantidad"], item["product_id"]),
                )
        return cur.rowcount == 1


def set_order_payment_confirmation(tienda_id, order_id, paid):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT estado, productos_json FROM pedidos WHERE id = ? AND tienda_id = ?",
            (order_id, tienda_id),
        ).fetchone()
        if not row:
            return False

        if paid and row["estado"] != "cancelado":
            if "cancelado" not in _ORDER_STATUS_TRANSITIONS[row["estado"]]:
                return False
            cur = conn.execute(
                """UPDATE pedidos
                   SET estado = 'cancelado',
                       updated_at = CURRENT_TIMESTAMP,
                       cancelled_at = CURRENT_TIMESTAMP,
                       payment_confirmed = 1,
                       paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
                   WHERE id = ? AND tienda_id = ? AND estado = ?""",
                (order_id, tienda_id, row["estado"]),
            )
            if cur.rowcount != 1:
                return False
            for item in json.loads(row["productos_json"]):
                conn.execute(
                    "UPDATE productos SET stock = stock + ? WHERE id = ?",
                    (item["cantidad"], item["product_id"]),
                )
            return True

        cur = conn.execute(
            """UPDATE pedidos
               SET payment_confirmed = ?,
                   paid_at = CASE WHEN ? THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE NULL END
               WHERE id = ? AND tienda_id = ?""",
            (int(bool(paid)), int(bool(paid)), order_id, tienda_id),
        )
        return cur.rowcount == 1


def delete_producto(prod_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM productos WHERE id = ?", (prod_id,))


def add_categoria(nombre, color="green", icono="shopping-cart"):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO categorias (nombre, color, icono) VALUES (?, ?, ?)",
            (nombre, color, icono),
        )


def delete_categoria(nombre):
    with get_conn() as conn:
        # Solo eliminar si no hay tiendas usándola
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM tiendas WHERE categoria = ?", (nombre,))
        if cur.fetchone()[0] > 0:
            raise ValueError(f"No se puede eliminar '{nombre}': tiene tiendas asociadas")
        conn.execute("DELETE FROM categorias WHERE nombre = ?", (nombre,))
