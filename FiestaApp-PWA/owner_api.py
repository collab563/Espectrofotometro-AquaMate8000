"""Central API and secure owner portal for FiestaApp."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import database
import routing


BASE_DIR = Path(__file__).resolve().parent
PORTAL_FILE = BASE_DIR / "owner_portal.html"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_IMAGE_BYTES = 8 * 1024 * 1024
SESSION_COOKIE = "fiesta_owner_session"
SESSION_SECONDS = 8 * 60 * 60
SESSION_SECRET = os.environ.get("FIESTA_SESSION_SECRET")
if not SESSION_SECRET:
    SESSION_SECRET = secrets.token_urlsafe(48)
    print("FIESTA_SESSION_SECRET is unset; owner sessions will expire when the server restarts.")


@asynccontextmanager
async def lifespan(_app):
    database.init_db()
    yield


app = FastAPI(title="FiestaApp Owner Portal", lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class LoginInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class StoreInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    categoria: str = Field(min_length=1, max_length=60)
    latitud: float = Field(ge=-90, le=90)
    longitud: float = Field(ge=-180, le=180)
    whatsapp: str = Field(min_length=5, max_length=30)
    direccion: str = Field(default="", max_length=240)
    free_delivery_enabled: bool = False
    free_delivery_radius_m: int = Field(default=20, ge=20, le=50, multiple_of=5)
    free_delivery_min_purchase: float = Field(default=0.0, ge=0, le=999999)


class StoreStatusInput(BaseModel):
    is_open: bool


class OrderStatusInput(BaseModel):
    estado: Literal["recibido", "aceptado", "cancelado", "en_preparacion", "enviado"]


class OrderPaymentConfirmationInput(BaseModel):
    paid: bool


class ProductInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    precio: float = Field(ge=0, le=999999)
    stock: int = Field(ge=0, le=999999)
    descripcion: str = Field(default="", max_length=2000)


def _encode_session(owner):
    payload = json.dumps(
        {
            "username": owner["username"],
            "store_id": owner["tienda_id"],
            "auth_version": owner["auth_version"],
            "exp": int(time.time()) + SESSION_SECONDS,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    body = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signature = hmac.new(SESSION_SECRET.encode("utf-8"), body, hashlib.sha256).digest()
    return body.decode("ascii") + "." + base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")


def _decode_session(token):
    try:
        body_text, signature_text = token.split(".", 1)
        body = body_text.encode("ascii")
        signature = base64.urlsafe_b64decode(signature_text + "=" * (-len(signature_text) % 4))
        expected = hmac.new(SESSION_SECRET.encode("utf-8"), body, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = base64.urlsafe_b64decode(body_text + "=" * (-len(body_text) % 4))
        session = json.loads(payload)
        if int(session["exp"]) < int(time.time()):
            return None
        owner = database.get_store_owner_by_username(session["username"])
        if (
            not owner
            or not owner["activo"]
            or owner["tienda_id"] != int(session["store_id"])
            or owner["auth_version"] != int(session["auth_version"])
        ):
            return None
        return owner
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def current_owner(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    owner = _decode_session(token) if token else None
    if not owner:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    return owner


def _image_url(path):
    if not path:
        return None
    try:
        resolved = Path(path).resolve()
        relative = resolved.relative_to(UPLOAD_DIR.resolve())
    except (OSError, ValueError):
        return None
    return "/uploads/" + quote(relative.as_posix())


def _decode_images(product):
    try:
        images = json.loads(product[7] or "[]")
    except (TypeError, json.JSONDecodeError):
        images = []
    if not images and product[6]:
        images = [product[6]]
    return [url for url in (_image_url(path) for path in images) if url]


def _serialize_product(product):
    return {
        "id": product[0],
        "nombre": product[2],
        "precio": product[3],
        "stock": product[4],
        "descripcion": product[5] or "",
        "imagenes": _decode_images(product),
    }


def _serialize_store(store):
    if not store:
        raise HTTPException(status_code=404, detail="No se encontró la tienda de esta cuenta.")
    return {
        "id": store[0],
        "nombre": store[1],
        "categoria": store[2],
        "latitud": store[3],
        "longitud": store[4],
        "whatsapp": store[5] or "",
        "direccion": store[6] or "",
        "imagen": _image_url(store[7]),
        "abierta": bool(store[9]),
        "envio_gratis_habilitado": bool(store[10]),
        "radio_envio_gratis_m": int(store[11]),
        "minimo_compra_envio_gratis": float(store[12]) if len(store) > 12 else 0.0,
    }


def _serialize_public_store(store):
    public_store = _serialize_store(store)
    public_store.pop("whatsapp", None)
    return public_store


def _image_extension(filename):
    extension = Path(filename).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Usa una imagen JPG, PNG o WEBP.")
    return extension


def _valid_image(data, extension):
    if extension in {".jpg", ".jpeg"}:
        return data.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"


async def _save_image(request: Request, filename: str):
    extension = _image_extension(filename)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Cada imagen debe pesar como máximo 8 MB.")
    if not _valid_image(data, extension):
        raise HTTPException(status_code=400, detail="El archivo no parece ser una imagen válida.")
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}{extension}"
    path.write_bytes(data)
    return str(path.resolve())


def _delete_uploaded_image(path):
    try:
        resolved = Path(path).resolve()
        resolved.relative_to(UPLOAD_DIR.resolve())
        resolved.unlink(missing_ok=True)
    except (OSError, ValueError):
        pass


def _get_owner_product(owner, product_id):
    product = database.get_producto_by_id(product_id)
    if not product or product[1] != owner["tienda_id"]:
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    return product


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/session")
def session_status(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    return {"authenticated": bool(_decode_session(token)) if token else False}


@app.get("/")
def portal():
    return FileResponse(PORTAL_FILE, headers={"Cache-Control": "no-store"})


@app.post("/api/login")
def login(payload: LoginInput, response: Response):
    owner = database.authenticate_store_owner(payload.username, payload.password)
    if not owner:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    response.set_cookie(
        SESSION_COOKIE,
        _encode_session(owner),
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=os.environ.get("FIESTA_COOKIE_SECURE", "0") == "1",
        samesite="strict",
        path="/",
    )
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="strict")
    return {"ok": True}


@app.post("/api/password")
def change_password(payload: ChangePasswordInput, owner=Depends(current_owner)):
    try:
        changed = database.change_store_owner_password(
            owner["username"], payload.current_password, payload.new_password
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not changed:
        raise HTTPException(status_code=400, detail="La contraseña actual no coincide.")
    return {"ok": True}


@app.get("/api/me")
def owner_dashboard(owner=Depends(current_owner)):
    store_id = owner["tienda_id"]
    return {
        "usuario": owner["username"],
        "tienda": _serialize_store(database.get_tienda_by_id(store_id)),
        "categorias": [category[0] for category in database.get_all_categorias()],
        "productos": [
            _serialize_product(product)
            for product in database.get_productos_by_tienda(store_id)
        ],
    }


@app.put("/api/store")
def update_store(payload: StoreInput, owner=Depends(current_owner)):
    name = payload.nombre.strip()
    whatsapp = payload.whatsapp.strip()
    if not name or not whatsapp:
        raise HTTPException(status_code=422, detail="Nombre y WhatsApp son obligatorios.")
    categories = {category[0] for category in database.get_all_categorias()}
    if payload.categoria not in categories:
        raise HTTPException(status_code=422, detail="Selecciona una categoría válida.")
    database.update_owner_store(
        owner["tienda_id"], name, payload.categoria, payload.latitud,
        payload.longitud, whatsapp, payload.direccion.strip(),
        payload.free_delivery_enabled, payload.free_delivery_radius_m,
        payload.free_delivery_min_purchase,
    )
    return {"tienda": _serialize_store(database.get_tienda_by_id(owner["tienda_id"]))}


@app.patch("/api/store/status")
def update_store_status(payload: StoreStatusInput, owner=Depends(current_owner)):
    if not database.update_owner_store_open(owner["tienda_id"], payload.is_open):
        raise HTTPException(status_code=404, detail="No se encontró tu tienda.")
    return {"abierta": payload.is_open}


@app.get("/api/orders")
def owner_orders(estado: str | None = None, owner=Depends(current_owner)):
    if estado is not None and estado not in ORDER_STATUS_LABELS:
        raise HTTPException(status_code=422, detail="El filtro de estado no es válido.")
    orders = database.get_orders_for_store(owner["tienda_id"], estado)
    return {
        "pedidos": [
            {
                "id": order["id"],
                "estado": order["estado"],
                "estado_label": ORDER_STATUS_LABELS[order["estado"]],
                "productos": order["productos"],
                "total": order["total"],
                "paid_at": order["paid_at"],
                "payment_confirmed": order["payment_confirmed"],
                "entrega_lat": order["entrega_lat"],
                "entrega_lng": order["entrega_lng"],
                "created_at": order["created_at"],
                "updated_at": order["updated_at"],
            }
            for order in orders
        ]
    }


@app.patch("/api/orders/{order_id}/status")
def owner_update_order_status(
    order_id: int,
    payload: OrderStatusInput,
    owner=Depends(current_owner),
):
    try:
        updated = database.update_order_status(
            owner["tienda_id"], order_id, payload.estado
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(
            status_code=409,
            detail="No se encontró el pedido o ya no permite cambiar su estado.",
        )
    return {
        "id": order_id,
        "estado": payload.estado,
        "estado_label": ORDER_STATUS_LABELS[payload.estado],
    }


@app.patch("/api/orders/{order_id}/payment-confirmation")
def owner_confirm_order_payment(
    order_id: int,
    payload: OrderPaymentConfirmationInput,
    owner=Depends(current_owner),
):
    if not database.set_order_payment_confirmation(
        owner["tienda_id"], order_id, payload.paid
    ):
        raise HTTPException(
            status_code=404,
            detail="No se encontró el pedido de tu tienda.",
        )
    order = database.get_order_for_store(order_id, owner["tienda_id"])
    return {
        "id": order_id,
        "payment_confirmed": payload.paid,
        "paid_at": order["paid_at"],
        "estado": order["estado"],
        "estado_label": ORDER_STATUS_LABELS[order["estado"]],
    }


@app.post("/api/store/image")
async def upload_store_image(request: Request, filename: str, owner=Depends(current_owner)):
    path = await _save_image(request, filename)
    database.update_owner_store_image(owner["tienda_id"], path)
    return {"imagen": _image_url(path)}


@app.post("/api/products", status_code=201)
def create_product(payload: ProductInput, owner=Depends(current_owner)):
    name = payload.nombre.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del producto es obligatorio.")
    try:
        product_id = database.add_owner_product(
            owner["tienda_id"], name, payload.precio, payload.stock, payload.descripcion.strip()
        )
    except Exception as exc:
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre.") from exc
        raise
    return {"id": product_id}


@app.put("/api/products/{product_id}")
def update_product(product_id: int, payload: ProductInput, owner=Depends(current_owner)):
    name = payload.nombre.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del producto es obligatorio.")
    if not database.update_owner_product(
        owner["tienda_id"], product_id, name, payload.precio,
        payload.stock, payload.descripcion.strip(),
    ):
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    return {"ok": True}


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, owner=Depends(current_owner)):
    product = _get_owner_product(owner, product_id)
    images = _decode_images(product)
    if not database.delete_owner_product(owner["tienda_id"], product_id):
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    for image in images:
        _delete_uploaded_image(UPLOAD_DIR / Path(image).name)
    return {"ok": True}


@app.post("/api/products/{product_id}/images", status_code=201)
async def upload_product_image(
    product_id: int,
    request: Request,
    filename: str,
    owner=Depends(current_owner),
):
    product = _get_owner_product(owner, product_id)
    try:
        images = json.loads(product[7] or "[]")
    except (TypeError, json.JSONDecodeError):
        images = []
    if not images and product[6]:
        images = [product[6]]
    if len(images) >= 8:
        raise HTTPException(status_code=400, detail="Cada producto puede tener hasta 8 fotos.")
    images.append(await _save_image(request, filename))
    database.set_owner_product_images(owner["tienda_id"], product_id, images)
    updated = database.get_producto_by_id(product_id)
    return {"imagenes": _decode_images(updated)}


@app.delete("/api/products/{product_id}/images/{image_index}")
def delete_product_image(product_id: int, image_index: int, owner=Depends(current_owner)):
    product = _get_owner_product(owner, product_id)
    try:
        images = json.loads(product[7] or "[]")
    except (TypeError, json.JSONDecodeError):
        images = []
    if not images and product[6]:
        images = [product[6]]
    if image_index < 0 or image_index >= len(images):
        raise HTTPException(status_code=404, detail="No se encontró esa foto.")
    removed = images.pop(image_index)
    database.set_owner_product_images(owner["tienda_id"], product_id, images)
    _delete_uploaded_image(removed)
    return {"imagenes": [_image_url(path) for path in images if _image_url(path)]}
# ===================== MOBILE PWA AND PUBLIC API =====================
import math
import urllib.error
import urllib.parse
import urllib.request

import config as app_config

MOBILE_ASSET_DIR = BASE_DIR / "mobile_assets"
PWA_FILE = MOBILE_ASSET_DIR / "mobile_app.html"
MANIFEST_FILE = MOBILE_ASSET_DIR / "manifest.webmanifest"
SERVICE_WORKER_FILE = MOBILE_ASSET_DIR / "service-worker.js"
ADMIN_SESSION_COOKIE = "fiesta_admin_session"
PHOTON_API_URL = os.environ.get("FIESTA_GEOCODER_URL", "https://photon.komoot.io/api/")
ADMIN_COLORS = {"red", "blue", "green", "orange", "purple", "darkred", "cadetblue"}
_ADMIN_ICON_NAMES = {"birthday-cake", "candy-cane", "gamepad", "balloon", "shopping-cart"}


class AdminLoginInput(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class AdminStoreInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    categoria: str = Field(min_length=1, max_length=60)
    latitud: float = Field(ge=-90, le=90)
    longitud: float = Field(ge=-180, le=180)
    whatsapp: str = Field(min_length=5, max_length=30)
    direccion: str = Field(default="", max_length=240)


class AdminProductInput(BaseModel):
    tienda_id: int = Field(ge=1)
    nombre: str = Field(min_length=1, max_length=100)
    precio: float = Field(ge=0, le=999999)
    stock: int = Field(ge=0, le=999999)
    descripcion: str = Field(default="", max_length=2000)


class AdminCategoryInput(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    color: str = "green"
    icono: str = "shopping-cart"


class AdminOwnerInput(BaseModel):
    tienda_id: int = Field(ge=1)
    username: str = Field(min_length=3, max_length=40)


class OwnerNameInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)


class CheckoutItem(BaseModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(ge=1, le=999)


class CheckoutInput(BaseModel):
    items: list[CheckoutItem] = Field(min_length=1, max_length=100)
    user_lat: float | None = Field(default=None, ge=-90, le=90)
    user_lng: float | None = Field(default=None, ge=-180, le=180)


ORDER_STATUS_LABELS = {
    "recibido": "Recibido",
    "aceptado": "Aceptado",
    "en_preparacion": "En preparación",
    "enviado": "Enviado",
    "cancelado": "Cancelado",
}


def _encode_admin_session():
    payload = json.dumps(
        {"role": "admin", "exp": int(time.time()) + SESSION_SECONDS, "auth": hashlib.sha256(_admin_password().encode("utf-8")).hexdigest()},
        separators=(",", ":"),
    ).encode("utf-8")
    body = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signature = hmac.new(SESSION_SECRET.encode("utf-8"), body, hashlib.sha256).digest()
    return body.decode("ascii") + "." + base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")


def _decode_admin_session(token):
    try:
        body_text, signature_text = token.split(".", 1)
        body = body_text.encode("ascii")
        signature = base64.urlsafe_b64decode(signature_text + "=" * (-len(signature_text) % 4))
        expected = hmac.new(SESSION_SECRET.encode("utf-8"), body, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            return False
        payload = json.loads(base64.urlsafe_b64decode(body_text + "=" * (-len(body_text) % 4)))
        auth_hash = hashlib.sha256(_admin_password().encode("utf-8")).hexdigest()
        return payload.get("role") == "admin" and int(payload.get("exp", 0)) >= int(time.time()) and hmac.compare_digest(str(payload.get("auth", "")), auth_hash)
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        return False


def current_admin(request: Request):
    token = request.cookies.get(ADMIN_SESSION_COOKIE)
    if not token or not _decode_admin_session(token):
        raise HTTPException(status_code=401, detail="Inicia sesión como administrador.")
    return True


def _admin_password():
    configured = os.environ.get("FIESTA_ADMIN_PASSWORD")
    if configured:
        return configured
    return str(app_config.load_config().get("admin_password", ""))


def _admin_cookie(response: Response):
    response.set_cookie(
        ADMIN_SESSION_COOKIE,
        _encode_admin_session(),
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=os.environ.get("FIESTA_COOKIE_SECURE", "0") == "1",
        samesite="strict",
        path="/",
    )


def _product_image_paths(product):
    try:
        images = json.loads(product[7] or "[]")
    except (TypeError, json.JSONDecodeError):
        images = []
    if not images and product[6]:
        images = [product[6]]
    return [path for path in images if isinstance(path, str) and path]


def _category_payload(category):
    return {"nombre": category[0], "color": category[1], "icono": category[2]}


def _distance_km_between(lat1, lon1, lat2, lon2):
    lat1 = float(lat1)
    lon1 = float(lon1)
    lat2 = float(lat2)
    lon2 = float(lon2)
    radius_km = 6371.0
    d_lat = (lat2 - lat1) * (3.141592653589793 / 180.0)
    d_lon = (lon2 - lon1) * (3.141592653589793 / 180.0)
    a = (
        (math.sin(d_lat / 2) ** 2)
        + math.cos(lat1 * (3.141592653589793 / 180.0))
        * math.cos(lat2 * (3.141592653589793 / 180.0))
        * (math.sin(d_lon / 2) ** 2)
    )
    return 2 * radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_free_delivery_status(store, total_amount: float, user_lat=None, user_lng=None):
    if not store:
        return False, "No hay tienda disponible para calcular el envío."
    if isinstance(store, dict):
        enabled = bool(store.get("envio_gratis_habilitado"))
        radius_m = float(store.get("radio_envio_gratis_m") or 0)
        min_purchase = float(store.get("minimo_compra_envio_gratis") or 0)
        store_lat = store.get("latitud")
        store_lng = store.get("longitud")
    else:
        enabled = bool(store[10]) if len(store) > 10 else False
        radius_m = float(store[11]) if len(store) > 11 else 0.0
        min_purchase = float(store[12]) if len(store) > 12 else 0.0
        store_lat = store[3] if len(store) > 3 else None
        store_lng = store[4] if len(store) > 4 else None

    if not enabled:
        return False, "La tienda no tiene envío gratis activado."
    if user_lat is None or user_lng is None:
        return False, "Necesitamos tu ubicación para calcular el envío gratis."
    try:
        distance_km = _distance_km_between(float(user_lat), float(user_lng), float(store_lat), float(store_lng))
    except (TypeError, ValueError):
        return False, "La ubicación de la tienda o del cliente no es válida."

    distance_m = distance_km * 1000.0
    if distance_m > radius_m:
        return False, f"Tu ubicación está fuera del radio gratis de {radius_m:.0f} m."
    if float(total_amount) < min_purchase:
        return False, f"Falta $ {max(min_purchase - float(total_amount), 0.0):.2f} para llegar al mínimo de envío gratis."
    return True, "Envío gratis aplicado por distancia y mínimo de compra."


@app.get("/app")
def mobile_app():
    return FileResponse(PWA_FILE, headers={"Cache-Control": "no-store"})


@app.get("/admin")
def mobile_admin_app():
    return FileResponse(PWA_FILE, headers={"Cache-Control": "no-store"})


@app.get("/manifest.webmanifest")
def mobile_manifest():
    return FileResponse(MANIFEST_FILE, media_type="application/manifest+json", headers={"Cache-Control": "no-cache"})


@app.get("/service-worker.js")
def mobile_service_worker():
    return FileResponse(
        SERVICE_WORKER_FILE,
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"},
    )


@app.get("/api/public/data")
def public_data():
    cfg = app_config.load_config()
    return {
        "titulo": cfg.get("app_title", "Directorio de Fiestas y Eventos"),
        "center": {
            "lat": float(cfg.get("map_center_lat", -12.0864)),
            "lng": float(cfg.get("map_center_lng", -77.0358)),
            "zoom": int(cfg.get("map_zoom", 14)),
        },
        "radius_km": float(cfg.get("radius_km", 10.0)),
        "radius_filter_enabled": bool(cfg.get("radius_filter_enabled", True)),
        "categorias": [_category_payload(item) for item in database.get_all_categorias()],
        "tiendas": [_serialize_public_store(item) for item in database.get_all_tiendas()],
    }


@app.get("/api/public/stores/{store_id}")
def public_store_products(store_id: int):
    store = database.get_tienda_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="No se encontró esa tienda.")
    return {
        "tienda": _serialize_public_store(store),
        "productos": [_serialize_product(item) for item in database.get_productos_by_tienda(store_id)],
    }


@app.get("/api/geocode")
def geocode_address(q: str):
    query = q.strip()
    if len(query) < 2 or len(query) > 120:
        raise HTTPException(status_code=422, detail="Escribe una dirección de 2 a 120 caracteres.")
    params = urllib.parse.urlencode({"q": query, "limit": 10, "countrycode": "PE"})
    request = urllib.request.Request(
        PHOTON_API_URL + "?" + params,
        headers={"User-Agent": "FiestaApp/1.0 (mobile address search)", "Accept-Language": "es"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.load(response)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="No se pudo consultar el buscador de direcciones.") from exc

    results = []
    for feature in payload.get("features", []):
        try:
            properties = feature["properties"]
            longitude, latitude = map(float, feature["geometry"]["coordinates"])
            if str(properties.get("countrycode", "")).upper() != "PE":
                continue
        except (KeyError, TypeError, ValueError, AttributeError):
            continue
        parts = [
            properties.get("name"), properties.get("housenumber"), properties.get("street"),
            properties.get("district"), properties.get("city"), properties.get("county"),
            properties.get("state"), properties.get("country"),
        ]
        label_parts = []
        for part in parts:
            text = str(part).strip() if part else ""
            if text and text not in label_parts:
                label_parts.append(text)
        if not label_parts or not (math.isfinite(latitude) and math.isfinite(longitude)):
            continue
        accuracy = None
        extent = properties.get("extent")
        if isinstance(extent, (list, tuple)) and len(extent) == 4:
            try:
                min_lon, max_lat, max_lon, min_lat = map(float, extent)
                width = abs(max_lon - min_lon) * 111320 * abs(math.cos(math.radians(latitude)))
                height = abs(max_lat - min_lat) * 110574
                accuracy = math.hypot(width, height) / 2
            except (TypeError, ValueError):
                pass
        results.append({"label": ", ".join(label_parts), "lat": latitude, "lng": longitude, "accuracy_m": accuracy})
    return {"results": results}


@app.post("/api/public/orders/prepare")
def prepare_public_order(payload: CheckoutInput):
    if payload.user_lat is None or payload.user_lng is None:
        raise HTTPException(
            status_code=422,
            detail="Selecciona la ubicación de entrega antes de confirmar el pedido.",
        )
    quantities = {}
    products = []
    total = 0.0
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
        product = database.get_producto_by_id(item.product_id)
        if not product:
            raise HTTPException(status_code=409, detail="Uno de los productos ya no está disponible.")
        products.append((product, item.quantity))
        total += float(product[3]) * item.quantity
    for product_id, quantity in quantities.items():
        product = database.get_producto_by_id(product_id)
        if not product or int(product[4]) < quantity:
            raise HTTPException(status_code=409, detail="El stock cambió. Revisa el carrito antes de continuar.")
    first_product = products[0][0]
    store = database.get_tienda_by_id(first_product[1])
    if not store:
        raise HTTPException(status_code=409, detail="La tienda ya no está disponible.")
    shipping_free, shipping_message = calculate_free_delivery_status(
        store,
        total,
        payload.user_lat,
        payload.user_lng,
    )
    lines = [
        "¡Hola " + str(store[1]) + "!",
        "",
        "Quisiera hacer el siguiente pedido desde la AppFiesta:",
        "",
    ]
    if payload.user_lat is not None and payload.user_lng is not None:
        lines.extend([
            "Ubicación de entrega: "
            + routing.openstreetmap_location_url(payload.user_lat, payload.user_lng),
            "📋 Coordenadas para copiar:",
            "```",
            f"{payload.user_lat:.6f}, {payload.user_lng:.6f}",
            "```",
            "",
        ])
    for index, (product, quantity) in enumerate(products, 1):
        lines.append(
            str(index) + ". " + str(quantity) + " x " + str(product[2])
            + " — $ " + format(float(product[3]) * quantity, ".2f")
        )
    shipping_label = "gratis" if shipping_free else "no aplica gratis"
    lines.extend([
        "",
        "*Subtotal: $ " + format(total, ".2f") + "*",
        "*Envío: " + shipping_label + "*",
        "",
        shipping_message,
        "",
        "¿Me podrías confirmar disponibilidad y tiempo de entrega? ¡Gracias!",
    ])
    tracking_token = secrets.token_urlsafe(32)
    order_items = [
        {
            "product_id": product[0],
            "nombre": str(product[2]),
            "precio": float(product[3]),
            "cantidad": quantity,
        }
        for product, quantity in products
    ]
    try:
        order_id = database.create_order(
            store[0],
            tracking_token,
            order_items,
            total,
            payload.user_lat,
            payload.user_lng,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    lines.insert(3, "Pedido #" + str(order_id))
    whatsapp_url = "https://wa.me/" + urllib.parse.quote(str(store[5] or ""), safe="") + "?text=" + urllib.parse.quote("\n".join(lines))
    return {
        "whatsapp_url": whatsapp_url,
        "total": total,
        "store_id": store[0],
        "shipping_free": shipping_free,
        "shipping_message": shipping_message,
        "order_id": order_id,
        "tracking_token": tracking_token,
    }


@app.get("/api/public/orders/{tracking_token}")
def public_order_status(tracking_token: str):
    if len(tracking_token) < 32 or len(tracking_token) > 128:
        raise HTTPException(status_code=404, detail="No se encontró ese pedido.")
    order = database.get_order_by_tracking_token(tracking_token)
    if not order:
        raise HTTPException(status_code=404, detail="No se encontró ese pedido.")
    state = order["estado"]
    progress = {
        "recibido": 0,
        "aceptado": 1,
        "en_preparacion": 2,
        "enviado": 3,
        "cancelado": -1,
    }[state]
    return {
        "id": order["id"],
        "tienda": order["tienda"],
        "estado": state,
        "estado_label": ORDER_STATUS_LABELS[state],
        "progreso": progress,
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
    }


@app.get("/api/admin/session")
def admin_session_status(request: Request):
    token = request.cookies.get(ADMIN_SESSION_COOKIE)
    return {"authenticated": bool(token and _decode_admin_session(token))}


@app.post("/api/admin/login")
def admin_login(payload: AdminLoginInput, response: Response):
    password = _admin_password()
    if not password or not hmac.compare_digest(payload.password, password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
    _admin_cookie(response)
    return {"ok": True}


@app.post("/api/admin/logout")
def admin_logout(response: Response):
    response.delete_cookie(ADMIN_SESSION_COOKIE, path="/", httponly=True, samesite="strict")
    return {"ok": True}


@app.get("/api/admin/data")
def admin_data(_admin=Depends(current_admin)):
    owners = [
        {"store_id": row[0], "store": row[1], "username": row[2], "active": bool(row[3])}
        for row in database.get_store_owner_accounts()
    ]
    stores = database.get_all_tiendas()
    return {
        "categorias": [_category_payload(item) for item in database.get_all_categorias()],
        "tiendas": [_serialize_store(item) for item in stores],
        "productos": [
            _admin_product_payload(product)
            for store in stores
            for product in database.get_productos_by_tienda(store[0])
        ],
        "accesos": owners,
    }


@app.post("/api/admin/stores", status_code=201)
def admin_create_store(payload: AdminStoreInput, _admin=Depends(current_admin)):
    name, whatsapp = payload.nombre.strip(), payload.whatsapp.strip()
    categories = {item[0] for item in database.get_all_categorias()}
    if not name or not whatsapp or payload.categoria not in categories:
        raise HTTPException(status_code=422, detail="Completa los campos y elige una categoría válida.")
    store_id = database.add_tienda(
        name, payload.categoria, payload.latitud, payload.longitud, whatsapp, payload.direccion.strip()
    )
    return {"id": store_id}


@app.put("/api/admin/stores/{store_id}")
def admin_update_store(store_id: int, payload: AdminStoreInput, _admin=Depends(current_admin)):
    current = database.get_tienda_by_id(store_id)
    if not current:
        raise HTTPException(status_code=404, detail="No se encontró esa tienda.")
    name, whatsapp = payload.nombre.strip(), payload.whatsapp.strip()
    categories = {item[0] for item in database.get_all_categorias()}
    if not name or not whatsapp or payload.categoria not in categories:
        raise HTTPException(status_code=422, detail="Completa los campos y elige una categoría válida.")
    database.update_tienda(
        store_id, name, payload.categoria, payload.latitud, payload.longitud,
        whatsapp, payload.direccion.strip(), current[7] or "",
    )
    return {"ok": True}


@app.delete("/api/admin/stores/{store_id}")
def admin_delete_store(store_id: int, _admin=Depends(current_admin)):
    store = database.get_tienda_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="No se encontró esa tienda.")
    for product in database.get_productos_by_tienda(store_id):
        for path in _product_image_paths(product):
            _delete_uploaded_image(path)
    if store[7]:
        _delete_uploaded_image(store[7])
    database.delete_tienda(store_id)
    return {"ok": True}


@app.post("/api/admin/stores/{store_id}/image", status_code=201)
async def admin_upload_store_image(store_id: int, request: Request, filename: str, _admin=Depends(current_admin)):
    store = database.get_tienda_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="No se encontró esa tienda.")
    path = await _save_image(request, filename)
    database.update_tienda(store_id, *store[1:7], path)
    if store[7]:
        _delete_uploaded_image(store[7])
    return {"imagen": _image_url(path)}


@app.post("/api/admin/products", status_code=201)
def admin_create_product(payload: AdminProductInput, _admin=Depends(current_admin)):
    if not database.get_tienda_by_id(payload.tienda_id):
        raise HTTPException(status_code=404, detail="Selecciona una tienda válida.")
    name = payload.nombre.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del producto es obligatorio.")
    try:
        product_id = database.add_producto(
            payload.tienda_id, name, payload.precio, payload.stock, payload.descripcion.strip(), []
        )
    except Exception as exc:
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre.") from exc
        raise
    return {"id": product_id}


@app.put("/api/admin/products/{product_id}")
def admin_update_product(product_id: int, payload: AdminProductInput, _admin=Depends(current_admin)):
    product = database.get_producto_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    if not database.get_tienda_by_id(payload.tienda_id):
        raise HTTPException(status_code=404, detail="Selecciona una tienda válida.")
    name = payload.nombre.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del producto es obligatorio.")
    database.update_producto(
        product_id, name, payload.precio, payload.stock, payload.descripcion.strip(),
        _product_image_paths(product),
    )
    if payload.tienda_id != product[1]:
        with database.get_conn() as conn:
            conn.execute("UPDATE productos SET tienda_id = ? WHERE id = ?", (payload.tienda_id, product_id))
    return {"ok": True}


@app.delete("/api/admin/products/{product_id}")
def admin_delete_product(product_id: int, _admin=Depends(current_admin)):
    product = database.get_producto_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    for path in _product_image_paths(product):
        _delete_uploaded_image(path)
    database.delete_producto(product_id)
    return {"ok": True}


@app.post("/api/admin/products/{product_id}/images", status_code=201)
async def admin_upload_product_image(product_id: int, request: Request, filename: str, _admin=Depends(current_admin)):
    product = database.get_producto_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    images = _product_image_paths(product)
    if len(images) >= 8:
        raise HTTPException(status_code=400, detail="Cada producto puede tener hasta 8 fotos.")
    images.append(await _save_image(request, filename))
    database.set_owner_product_images(product[1], product_id, images)
    return {"imagenes": [_image_url(path) for path in images if _image_url(path)]}


@app.delete("/api/admin/products/{product_id}/images/{image_index}")
def admin_delete_product_image(product_id: int, image_index: int, _admin=Depends(current_admin)):
    product = database.get_producto_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="No se encontró ese producto.")
    images = _product_image_paths(product)
    if image_index < 0 or image_index >= len(images):
        raise HTTPException(status_code=404, detail="No se encontró esa foto.")
    removed = images.pop(image_index)
    database.set_owner_product_images(product[1], product_id, images)
    _delete_uploaded_image(removed)
    return {"imagenes": [_image_url(path) for path in images if _image_url(path)]}


@app.post("/api/admin/categories", status_code=201)
def admin_create_category(payload: AdminCategoryInput, _admin=Depends(current_admin)):
    name, color = payload.nombre.strip(), payload.color
    icon = payload.icono if payload.icono in _ADMIN_ICON_NAMES else "shopping-cart"
    if not name or color not in ADMIN_COLORS:
        raise HTTPException(status_code=422, detail="Indica un nombre y un color válidos.")
    database.add_categoria(name, color, icon)
    return {"ok": True}


@app.delete("/api/admin/categories/{category_name}")
def admin_delete_category(category_name: str, _admin=Depends(current_admin)):
    try:
        database.delete_categoria(category_name)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/admin/owners", status_code=201)
def admin_create_owner(payload: AdminOwnerInput, _admin=Depends(current_admin)):
    temporary_password = secrets.token_urlsafe(12)
    try:
        database.create_store_owner(payload.tienda_id, payload.username, temporary_password)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"username": payload.username.strip(), "temporary_password": temporary_password}


@app.patch("/api/admin/owners/status")
def admin_toggle_owner(payload: OwnerNameInput, active: bool, _admin=Depends(current_admin)):
    if not database.set_store_owner_active(payload.username, active):
        raise HTTPException(status_code=404, detail="No se encontró esa cuenta.")
    return {"ok": True, "active": active}


@app.post("/api/admin/owners/reset-password")
def admin_reset_owner_password(payload: OwnerNameInput, _admin=Depends(current_admin)):
    temporary_password = secrets.token_urlsafe(12)
    try:
        changed = database.reset_store_owner_password(payload.username, temporary_password)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="No se encontró esa cuenta.") from exc
    if not changed:
        raise HTTPException(status_code=404, detail="No se encontró esa cuenta.")
    return {"username": payload.username, "temporary_password": temporary_password}

app.mount("/mobile-assets", StaticFiles(directory=str(MOBILE_ASSET_DIR)), name="mobile-assets")


def _admin_product_payload(product):
    payload = _serialize_product(product)
    payload["tienda_id"] = product[1]
    return payload
