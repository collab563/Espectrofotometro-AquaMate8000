"""
main.py — Aplicación principal de directorio de fiestas.
Features:
  - Mapa interactivo con marcadores clickeables (puente JS-Python)
  - Filtros por categoría
  - Carrito de compras con envío directo a WhatsApp
  - Panel de administración (CRUD tiendas/productos/categorías)
  - Modo oscuro/claro persistente
  - Hilos para no bloquear la UI al regenerar el mapa
"""
import sys
import math
import json
import html
import os
import re
import secrets
import time
import urllib.parse
import urllib.error
import urllib.request
import unicodedata
import webbrowser
from functools import partial
from typing import List, Tuple

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QPushButton, QLabel, QListWidget, QListWidgetItem, QSplitter,
    QMessageBox, QInputDialog, QDialog, QFormLayout, QLineEdit,
    QDoubleSpinBox, QSpinBox, QComboBox, QDialogButtonBox, QTabWidget,
    QStatusBar, QToolBar, QCheckBox, QSystemTrayIcon, QMenu, QFileDialog,
    QTextEdit, QToolButton, QStackedWidget, QScrollArea, QGridLayout
)
from PyQt6.QtCore import (
    Qt, QUrl, QObject, pyqtSlot, pyqtSignal, QThread, QTimer, QRect,
    QEvent, QPoint, QPropertyAnimation, QEasingCurve,
)
from PyQt6.QtGui import (
    QAction, QIcon, QPixmap, QPainter, QLinearGradient, QColor, QFont, QCursor,
)
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineSettings
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtPositioning import QGeoPositionInfo, QGeoPositionInfoSource

import database
import map_engine
import routing
import config as app_config
from theme import get_stylesheet, get_palette

PHOTON_API_URL = os.environ.get(
    "FIESTA_GEOCODER_URL", "https://photon.komoot.io/api/"
)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en kilómetros entre dos puntos geográficos."""
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def search_address_candidates(query: str):
    query = query.strip()
    coordinates = routing.parse_location_coordinates(query)
    if coordinates:
        latitude, longitude = coordinates
        return [(f"Coordenadas: {latitude:.6f}, {longitude:.6f}", latitude, longitude, 0)]
    if len(query) < 2:
        return []
    params = urllib.parse.urlencode({
        "q": query,
        "limit": 10,
        "countrycode": "PE",
    })
    request = urllib.request.Request(
        f"{PHOTON_API_URL}?{params}",
        headers={
            "User-Agent": "FiestaApp/1.0 (desktop address search)",
            "Accept-Language": "es",
        },
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.load(response)

    candidates = []
    for feature in payload.get("features", []):
        try:
            properties = feature["properties"]
            longitude, latitude = feature["geometry"]["coordinates"]
            latitude = float(latitude)
            longitude = float(longitude)
            if str(properties.get("countrycode", "")).upper() != "PE":
                continue
        except (KeyError, TypeError, ValueError, AttributeError):
            continue
        address_parts = [
            properties.get("name"),
            properties.get("housenumber"),
            properties.get("street"),
            properties.get("district"),
            properties.get("city"),
            properties.get("county"),
            properties.get("state"),
            properties.get("country"),
        ]
        label_parts = []
        for part in address_parts:
            if part and str(part).strip() and str(part).strip() not in label_parts:
                label_parts.append(str(part).strip())
        label = ", ".join(label_parts)
        if (
            label
            and math.isfinite(latitude)
            and math.isfinite(longitude)
            and -90 <= latitude <= 90
            and -180 <= longitude <= 180
        ):
            accuracy_meters = photon_result_accuracy_meters(properties, latitude)
            candidates.append((label, latitude, longitude, accuracy_meters))
    return candidates


def filter_address_candidates_by_prefix(candidates, query):
    query_tokens = _normalized_address_tokens(query)
    if not query_tokens:
        return list(candidates)
    matches = []
    for candidate in candidates:
        address_tokens = set(_normalized_address_tokens(candidate[0]))
        if all(any(token.startswith(query_token) for token in address_tokens) for query_token in query_tokens):
            matches.append(candidate)
    return matches


def _normalized_address_tokens(value):
    decomposed = unicodedata.normalize("NFD", str(value or "")).casefold()
    normalized = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.findall(r"[a-z0-9]+", normalized)


def address_query_can_reuse_results(previous_query, current_query):
    previous_tokens = set(_normalized_address_tokens(previous_query))
    current_tokens = set(_normalized_address_tokens(current_query))
    return bool(previous_tokens) and all(
        any(old.startswith(new) or new.startswith(old) for new in current_tokens)
        for old in previous_tokens
    )


def photon_result_accuracy_meters(properties, latitude):
    extent = properties.get("extent")
    if not isinstance(extent, (list, tuple)) or len(extent) != 4:
        return None
    try:
        min_lon, max_lat, max_lon, min_lat = map(float, extent)
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(value) for value in (min_lon, max_lat, max_lon, min_lat)):
        return None
    width_meters = abs(max_lon - min_lon) * 111_320 * abs(math.cos(math.radians(latitude)))
    height_meters = abs(max_lat - min_lat) * 110_574
    return math.hypot(width_meters, height_meters) / 2


def location_accuracy_is_acceptable(accuracy_meters):
    try:
        accuracy_meters = float(accuracy_meters)
    except (TypeError, ValueError):
        return False
    return math.isfinite(accuracy_meters) and 0 <= accuracy_meters <= 10_000


def free_delivery_eligibility(store, user_location, accuracy_meters):
    if not store or len(store) <= 11 or not bool(store[10]):
        return None
    try:
        radius_meters = int(store[11])
    except (TypeError, ValueError):
        return None
    if radius_meters < 0:
        return None
    if not user_location or not location_accuracy_is_acceptable(accuracy_meters):
        return None, radius_meters, None, None
    distance_meters = 1000 * haversine_km(
        user_location[0], user_location[1], store[3], store[4]
    )
    eligible = distance_meters + accuracy_meters <= radius_meters
    return eligible, radius_meters, distance_meters, accuracy_meters


def free_delivery_details_html(store):
    if not store or len(store) <= 12 or not bool(store[10]):
        return ""
    radius_meters = float(store[11])
    minimum_purchase = float(store[12])
    return (
        f"<p style='margin:4px'><b>Radio máximo:</b> {radius_meters:g} m<br>"
        f"<b>Pago mínimo de compra para envío gratis:</b> S/ {minimum_purchase:.2f}</p>"
    )


def customer_order_progress_html(order):
    steps = [
        ("recibido", "Recibido"),
        ("aceptado", "Aceptado"),
        ("en_preparacion", "Preparación"),
        ("enviado", "Enviado"),
    ]
    status = order["estado"]
    if status == "cancelado":
        indicators = " ".join(
            "<span title='{label}' style='color:#52605a;font-size:13px'>●</span>"
            .format(label=label)
            for _, label in steps
        )
        return (
            f"<b>Pedido #{int(order['id'])}:</b> "
            "<span style='color:#e4775f'>Cancelado</span><br>" + indicators
        )
    active_index = [step[0] for step in steps].index(status)
    indicators = " ".join(
        "<span title='{label}' style='color:{color};font-size:13px'>●</span>"
        .format(
            label=label,
            color="#39ff14" if index <= active_index else "#52605a",
        )
        for index, (_, label) in enumerate(steps)
    )
    return (
        f"<b>Pedido #{int(order['id'])}:</b> "
        f"{html.escape(status.replace('_', ' ').capitalize())}<br>{indicators}"
    )


def build_app_logo_pixmap(size: int = 512) -> QPixmap:
    """Genera un logo profesional para la app con estética moderna de eventos."""
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)

    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)

    # Fondo circular con degradado premium
    gradient = QLinearGradient(0, 0, size, size)
    gradient.setColorAt(0.0, QColor("#F59E0B"))
    gradient.setColorAt(0.5, QColor("#FB7185"))
    gradient.setColorAt(1.0, QColor("#7C3AED"))
    painter.setPen(Qt.PenStyle.NoPen)
    painter.setBrush(gradient)
    painter.drawEllipse(28, 28, size - 56, size - 56)

    # Círculo interior oscuro
    painter.setBrush(QColor("#111827"))
    painter.drawEllipse(96, 96, size - 192, size - 192)

    # Símbolo "F" con estilo premium
    painter.setPen(QColor("#F8FAFC"))
    painter.setFont(QFont("Segoe UI", int(size * 0.28), QFont.Weight.Bold))
    painter.drawText(QRect(130, 130, size - 260, size - 220), Qt.AlignmentFlag.AlignCenter, "F")

    # Globo decorativo para evocar fiestas y celebraciones
    painter.setPen(Qt.PenStyle.NoPen)
    painter.setBrush(QColor("#38BDF8"))
    painter.drawEllipse(size - 118, 96, 72, 72)
    painter.setBrush(QColor("#F8FAFC"))
    painter.drawEllipse(size - 100, 120, 12, 12)
    painter.setPen(QColor("#38BDF8"))
    painter.drawLine(size - 94, 166, size - 94, 210)
    painter.drawLine(size - 94, 210, size - 120, 240)

    painter.end()
    return pixmap


class AppSplash(QWidget):
    def __init__(self):
        super().__init__()
        self.logo = build_app_logo_pixmap(220)
        self.progress = 0
        self.fade_step = 0.04
        self.opacity = 0.0
        self._on_finish = None
        self.setWindowFlags(
            Qt.WindowType.SplashScreen | Qt.WindowType.FramelessWindowHint
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.resize(620, 430)
        self.center_on_screen()
        self.setWindowOpacity(self.opacity)
        self._start_animation()

    def _start_animation(self):
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._animate)
        self.timer.start(30)

    def _animate(self):
        self.opacity = min(self.opacity + self.fade_step, 1.0)
        self.progress = min(self.progress + 2, 100)
        self.setWindowOpacity(self.opacity)
        self.update()

        if self.progress >= 100:
            self.timer.stop()

    def start_fade_out(self, on_finish=None):
        self._on_finish = on_finish
        self.fade_step = -0.08
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._fade_out)
        self.timer.start(30)

    def _fade_out(self):
        self.opacity = max(0.0, self.opacity + self.fade_step)
        self.setWindowOpacity(self.opacity)
        self.update()

        if self.opacity <= 0.0:
            self.timer.stop()
            self.close()
            if self._on_finish:
                self._on_finish()

    def center_on_screen(self):
        screen = QApplication.primaryScreen().availableGeometry()
        self.move(
            screen.center().x() - self.width() // 2,
            screen.center().y() - self.height() // 2,
        )

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # fondo principal con vidrio
        bg_rect = QRect(12, 12, self.width() - 24, self.height() - 24)
        painter.setPen(QColor("#1F2937"))
        painter.setBrush(QColor("#111827"))
        painter.drawRoundedRect(bg_rect, 28, 28)

        glow = QLinearGradient(0, 0, self.width(), self.height())
        glow.setColorAt(0.0, QColor("#1D4ED8"))
        glow.setColorAt(0.5, QColor("#7C3AED"))
        glow.setColorAt(1.0, QColor("#F59E0B"))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(glow)
        painter.drawRoundedRect(QRect(28, 28, self.width() - 56, self.height() - 56), 24, 24)

        # marca/logo
        painter.drawPixmap(70, 90, self.logo)

        # textos
        painter.setPen(QColor("#F8FAFC"))
        painter.setFont(QFont("Segoe UI", 26, QFont.Weight.Bold))
        painter.drawText(
            QRect(300, 110, 230, 54),
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter,
            "FiestaApp",
        )

        painter.setFont(QFont("Segoe UI", 12, QFont.Weight.Normal))
        painter.setPen(QColor("#E2E8F0"))
        painter.drawText(
            QRect(302, 168, 240, 28),
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter,
            "Directorio de fiestas y eventos",
        )

        painter.setPen(QColor("#F8FAFC"))
        painter.setFont(QFont("Segoe UI", 10, QFont.Weight.Normal))
        painter.drawText(
            QRect(302, 260, 220, 20),
            Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter,
            "Cargando experiencia...",
        )

        # barra de progreso con avance suave
        progress_width = int((self.progress / 100) * 210)
        bar_rect = QRect(300, 300, 210, 10)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor("#374151"))
        painter.drawRoundedRect(bar_rect, 5, 5)
        painter.setBrush(QColor("#F8FAFC"))
        painter.drawRoundedRect(QRect(300, 300, progress_width, 10), 5, 5)


# =================== HILO PARA REGENERAR MAPA ===================
class MapWorker(QThread):
    finished_with_path = pyqtSignal(str)

    def __init__(self, tiendas, categorias, lat, lng, zoom, dark, user_location=None,
                 radius_km=None, user_location_label="Tu ubicación"):
        super().__init__()
        self.tiendas = tiendas
        self.categorias = categorias
        self.lat = lat
        self.lng = lng
        self.zoom = zoom
        self.dark = dark
        self.user_location = user_location
        self.radius_km = radius_km
        self.user_location_label = user_location_label

    def run(self):
        try:
            path = map_engine.render_map(
                self.tiendas, self.categorias,
                self.lat, self.lng, self.zoom, self.dark,
                self.user_location, self.radius_km, self.user_location_label,
            )
            self.finished_with_path.emit(path)
        except Exception as e:
            print(f"[MapWorker] Error: {e}")


class RoadRouteWorker(QThread):
    route_ready = pyqtSignal(int, object, str)

    def __init__(self, request_id, origin, destination, parent=None):
        super().__init__(parent)
        self.request_id = request_id
        self.origin = origin
        self.destination = destination

    def run(self):
        try:
            route = routing.shortest_road_route(self.origin, self.destination)
            self.route_ready.emit(self.request_id, route, "")
        except (OSError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            self.route_ready.emit(self.request_id, None, str(error))


class AddressSearchWorker(QThread):
    results_ready = pyqtSignal(str, object, str)

    def __init__(self, query, parent=None):
        super().__init__(parent)
        self.query = query

    def run(self):
        try:
            candidates = search_address_candidates(self.query)
            self.results_ready.emit(self.query, candidates, "")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            print(f"[AddressSearchWorker] Error: {exc}")
            self.results_ready.emit(
                self.query,
                [],
                "No se pudo consultar el servicio de direcciones. Revisa tu conexión a Internet.",
            )


# =================== PUENTE JS <-> PYTHON ===================
class MapBridge(QObject):
    tiendaSelected = pyqtSignal(int)

    @pyqtSlot(int)
    def selectTienda(self, tienda_id: int):
        self.tiendaSelected.emit(int(tienda_id))


# =================== DIÁLOGO: AGREGAR/EDITAR TIENDA ===================
class TiendaDialog(QDialog):
    def __init__(self, parent=None, tienda=None, categorias=None):
        super().__init__(parent)
        self.tienda = tienda
        self.setWindowTitle("Tienda")
        self.setMinimumWidth(380)

        layout = QFormLayout(self)

        self.input_nombre = QLineEdit()
        self.input_direccion = QLineEdit()
        self.input_whatsapp = QLineEdit()
        self.input_whatsapp.setPlaceholderText("51999999999 (con código de país)")
        self.input_lat = QDoubleSpinBox()
        self.input_lat.setRange(-90, 90)
        self.input_lat.setDecimals(6)
        self.input_lng = QDoubleSpinBox()
        self.input_lng.setRange(-180, 180)
        self.input_lng.setDecimals(6)

        self.combo_cat = QComboBox()
        self.combo_cat.addItems(categorias or ["Torterías", "Dulcerías", "Jugueterías", "Decoraciones"])

        if tienda:
            # tienda: (id, nombre, categoria, lat, lng, whatsapp, direccion, ...)
            _, nombre, cat, lat, lng, wa, dir_txt = tienda[:7]
            self.input_nombre.setText(nombre)
            self.input_direccion.setText(dir_txt or "")
            self.input_whatsapp.setText(wa or "")
            self.input_lat.setValue(lat)
            self.input_lng.setValue(lng)
            idx = self.combo_cat.findText(cat)
            if idx >= 0:
                self.combo_cat.setCurrentIndex(idx)

        layout.addRow("Nombre*:", self.input_nombre)
        layout.addRow("Categoría*:", self.combo_cat)
        layout.addRow("Dirección:", self.input_direccion)
        layout.addRow("WhatsApp*:", self.input_whatsapp)
        layout.addRow("Latitud*:", self.input_lat)
        layout.addRow("Longitud*:", self.input_lng)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def get_data(self):
        return (
            self.input_nombre.text().strip(),
            self.combo_cat.currentText(),
            self.input_lat.value(),
            self.input_lng.value(),
            self.input_whatsapp.text().strip(),
            self.input_direccion.text().strip(),
        )


# =================== DIÁLOGO: AGREGAR/EDITAR PRODUCTO ===================
class ProductoDialog(QDialog):
    def __init__(self, parent=None, producto=None):
        super().__init__(parent)
        self.producto = producto
        self.setWindowTitle("Producto")
        self.setMinimumWidth(320)
        layout = QFormLayout(self)
        self.input_nombre = QLineEdit()
        self.input_precio = QDoubleSpinBox()
        self.input_precio.setRange(0, 999999)
        self.input_precio.setDecimals(2)
        self.input_precio.setPrefix("$ ")
        self.input_stock = QSpinBox()
        self.input_stock.setRange(0, 999999)
        self.input_descripcion = QTextEdit()
        self.input_descripcion.setFixedHeight(70)
        self.input_imagen = QLineEdit()
        self.btn_imagen = QPushButton("Seleccionar foto")
        self.btn_imagen.clicked.connect(self._select_image)
        if producto:
            _, _, nombre, precio, stock, descripcion, imagen, imagenes = producto[:8]
            self.input_nombre.setText(nombre)
            self.input_precio.setValue(precio)
            self.input_stock.setValue(stock)
            self.input_descripcion.setPlainText(descripcion or "")
            self.input_imagen.setText("; ".join(_decode_image_paths(imagen, imagenes)))
        layout.addRow("Nombre*:", self.input_nombre)
        layout.addRow("Precio*:", self.input_precio)
        layout.addRow("Stock disponible:", self.input_stock)
        layout.addRow("Descripción:", self.input_descripcion)
        layout.addRow("Foto:", self.input_imagen)
        layout.addRow("", self.btn_imagen)
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _select_image(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Seleccionar foto del producto", "",
            "Imágenes (*.png *.jpg *.jpeg *.webp)"
        )
        if path:
            self.input_imagen.setText(path)

    def get_data(self):
        return (
            self.input_nombre.text().strip(), self.input_precio.value(),
            self.input_stock.value(), self.input_descripcion.toPlainText().strip(),
            self.input_imagen.text().strip(),
        )


class ProductoInfoDialog(QDialog):
    pointer_entered = pyqtSignal()
    pointer_left = pyqtSignal()

    def __init__(self, producto, tienda_nombre, parent=None):
        super().__init__(parent)
        _, _, nombre, precio, stock, descripcion, imagen, imagenes = producto[:8]
        self.setWindowTitle(f"Información: {nombre}")
        self.setMinimumSize(460, 520)
        layout = QVBoxLayout(self)

        image_paths = _decode_image_paths(imagen, imagenes)
        self.carousel = ProductImageCarousel(image_paths)
        layout.addWidget(self.carousel)

        title = QLabel(f"<h2>{nombre}</h2>")
        layout.addWidget(title)
        layout.addWidget(QLabel(f"<b>Tienda:</b> {tienda_nombre}"))
        layout.addWidget(QLabel(f"<b>Precio:</b> $ {float(precio):.2f}"))
        layout.addWidget(QLabel(f"<b>Disponible:</b> {stock} unidades"))
        description = QLabel(descripcion or "No hay una descripción registrada para este producto.")
        description.setWordWrap(True)
        layout.addWidget(description)
        layout.addStretch()
        self.close_button = QPushButton("Cerrar")
        self.close_button.clicked.connect(self.accept)
        layout.addWidget(self.close_button)

    def set_hover_preview(self):
        self.setWindowModality(Qt.WindowModality.NonModal)
        self.close_button.hide()

    def enterEvent(self, event):
        self.pointer_entered.emit()
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.pointer_left.emit()
        super().leaveEvent(event)


def _decode_image_paths(legacy_image, gallery_json):
    try:
        paths = json.loads(gallery_json or "[]")
    except (TypeError, json.JSONDecodeError):
        paths = []
    if not isinstance(paths, list):
        paths = []
    if legacy_image and legacy_image not in paths:
        paths.insert(0, legacy_image)
    return [str(path) for path in paths if path]


class SwipeImageLabel(QLabel):
    swiped = pyqtSignal(str)

    def mousePressEvent(self, event):
        self.start_x = event.position().x()
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        distance = event.position().x() - getattr(self, "start_x", event.position().x())
        if abs(distance) >= 40:
            self.swiped.emit("next" if distance < 0 else "previous")
        super().mouseReleaseEvent(event)


class ProductImageCarousel(QWidget):
    def __init__(self, image_paths, parent=None):
        super().__init__(parent)
        self.image_paths = image_paths
        self.stack = QStackedWidget()
        self.stack.setMinimumHeight(260)
        for path in image_paths or [""]:
            label = SwipeImageLabel()
            label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            label.setStyleSheet("background: #eeeeee; border: 1px solid #cccccc;")
            pixmap = QPixmap(path) if path else QPixmap()
            if pixmap.isNull():
                label.setText("Sin foto disponible")
            else:
                label.setPixmap(pixmap.scaled(
                    420, 260, Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation,
                ))
            label.swiped.connect(self._handle_swipe)
            self.stack.addWidget(label)

        previous = QToolButton()
        previous.setText("<")
        previous.setToolTip("Foto anterior")
        previous.clicked.connect(self.previous)
        next_button = QToolButton()
        next_button.setText(">")
        next_button.setToolTip("Foto siguiente")
        next_button.clicked.connect(self.next)
        controls = QHBoxLayout()
        controls.addWidget(previous)
        controls.addStretch()
        controls.addWidget(next_button)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.stack)
        layout.addLayout(controls)

    def _handle_swipe(self, direction):
        self.next() if direction == "next" else self.previous()

    def next(self):
        self.stack.setCurrentIndex((self.stack.currentIndex() + 1) % self.stack.count())

    def previous(self):
        self.stack.setCurrentIndex((self.stack.currentIndex() - 1) % self.stack.count())


# =================== APP PRINCIPAL ===================
class FiestaApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.cfg = app_config.load_config()
        self.dark_mode = self.cfg["theme"] == "dark"
        self.current_category = "Todas"
        self.user_location = None
        self.user_location_accuracy_meters = None
        self.user_location_label = "Tu ubicación"
        self.location_source = None
        self.location_request_pending = False
        self.address_search_worker = None
        self.pending_address_query = None
        self.last_address_request_at = 0.0
        self.address_results_query = ""
        self.address_results = []
        self.selected_address = None
        self.hovered_product_id = None
        self.product_hover_dialog = None
        self.product_hover_fade_animation = None

        self.setWindowTitle(self.cfg["app_title"])
        self.setGeometry(80, 80, 1200, 760)
        self.setWindowIcon(QIcon(build_app_logo_pixmap(256)))
        self.current_tienda = None
        self.cart = []  # [(prod_id, nombre, precio, tienda_id, tienda_nombre)]
        self.map_worker = None
        self.tiendas_actuales = []
        self.map_store_snapshot = None
        self.map_refresh_pending = False
        self._map_document_ready = False
        self._route_request_id = 0
        self._route_request_pending = False
        self._route_worker = None
        self._delivery_point_picker_pending = False
        self.checkout_location_prompted = False
        self.customer_order_token = self.cfg.get("customer_order_token", "")

        database.init_db()

        self._build_ui()
        self.address_suggestion_timer = QTimer(self)
        self.address_suggestion_timer.setSingleShot(True)
        self.address_suggestion_timer.timeout.connect(self._search_current_address)
        self.address_request_timer = QTimer(self)
        self.address_request_timer.setSingleShot(True)
        self.address_request_timer.timeout.connect(self._start_pending_address_search)
        self.product_hover_show_timer = QTimer(self)
        self.product_hover_show_timer.setSingleShot(True)
        self.product_hover_show_timer.setInterval(350)
        self.product_hover_show_timer.timeout.connect(self._show_product_hover_info)
        self.product_hover_hide_timer = QTimer(self)
        self.product_hover_hide_timer.setSingleShot(True)
        self.product_hover_hide_timer.setInterval(2000)  #tiempo de espera de la ventana de mas informacion: 2 segundos
        self.product_hover_hide_timer.timeout.connect(self._fade_product_hover_info)
        self._build_menu()
        self._setup_location_source()
        self._apply_theme()
        self.refresh_map()
        self.customer_order_timer = QTimer(self)
        self.customer_order_timer.timeout.connect(self._refresh_customer_order_progress)
        self.customer_order_timer.start(12000)
        self._refresh_customer_order_progress()
        self.store_sync_timer = QTimer(self)
        self.store_sync_timer.timeout.connect(self._sync_external_store_changes)
        self.store_sync_timer.start(5000)

    # ---------- UI ----------
    def _build_ui(self):
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        root_layout = QHBoxLayout(main_widget)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        root_layout.addWidget(splitter)

        # ===== Panel Izquierdo =====
        left = QWidget()
        self.left_layout = QVBoxLayout(left)

        title = QLabel("<b>Directorio Local</b>")
        title.setStyleSheet("font-size: 18px; padding: 8px;")
        self.left_layout.addWidget(title)

        # Filtros
        self.left_layout.addWidget(QLabel("<b>Filtrar por categoría:</b>"))
        self.filter_layout = QGridLayout()
        self.filter_layout.setContentsMargins(0, 0, 0, 0)
        self.filter_layout.setHorizontalSpacing(6)
        self.filter_layout.setVerticalSpacing(6)
        self.left_layout.addLayout(self.filter_layout)

        self.location_status = QLabel("Ubicación: sin ubicación activa")
        self.location_status.setWordWrap(True)
        self.left_layout.addWidget(self.location_status)

        self.location_controls = QHBoxLayout()
        self.filter_radius_checkbox = QCheckBox("Filtrar por radio")
        self.filter_radius_checkbox.setChecked(self.cfg.get("radius_filter_enabled", True))
        self.filter_radius_checkbox.toggled.connect(self._on_radius_filter_changed)
        self.radius_spin = QDoubleSpinBox()
        self.radius_spin.setRange(0.5, 200.0)
        self.radius_spin.setDecimals(1)
        self.radius_spin.setSingleStep(1.0)
        self.radius_spin.setValue(float(self.cfg.get("radius_km", 10.0)))
        self.radius_spin.valueChanged.connect(self._on_radius_filter_changed)
        self.location_controls.addWidget(self.filter_radius_checkbox)
        self.location_controls.addWidget(QLabel("Radio (km):"))
        self.location_controls.addWidget(self.radius_spin)
        self.left_layout.addLayout(self.location_controls)

        self.left_layout.addWidget(QLabel("<b>Buscar dirección o lugar:</b>"))
        address_search_row = QHBoxLayout()
        self.address_search_input = QLineEdit()
        self.address_search_input.setPlaceholderText("Dirección o coordenadas")
        self.address_search_input.textEdited.connect(self._on_address_text_edited)
        self.address_search_input.returnPressed.connect(self._search_address)
        self.address_search_button = QPushButton("Buscar")
        self.address_search_button.clicked.connect(self._search_address)
        address_search_row.addWidget(self.address_search_input)
        address_search_row.addWidget(self.address_search_button)
        self.left_layout.addLayout(address_search_row)

        self.address_suggestions = QListWidget()
        self.address_suggestions.setMaximumHeight(112)
        self.address_suggestions.itemClicked.connect(self._select_address_suggestion)
        self.address_suggestions.hide()
        self.left_layout.addWidget(self.address_suggestions)
        privacy_notice = QLabel(
            "La búsqueda usa Photon/OpenStreetMap y requiere Internet; FiestaApp no guarda la dirección."
        )
        privacy_notice.setWordWrap(True)
        privacy_notice.setStyleSheet("font-size: 10px; color: #718078;")
        self.left_layout.addWidget(privacy_notice)

        self.btn_use_location = QPushButton("Usar mi ubicación")
        self.btn_use_location.clicked.connect(self._request_user_location)
        self.left_layout.addWidget(self.btn_use_location)
        self.btn_pick_delivery_point = QPushButton("Elegir punto de entrega en el mapa")
        self.btn_pick_delivery_point.clicked.connect(self._enable_delivery_point_picker)
        self.left_layout.addWidget(self.btn_pick_delivery_point)

        # Detalle tienda
        self.detail_label = QLabel("<i>Selecciona una tienda en el mapa.</i>")
        self.detail_label.setWordWrap(True)
        self.detail_label.setStyleSheet("padding: 10px; border-radius: 6px;")
        self.left_layout.addWidget(self.detail_label)

        self.list_productos = QListWidget()
        self.list_productos.setStyleSheet("padding: 4px;")
        self.list_productos.setMouseTracking(True)
        self.list_productos.itemEntered.connect(self._schedule_product_hover_info)
        self.list_productos.viewport().installEventFilter(self)
        self.list_productos.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.list_productos.customContextMenuRequested.connect(self._show_product_context_menu)
        self.left_layout.addWidget(QLabel("<b>Productos disponibles (marca para agregar al carrito):</b>"))
        self.left_layout.addWidget(self.list_productos)

        quantity_layout = QHBoxLayout()
        quantity_layout.addWidget(QLabel("Cantidad:"))
        self.product_quantity = QSpinBox()
        self.product_quantity.setRange(1, 1)
        self.product_quantity.setValue(1)
        self.product_quantity.setEnabled(False)
        quantity_layout.addWidget(self.product_quantity)
        self.stock_status = QLabel("Disponible: -")
        quantity_layout.addWidget(self.stock_status)
        quantity_layout.addStretch()
        self.left_layout.addLayout(quantity_layout)

        # Botones acción
        action_layout = QGridLayout()
        action_layout.setContentsMargins(0, 0, 0, 0)
        action_layout.setHorizontalSpacing(6)
        action_layout.setColumnStretch(0, 1)
        action_layout.setColumnStretch(1, 1)
        self.btn_add_cart = QPushButton("🛒 Agregar al carrito")
        self.btn_add_cart.clicked.connect(self.add_to_cart)
        self.btn_add_cart.setEnabled(False)
        action_layout.addWidget(self.btn_add_cart, 0, 0)

        self.btn_clear_cart = QPushButton("🗑 Vaciar carrito")
        self.btn_clear_cart.clicked.connect(self.clear_cart)
        action_layout.addWidget(self.btn_clear_cart, 0, 1)
        self.left_layout.addLayout(action_layout)

        # Carrito
        self.left_layout.addWidget(QLabel("<b>🛒 Carrito de pedido:</b>"))
        self.list_cart = QListWidget()
        self.list_cart.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.list_cart.customContextMenuRequested.connect(self._show_cart_context_menu)
        self.cart_label = QLabel("Total: $ 0.00")
        self.cart_label.setStyleSheet("font-weight: bold; padding: 4px;")
        self.left_layout.addWidget(self.list_cart)
        self.left_layout.addWidget(self.cart_label)
        self.customer_order_progress = QLabel()
        self.customer_order_progress.setWordWrap(True)
        self.customer_order_progress.setTextFormat(Qt.TextFormat.RichText)
        self.customer_order_progress.setStyleSheet("padding: 4px; font-size: 11px;")
        self.customer_order_progress.hide()
        self.left_layout.addWidget(self.customer_order_progress)

        self.btn_whatsapp = QPushButton("📲 Enviar pedido por WhatsApp")
        self.btn_whatsapp.setStyleSheet(
            "background-color: #25D366; color: white; font-weight: bold; padding: 12px;"
        )
        self.btn_whatsapp.clicked.connect(self.send_cart_whatsapp)
        self.btn_whatsapp.setEnabled(False)
        self.left_layout.addWidget(self.btn_whatsapp)

        # ===== WebEngine =====
        self.web_view = QWebEngineView()
        settings = self.web_view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)

        self.channel = QWebChannel()
        self.bridge = MapBridge()
        self.channel.registerObject("qtBridge", self.bridge)
        self.bridge.tiendaSelected.connect(self.load_tienda_details)
        self.web_view.page().urlChanged.connect(self._handle_map_url)

        left_scroll = QScrollArea()
        left_scroll.setWidgetResizable(True)
        left_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        left_scroll.setMinimumWidth(460)
        left.setMinimumWidth(440)
        left_scroll.setWidget(left)
        splitter.addWidget(left_scroll)
        self.web_view.setMinimumWidth(480)
        splitter.addWidget(self.web_view)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setSizes([480, 720])

        self.status = QStatusBar()
        self.setStatusBar(self.status)
        self.status.showMessage("Listo ✓")

        # Habilitar botón carrito al seleccionar producto
        self.list_productos.itemSelectionChanged.connect(
            self._on_product_selection_changed
        )

        self._refresh_filters()

    def _build_menu(self):
        menubar = self.menuBar()

        # Menú Ver
        ver = menubar.addMenu("&Ver")

        self.act_dark = QAction("🌙 Modo Oscuro", self, checkable=True)
        self.act_dark.setChecked(self.dark_mode)
        self.act_dark.triggered.connect(self.toggle_theme)
        ver.addAction(self.act_dark)

        ver.addSeparator()
        act_refresh = QAction("🔄 Recargar mapa", self)
        act_refresh.triggered.connect(self.refresh_map)
        ver.addAction(act_refresh)

        # Menú Admin
        admin = menubar.addMenu("&Administración")
        act_admin = QAction("🔐 Panel Admin", self)
        act_admin.triggered.connect(self.open_admin)
        admin.addAction(act_admin)

        # Ayuda
        ayuda = menubar.addMenu("&Ayuda")
        act_about = QAction("ℹ Acerca de", self)
        act_about.triggered.connect(self.show_about)
        ayuda.addAction(act_about)

    def _apply_theme(self):
        app = QApplication.instance()
        app.setStyleSheet(get_stylesheet(self.dark_mode))
        # Background del webview según modo
        bg = "#1e1e1e" if self.dark_mode else "#ffffff"
        self.web_view.setStyleSheet(f"background-color: {bg};")

    def _refresh_filters(self):
        # Limpiar layout previo
        while self.filter_layout.count():
            item = self.filter_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        categorias = ["Todas"] + [c[0] for c in database.get_all_categorias()]
        for index, cat in enumerate(categorias):
            btn = QPushButton(cat)
            btn.setMinimumHeight(32)
            btn.setMinimumWidth(0)
            btn.clicked.connect(partial(self.filter_category, cat))
            self.filter_layout.addWidget(btn, index // 2, index % 2)

    def _setup_location_source(self):
        self.location_source = QGeoPositionInfoSource.createDefaultSource(self)
        if self.location_source is None:
            self.location_status.setText("📍 Ubicación: no disponible en este dispositivo")
            return
        self.location_source.positionUpdated.connect(self._on_position_updated)
        self.location_source.setUpdateInterval(5000)

    def _on_address_text_edited(self, text):
        self.selected_address = None
        self.pending_address_query = None
        self.address_request_timer.stop()
        self.address_suggestions.clear()
        self.address_suggestions.hide()
        self.address_search_button.setText("Buscar")
        self.address_suggestion_timer.stop()
        coordinates = routing.parse_location_coordinates(text)
        if coordinates:
            latitude, longitude = coordinates
            item = QListWidgetItem(
                f"Usar coordenadas: {latitude:.6f}, {longitude:.6f}"
            )
            item.setData(
                Qt.ItemDataRole.UserRole,
                (text.strip(), latitude, longitude, 0),
            )
            self.address_suggestions.addItem(item)
            self.address_suggestions.show()
            self.location_status.setText(
                "Coordenadas detectadas. Selecciónalas y pulsa Centrar mapa."
            )
            return
        if len(text.strip()) >= 2:
            if self.address_results and address_query_can_reuse_results(
                self.address_results_query, text
            ):
                self._show_address_results(text, self.address_results, "")
            self.address_suggestion_timer.start(100)

    def _search_current_address(self):
        self._queue_address_search(self.address_search_input.text().strip())

    def _search_address(self):
        self.address_suggestion_timer.stop()
        query = self.address_search_input.text().strip()
        coordinates = routing.parse_location_coordinates(query)
        if coordinates and not self.selected_address:
            self.selected_address = (query, coordinates[0], coordinates[1], 0)
        if self.selected_address and self.selected_address[0] == query:
            _, latitude, longitude, accuracy_meters = self.selected_address
            self.selected_address = None
            self.address_search_button.setText("Buscar")
            self.address_suggestions.hide()
            self.user_location = (latitude, longitude)
            self.user_location_accuracy_meters = accuracy_meters
            self.user_location_label = "Ubicación seleccionada"
            self.checkout_location_prompted = False
            self._refresh_cart()
            self.location_status.setText(
                f"📍 Ubicación elegida: {latitude:.4f}, {longitude:.4f}"
            )
            self.refresh_map()
            self.status.showMessage("Mapa centrado en la dirección seleccionada", 4000)
            return
        if len(query) < 2:
            self.location_status.setText("Escribe al menos 2 caracteres para buscar.")
            return
        if query == self.address_results_query and self.address_results:
            self._show_address_results(query, self.address_results, "")
            return
        self._queue_address_search(query)

    def _queue_address_search(self, query):
        if len(query) < 2:
            return
        if query == self.address_results_query and self.address_results:
            self._show_address_results(query, self.address_results, "")
            return
        if self.address_search_worker and self.address_search_worker.isRunning():
            self.pending_address_query = query
            return
        elapsed = time.monotonic() - self.last_address_request_at
        wait_ms = max(0, math.ceil((1.2 - elapsed) * 1000))
        if wait_ms:
            self.pending_address_query = query
            self.address_request_timer.start(wait_ms)
            return
        self.pending_address_query = None
        self.last_address_request_at = time.monotonic()
        self.address_search_button.setEnabled(False)
        self.location_status.setText("Buscando sugerencias de dirección...")
        worker = AddressSearchWorker(query, self)
        self.address_search_worker = worker
        worker.results_ready.connect(self._on_address_results)
        worker.finished.connect(lambda: self._finish_address_search(worker))
        worker.start()

    def _start_pending_address_search(self):
        query = self.pending_address_query
        if not query:
            return
        self.pending_address_query = None
        self._queue_address_search(query)

    def _on_address_results(self, query, candidates, error):
        self.address_results_query = query
        self.address_results = candidates
        current_query = self.address_search_input.text().strip()
        if query != current_query:
            if not error and address_query_can_reuse_results(query, current_query):
                self._show_address_results(current_query, candidates, "")
            return
        self._show_address_results(query, candidates, error)

    def _show_address_results(self, query, candidates, error):
        self.address_suggestions.clear()
        if error:
            self.location_status.setText(error)
            self.address_suggestions.hide()
            return
        candidates = filter_address_candidates_by_prefix(candidates, query)
        if not candidates:
            self.location_status.setText("No encontramos direcciones que comiencen con ese texto.")
            self.address_suggestions.hide()
            return
        for label, latitude, longitude, accuracy_meters in candidates:
            item = QListWidgetItem(label)
            item.setData(
                Qt.ItemDataRole.UserRole,
                (label, latitude, longitude, accuracy_meters),
            )
            self.address_suggestions.addItem(item)
        self.address_suggestions.show()
        self.location_status.setText("Selecciona una opción y pulsa Centrar mapa.")

    def _select_address_suggestion(self, item):
        label, latitude, longitude, accuracy_meters = item.data(Qt.ItemDataRole.UserRole)
        self.selected_address = (label, latitude, longitude, accuracy_meters)
        self.address_search_input.setText(label)
        self.address_search_button.setText("Centrar mapa")
        self.address_suggestions.hide()
        self.location_status.setText("Dirección seleccionada. Pulsa Centrar mapa para aplicarla.")

    def _finish_address_search(self, worker):
        if self.address_search_worker is worker:
            self.address_search_worker = None
        self.address_search_button.setEnabled(True)
        if self.pending_address_query:
            self._start_pending_address_search()

    def _request_user_location(self):
        if self.location_source is None:
            self.location_status.setText("📍 Ubicación: no disponible en este dispositivo")
            self.status.showMessage("GPS no disponible en este equipo", 3000)
            return
        self.location_request_pending = True
        self.status.showMessage("Obteniendo ubicación...", 3000)
        self.location_source.requestUpdate()

    def _on_position_updated(self, position):
        if not position.isValid():
            return
        accuracy = position.attribute(QGeoPositionInfo.Attribute.HorizontalAccuracy)
        try:
            accuracy = float(accuracy)
        except (TypeError, ValueError):
            accuracy = math.nan
        if not location_accuracy_is_acceptable(accuracy):
            self.location_request_pending = False
            if math.isfinite(accuracy):
                message = f"GPS impreciso (±{accuracy / 1000:.0f} km). Busca tu dirección para ubicarte mejor."
            else:
                message = "El GPS no informó su precisión. Busca tu dirección para ubicarte mejor."
            self.location_status.setText(message)
            self.status.showMessage("No se aplicó la ubicación porque es demasiado imprecisa", 5000)
            return
        had_location = self.user_location is not None
        coord = position.coordinate()
        self.user_location = (coord.latitude(), coord.longitude())
        self.user_location_accuracy_meters = accuracy
        self.user_location_label = "Tu ubicación"
        self.checkout_location_prompted = False
        self._refresh_cart()
        self.location_status.setText(
            f"📍 Mi ubicación: {coord.latitude():.4f}, {coord.longitude():.4f}"
        )
        # No recargar el HTML en cada actualización del GPS: eso produce
        # parpadeo y devuelve el mapa al centro inicial. Solo se actualiza
        # al obtener la primera ubicación o tras una petición explícita.
        if not had_location or self.location_request_pending:
            self.location_request_pending = False
            self.refresh_map()

    def _filter_by_radius(self, tiendas):
        if not self.user_location or not self.filter_radius_checkbox.isChecked():
            return list(tiendas)
        radius_km = float(self.radius_spin.value())
        if radius_km <= 0:
            return list(tiendas)

        user_lat, user_lng = self.user_location
        filtered = []
        for tienda in tiendas:
            t_id, nombre, cat, lat, lng, wa, dir_txt = tienda[:7]
            distance = haversine_km(user_lat, user_lng, lat, lng)
            if distance <= radius_km:
                filtered.append(tienda)
        return filtered

    def _on_radius_filter_changed(self, _=None):
        app_config.update_config("radius_filter_enabled", self.filter_radius_checkbox.isChecked())
        app_config.update_config("radius_km", float(self.radius_spin.value()))
        self.cfg["radius_filter_enabled"] = self.filter_radius_checkbox.isChecked()
        self.cfg["radius_km"] = float(self.radius_spin.value())
        self.refresh_map()

    # ---------- MAPA ----------
    def refresh_map(self):
        self.tiendas_actuales = self._filter_by_radius(
            database.get_tiendas_por_categoria(self.current_category)
        )
        self._render_map_async()

    def _sync_external_store_changes(self):
        stores = self._filter_by_radius(
            database.get_tiendas_por_categoria(self.current_category)
        )
        snapshot = tuple(tuple(store) for store in stores)
        if snapshot == self.map_store_snapshot:
            return
        self.tiendas_actuales = stores
        self._render_map_async()

    def filter_category(self, category):
        self.current_category = category
        self.refresh_map()

    def _render_map_async(self):
        if self.map_worker and self.map_worker.isRunning():
            self.map_refresh_pending = True
            return
        self.map_store_snapshot = tuple(tuple(store) for store in self.tiendas_actuales)
        categorias = database.get_all_categorias()
        center_lat = self.cfg.get("map_center_lat", -12.0864)
        center_lng = self.cfg.get("map_center_lng", -77.0358)
        if self.user_location:
            center_lat, center_lng = self.user_location
        # El tema UI (oscuro/claro) no debe cambiar el estilo del mapa.
        # El mapa se mantiene siempre en modo claro.
        self.map_worker = MapWorker(
            self.tiendas_actuales, categorias,
            center_lat, center_lng,
            self.cfg["map_zoom"], False,
            self.user_location,
            float(self.radius_spin.value()) if self.user_location else None,
            self.user_location_label,
        )
        self.map_worker.finished_with_path.connect(self._on_map_ready)
        self.map_worker.start()
        self.status.showMessage("Generando mapa...")

    def _on_map_ready(self, path):
        self._map_document_ready = False
        # Inyectar el WebChannel después de cargar
        self.web_view.loadFinished.connect(self._inject_bridge_once)
        self.web_view.setUrl(QUrl.fromLocalFile(path))
        self.status.showMessage("Mapa actualizado ✓", 3000)
        if self.map_refresh_pending:
            self.map_refresh_pending = False
            QTimer.singleShot(0, self._render_map_async)

    def _inject_bridge_once(self, ok):
        if not ok:
            return
        try:
            self.web_view.page().setWebChannel(self.channel)
        except Exception as e:
            print(f"[Bridge] Error: {e}")
        # Desconectar para no reinjectar en cada load
        try:
            self.web_view.loadFinished.disconnect(self._inject_bridge_once)
        except TypeError:
            pass
        self._map_document_ready = True
        if self._delivery_point_picker_pending:
            self.web_view.page().runJavaScript(
                "if (window.fiestaSetDeliveryPointPicker) window.fiestaSetDeliveryPointPicker(true);"
            )
        self._request_delivery_route()

    def _enable_delivery_point_picker(self):
        self._delivery_point_picker_pending = True
        if self._map_document_ready:
            self.web_view.page().runJavaScript(
                "if (window.fiestaSetDeliveryPointPicker) window.fiestaSetDeliveryPointPicker(true);"
            )
        self.location_status.setText("Haz clic en el mapa en el punto exacto de entrega.")

    def _set_delivery_point_from_map(self, latitude, longitude):
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return
        self._delivery_point_picker_pending = False
        self.user_location = (latitude, longitude)
        self.user_location_accuracy_meters = 0
        self.user_location_label = "Punto de entrega elegido en el mapa"
        self.checkout_location_prompted = False
        self._refresh_cart()
        self.location_status.setText(
            f"📍 Punto de entrega: {latitude:.6f}, {longitude:.6f}"
        )
        self.refresh_map()
        self.status.showMessage("Punto de entrega guardado para este pedido", 5000)

    def _request_delivery_route(self):
        self._route_request_id += 1
        self._route_request_pending = True
        if self._map_document_ready:
            self.web_view.page().runJavaScript(
                "if (window.fiestaClearRoadRoute) window.fiestaClearRoadRoute();"
            )
        if self._route_worker and self._route_worker.isRunning():
            return
        self._start_pending_delivery_route()

    def _start_pending_delivery_route(self):
        if not self._route_request_pending or not self._map_document_ready:
            return
        self._route_request_pending = False
        if not self.current_tienda or not self.user_location:
            if self.current_tienda and not self.user_location:
                self.status.showMessage(
                    "Busca y selecciona la dirección del cliente para trazar la ruta vial.",
                    7000,
                )
            return

        request_id = self._route_request_id
        origin = (float(self.current_tienda[3]), float(self.current_tienda[4]))
        destination = self.user_location
        worker = RoadRouteWorker(request_id, origin, destination, self)
        self._route_worker = worker
        worker.route_ready.connect(self._on_delivery_route_ready)
        worker.finished.connect(lambda worker=worker: self._finish_delivery_route_worker(worker))
        worker.start()
        self.status.showMessage("Calculando la ruta vial más corta...")

    def _on_delivery_route_ready(self, request_id, route, error):
        if request_id != self._route_request_id or not self._map_document_ready:
            return
        if error:
            self.status.showMessage(f"No se pudo calcular la ruta vial: {error}", 7000)
            return
        points = json.dumps(route["coordinates"], separators=(",", ":"))
        self.web_view.page().runJavaScript(
            f"if (window.fiestaDrawRoadRoute) window.fiestaDrawRoadRoute({points});"
        )
        distance_km = route["distance_m"] / 1000
        self.status.showMessage(f"Ruta vial más corta encontrada: {distance_km:.2f} km", 6000)

    def _finish_delivery_route_worker(self, worker):
        if self._route_worker is worker:
            self._route_worker = None
        if self._route_request_pending:
            self._start_pending_delivery_route()

    def _handle_map_url(self, url):
        fragment = url.fragment()
        if fragment.startswith("delivery-point="):
            try:
                latitude, longitude = map(
                    float, fragment.split("=", 1)[1].split(",", 1)
                )
                self._set_delivery_point_from_map(latitude, longitude)
            except (ValueError, TypeError):
                pass
            return
        if not fragment.startswith("tienda="):
            return
        try:
            tienda_id = int(fragment.split("=", 1)[1])
            self.load_tienda_details(tienda_id)
        except (ValueError, TypeError):
            pass

    def load_tienda_details(self, tienda_id: int):
        self.current_tienda = database.get_tienda_by_id(tienda_id)
        if not self.current_tienda:
            return

        t_id, nombre, cat, lat, lng, _whatsapp, direccion = self.current_tienda[:7]
        is_open = bool(self.current_tienda[9]) if len(self.current_tienda) > 9 else True
        status_text = "Abierta" if is_open else "Cerrada"
        status_color = "#228553" if is_open else "#c23b3b"
        info = (
            f"<h3 style='margin:4px'>{html.escape(str(nombre))}</h3>"
            f"<p style='margin:4px'><b>Categoría:</b> {html.escape(str(cat))}<br>"
            f"<b>Dirección:</b> {html.escape(str(direccion or '-'))}<br>"
            f"<b>Estado:</b> <span style='color:{status_color}'>{status_text}</span></p>"
            f"{free_delivery_details_html(self.current_tienda)}"
            f"<p style='margin:4px'><b>Selecciona productos para armar tu pedido:</b></p>"
        )
        self.detail_label.setText(info)

        self.list_productos.clear()
        for p in database.get_productos_by_tienda(t_id):
            p_id, _, p_nombre, p_precio, stock = p[:5]
            item = QListWidgetItem(
                f"  {p_nombre}  —  $ {p_precio:.2f}  | Disponible: {stock}"
            )
            item.setData(Qt.ItemDataRole.UserRole, (p_id, p_nombre, float(p_precio), int(stock)))
            if stock <= 0:
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEnabled)
            self.list_productos.addItem(item)

        self.product_quantity.setValue(1)
        self.product_quantity.setEnabled(False)
        self.stock_status.setText("Disponible: -")

        self.status.showMessage(f"Tienda seleccionada: {nombre}", 3000)
        self._request_delivery_route()

    def _on_product_selection_changed(self):
        item = self.list_productos.currentItem()
        data = item.data(Qt.ItemDataRole.UserRole) if item else None
        if not data or not self.current_tienda:
            self.btn_add_cart.setEnabled(False)
            self.product_quantity.setEnabled(False)
            self.stock_status.setText("Disponible: -")
            return
        stock = data[3]
        self.product_quantity.setRange(1, max(stock, 1))
        self.product_quantity.setValue(1)
        self.product_quantity.setEnabled(stock > 0)
        self.stock_status.setText(f"Disponible: {stock}")
        self.btn_add_cart.setEnabled(stock > 0)

    def eventFilter(self, watched, event):
        if (
            hasattr(self, "list_productos")
            and watched is self.list_productos.viewport()
            and event.type() == QEvent.Type.Leave
        ):
            self.product_hover_show_timer.stop()
        return super().eventFilter(watched, event)

    def _schedule_product_hover_info(self, item):
        product_data = item.data(Qt.ItemDataRole.UserRole)
        if not product_data:
            return
        self.hovered_product_id = product_data[0]
        self.product_hover_hide_timer.stop()
        self.product_hover_show_timer.start()
        if self.product_hover_fade_animation:
            self.product_hover_fade_animation.stop()
            if self.product_hover_dialog:
                self.product_hover_dialog.setWindowOpacity(1.0)

    def _show_product_hover_info(self):
        product_id = self.hovered_product_id
        if product_id is None or not self.current_tienda:
            return
        product = database.get_producto_by_id(product_id)
        if product is None:
            return

        if self.product_hover_dialog:
            if self.product_hover_dialog.product_id == product_id:
                self.product_hover_dialog.setWindowOpacity(1.0)
                self.product_hover_hide_timer.start()
                return
            self.product_hover_dialog.close()

        dialog = ProductoInfoDialog(product, self.current_tienda[1], self)
        dialog.product_id = product_id
        dialog.set_hover_preview()
        dialog.setWindowOpacity(1.0)
        dialog.pointer_entered.connect(self._on_product_hover_dialog_entered)
        dialog.pointer_left.connect(self._on_product_hover_dialog_left)
        dialog.finished.connect(lambda _result: self._clear_product_hover_dialog(dialog))
        dialog.adjustSize()

        cursor = QCursor.pos()
        screen = QApplication.screenAt(cursor) or QApplication.primaryScreen()
        bounds = screen.availableGeometry()
        map_origin = self.web_view.mapToGlobal(QPoint(12, 12))
        x = map_origin.x()
        if x + dialog.width() > bounds.right():
            x = bounds.right() - dialog.width()
        if x < bounds.left():
            x = cursor.x() + 18
        y = cursor.y() + 18
        if y + dialog.height() > bounds.bottom():
            y = cursor.y() - dialog.height() - 18
        dialog.move(
            max(bounds.left(), min(x, bounds.right() - dialog.width())),
            max(bounds.top(), min(y, bounds.bottom() - dialog.height())),
        )
        self.product_hover_dialog = dialog
        dialog.show()
        self.product_hover_hide_timer.start()

    def _on_product_hover_dialog_entered(self):
        self.product_hover_hide_timer.stop()
        if self.product_hover_fade_animation:
            self.product_hover_fade_animation.stop()
            self.product_hover_dialog.setWindowOpacity(1.0)

    def _on_product_hover_dialog_left(self):
        self.product_hover_hide_timer.start()

    def _fade_product_hover_info(self):
        dialog = self.product_hover_dialog
        if not dialog or not dialog.isVisible():
            return
        animation = QPropertyAnimation(dialog, b"windowOpacity", self)
        animation.setDuration(250)
        animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        animation.setStartValue(dialog.windowOpacity())
        animation.setEndValue(0.0)
        animation.finished.connect(dialog.close)
        self.product_hover_fade_animation = animation
        animation.start()

    def _clear_product_hover_dialog(self, dialog):
        if self.product_hover_dialog is dialog:
            self.product_hover_dialog = None
            self.product_hover_fade_animation = None

    def _show_product_context_menu(self, pos):
        item = self.list_productos.itemAt(pos)
        if item is None:
            return
        product_id = item.data(Qt.ItemDataRole.UserRole)[0]
        product = database.get_producto_by_id(product_id)
        if product is None:
            return
        menu = QMenu(self)
        info_action = menu.addAction("Más información")
        action = menu.exec(self.list_productos.mapToGlobal(pos))
        if action == info_action:
            ProductoInfoDialog(product, self.current_tienda[1], self).exec()

    # ---------- CARRITO ----------
    def add_to_cart(self):
        item = self.list_productos.currentItem()
        if not item or not self.current_tienda:
            return
        prod_id, p_nombre, p_precio, stock = item.data(Qt.ItemDataRole.UserRole)
        quantity = self.product_quantity.value()
        if quantity > stock:
            QMessageBox.warning(self, "Stock insuficiente", "La cantidad solicitada supera el stock disponible.")
            return
        t_id, nombre_t = self.current_tienda[0], self.current_tienda[1]
        self.cart.append((prod_id, p_nombre, p_precio, t_id, nombre_t, quantity))
        self._refresh_cart()
        self.status.showMessage(f"✓ {quantity} unidad(es) de '{p_nombre}' agregada(s)", 2000)

    def clear_cart(self):
        self.cart.clear()
        self._refresh_cart()

    def remove_from_cart(self, item):
        row = self.list_cart.row(item)
        if 0 <= row < len(self.cart):
            self.cart.pop(row)
            self._refresh_cart()

    def _refresh_customer_order_progress(self):
        token = getattr(self, "customer_order_token", "")
        order = database.get_order_by_tracking_token(token) if token else None
        if not order:
            self.customer_order_progress.clear()
            self.customer_order_progress.hide()
            return
        self.customer_order_progress.setText(customer_order_progress_html(order))
        self.customer_order_progress.show()

    def _show_cart_context_menu(self, pos):
        item = self.list_cart.itemAt(pos)
        if item is None:
            return
        menu = QMenu(self)
        remove_action = menu.addAction("Quitar este producto")
        action = menu.exec(self.list_cart.mapToGlobal(pos))
        if action == remove_action:
            self.remove_from_cart(item)

    def _refresh_cart(self):
        self.list_cart.clear()
        total = 0.0
        for (_, nombre, precio, _, tienda, quantity) in self.cart:
            self.list_cart.addItem(
                f"[{tienda}] {quantity} x {nombre} — $ {precio * quantity:.2f}"
            )
            total += precio * quantity
        self.cart_label.setText(f"Total: $ {total:.2f}   ({len(self.cart)} items)")
        can_send = bool(self.cart) and (
            self.user_location is not None or not self.checkout_location_prompted
        )
        self.btn_whatsapp.setEnabled(can_send)
        self.btn_whatsapp.setText(
            "📲 Enviar pedido por WhatsApp"
            if self.user_location is not None or not self.checkout_location_prompted
            else "Elige ubicación para continuar"
        )

    def send_cart_whatsapp(self):
        if not self.cart:
            return
        if not self.user_location:
            self.checkout_location_prompted = True
            self._refresh_cart()
            QMessageBox.warning(
                self,
                "Ubicación requerida",
                "Antes de enviar el pedido por WhatsApp, elige la ubicación de entrega. "
                "Puedes buscar una dirección, pegar coordenadas o marcar el punto en el mapa.",
            )
            return
        # Agrupar por tienda (el primer item determina la tienda destino del pedido)
        # En una versión avanzada se podrían crear múltiples pedidos.
        target_tienda_id = self.cart[0][3]
        target_tienda = database.get_tienda_by_id(target_tienda_id)
        wa = target_tienda[5]
        nombre_t = target_tienda[1]

        confirmation = QMessageBox(self)
        confirmation.setWindowTitle("Confirmar pedido")
        confirmation.setText(
            "Asegúrese de verificar su producto y haga clic en Aceptar "
            "para mandar el mensaje."
        )
        confirmation.setStandardButtons(
            QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Ok
        )
        confirmation.setDefaultButton(QMessageBox.StandardButton.Ok)
        confirmation.button(QMessageBox.StandardButton.Ok).setText("Aceptar")
        confirmation.button(QMessageBox.StandardButton.Cancel).setText("Cancelar")
        if confirmation.exec() != QMessageBox.StandardButton.Ok:
            return

        total = sum(item[2] * item[5] for item in self.cart)
        tracking_token = secrets.token_urlsafe(32)
        order_items = [
            {
                "product_id": product_id,
                "nombre": nombre,
                "precio": float(price),
                "cantidad": quantity,
            }
            for product_id, nombre, price, _, _, quantity in self.cart
        ]
        try:
            order_id = database.create_order(
                target_tienda_id,
                tracking_token,
                order_items,
                total,
                self.user_location[0],
                self.user_location[1],
            )
        except ValueError as error:
            QMessageBox.warning(self, "Stock actualizado", str(error))
            self.load_tienda_details(target_tienda_id)
            return
        self.customer_order_token = tracking_token
        app_config.update_config("customer_order_token", tracking_token)
        self._refresh_customer_order_progress()

        lines = [
            f"¡Hola {nombre_t}!",
            "",
            "Quisiera hacer el siguiente pedido desde la AppFiesta:",
            f"Pedido #{order_id}",
            "",
        ]
        for i, (_, nombre, precio, _, _, quantity) in enumerate(self.cart, 1):
            lines.append(f"{i}. {quantity} x {nombre} — $ {precio * quantity:.2f}")
        if self.user_location:
            latitude, longitude = self.user_location
            lines.extend([
                "",
                "Ubicación de entrega: "
                + routing.openstreetmap_location_url(latitude, longitude),
                "📋 Coordenadas para copiar:",
                "```",
                f"{latitude:.6f}, {longitude:.6f}",
                "```",
            ])
        lines.append("")
        lines.append(f"*Total: $ {total:.2f}*")
        lines.append("")
        lines.append("¿Me podrías confirmar disponibilidad y tiempo de entrega? ¡Gracias!")

        msg = "\n".join(lines)
        url = f"https://wa.me/{wa}?text={urllib.parse.quote(msg)}"
        webbrowser.open(url)
        self.cart.clear()
        self._refresh_cart()
        self.load_tienda_details(target_tienda_id)
        self.status.showMessage("Abriendo WhatsApp...", 3000)

    # ---------- TEMA ----------
    def toggle_theme(self):
        self.dark_mode = not self.dark_mode
        app_config.update_config("theme", "dark" if self.dark_mode else "light")
        self._apply_theme()
        self.refresh_map()

    # ---------- ADMIN ----------
    def _prompt_admin_password(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("Acceso Admin")
        dialog.setMinimumWidth(360)
        layout = QVBoxLayout(dialog)
        layout.addWidget(QLabel("Ingresa la contraseña de administrador:"))

        password_row = QHBoxLayout()
        password_input = QLineEdit(dialog)
        password_input.setEchoMode(QLineEdit.EchoMode.Password)
        password_toggle = QToolButton(dialog)
        password_toggle.setText("👁")
        password_toggle.setToolTip("Mostrar contraseña")
        password_toggle.setAccessibleName("Mostrar contraseña")
        password_toggle.setCheckable(True)

        def set_password_visibility(visible):
            password_input.setEchoMode(
                QLineEdit.EchoMode.Normal if visible else QLineEdit.EchoMode.Password
            )
            label = "Ocultar contraseña" if visible else "Mostrar contraseña"
            password_toggle.setToolTip(label)
            password_toggle.setAccessibleName(label)

        password_toggle.toggled.connect(set_password_visibility)
        password_row.addWidget(password_input)
        password_row.addWidget(password_toggle)
        layout.addLayout(password_row)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel,
            parent=dialog,
        )
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        password_input.setFocus()
        accepted = dialog.exec() == QDialog.DialogCode.Accepted
        return password_input.text(), accepted

    def open_admin(self):
        pwd, ok = self._prompt_admin_password()
        if not ok:
            return
        if pwd != self.cfg["admin_password"]:
            QMessageBox.warning(self, "Acceso denegado", "Contraseña incorrecta.")
            return

        dlg = AdminDialog(self)
        dlg.exec()
        # Refrescar mapa y filtros tras cambios
        self._refresh_filters()
        self.refresh_map()

    def show_about(self):
        QMessageBox.about(
            self,
            "Acerca de",
            "<h3>🎈 Directorio de Fiestas y Eventos</h3>"
            "<p>Aplicación de escritorio en Python + PyQt6 + Folium.</p>"
            "<p>Mapa: OpenStreetMap (gratuito, sin límites).</p>"
            "<p>Base de datos: SQLite local.</p>"
            "<p>Contacto directo vía WhatsApp Web.</p>"
        )


# =================== PANEL DE ADMINISTRACIÓN ===================
class AdminDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("🔐 Panel de Administración")
        self.resize(820, 560)
        layout = QVBoxLayout(self)

        tabs = QTabWidget()
        tabs.addTab(self._build_tiendas_tab(), "🏪 Tiendas")
        tabs.addTab(self._build_productos_tab(), "📦 Productos")
        tabs.addTab(self._build_categorias_tab(), "🏷 Categorías")
        tabs.addTab(self._build_owner_accounts_tab(), "🔑 Accesos")
        layout.addWidget(tabs)

        btn_close = QPushButton("Cerrar")
        btn_close.clicked.connect(self.accept)
        layout.addWidget(btn_close)

    # ---- Accesos de propietarios ----
    def _build_owner_accounts_tab(self):
        w = QWidget()
        v = QVBoxLayout(w)
        v.addWidget(QLabel("<b>Crear acceso para una tienda:</b>"))

        form = QFormLayout()
        self.owner_store_combo = QComboBox()
        self._refresh_owner_store_combo()
        self.owner_username_input = QLineEdit()
        self.owner_username_input.setPlaceholderText("Ej. torteria.lima")
        form.addRow("Tienda:", self.owner_store_combo)
        form.addRow("Usuario:", self.owner_username_input)
        v.addLayout(form)

        b_create = QPushButton("Crear acceso")
        b_create.clicked.connect(self._create_owner_account)
        v.addWidget(b_create)

        v.addWidget(QLabel("<b>Cuentas existentes:</b>"))
        self.owner_accounts_list = QListWidget()
        self.owner_accounts_list.currentItemChanged.connect(self._owner_account_selected)
        v.addWidget(self.owner_accounts_list)

        actions = QHBoxLayout()
        self.owner_toggle_button = QPushButton("Desactivar acceso")
        self.owner_toggle_button.setEnabled(False)
        self.owner_toggle_button.clicked.connect(self._toggle_owner_account)
        self.owner_reset_button = QPushButton("Restablecer contraseña")
        self.owner_reset_button.setEnabled(False)
        self.owner_reset_button.clicked.connect(self._reset_owner_password)
        actions.addWidget(self.owner_toggle_button)
        actions.addWidget(self.owner_reset_button)
        v.addLayout(actions)
        self._refresh_owner_accounts_list()
        return w

    def _refresh_owner_store_combo(self):
        self.owner_store_combo.clear()
        for store in database.get_all_tiendas():
            self.owner_store_combo.addItem(f"{store[1]} (#{store[0]})", store[0])

    def _refresh_owner_accounts_list(self):
        self.owner_accounts_list.clear()
        for store_id, store_name, username, active in database.get_store_owner_accounts():
            item = QListWidgetItem(
                f"{store_name} · {username} · {'Activa' if active else 'Suspendida'}"
            )
            item.setData(Qt.ItemDataRole.UserRole, (username, bool(active)))
            self.owner_accounts_list.addItem(item)

    def _owner_account_selected(self, current, _previous):
        selected = current is not None
        self.owner_toggle_button.setEnabled(selected)
        self.owner_reset_button.setEnabled(selected)
        if selected:
            username, active = current.data(Qt.ItemDataRole.UserRole)
            self.owner_toggle_button.setText(
                "Desactivar acceso" if active else "Reactivar acceso"
            )

    def _show_selectable_owner_message(self, title, text):
        message = QMessageBox(self)
        message.setWindowTitle(title)
        message.setIcon(QMessageBox.Icon.Information)
        message.setText(text)
        message.setTextInteractionFlags(
            Qt.TextInteractionFlag.TextSelectableByMouse
            | Qt.TextInteractionFlag.TextSelectableByKeyboard
        )
        message.setStandardButtons(QMessageBox.StandardButton.Ok)
        message.exec()

    def _create_owner_account(self):
        store_id = self.owner_store_combo.currentData()
        username = self.owner_username_input.text().strip()
        if store_id is None or not username:
            QMessageBox.warning(self, "Datos incompletos", "Selecciona una tienda e ingresa un usuario.")
            return
        password = secrets.token_urlsafe(12)
        try:
            database.create_store_owner(store_id, username, password)
        except ValueError as exc:
            QMessageBox.warning(self, "No se pudo crear", str(exc))
            return
        self.owner_username_input.clear()
        self._refresh_owner_accounts_list()
        self._show_selectable_owner_message(
            "Acceso creado",
            f"Usuario: {username.lower()}\nContraseña temporal: {password}\n\n"
            "Entrégala al dueño por un canal privado. Se mostrará solo esta vez.",
        )

    def _toggle_owner_account(self):
        item = self.owner_accounts_list.currentItem()
        if not item:
            return
        username, active = item.data(Qt.ItemDataRole.UserRole)
        database.set_store_owner_active(username, not active)
        self._refresh_owner_accounts_list()

    def _reset_owner_password(self):
        item = self.owner_accounts_list.currentItem()
        if not item:
            return
        username, _active = item.data(Qt.ItemDataRole.UserRole)
        password = secrets.token_urlsafe(12)
        if database.reset_store_owner_password(username, password):
            self._show_selectable_owner_message(
                "Contraseña restablecida",
                f"Usuario: {username}\nNueva contraseña temporal: {password}\n\n"
                "Entrégala al dueño por un canal privado. Se mostrará solo esta vez.",
            )

    # ---- Tiendas ----
    def _build_tiendas_tab(self):
        w = QWidget()
        v = QVBoxLayout(w)
        self.list_tiendas = QListWidget()
        self.list_tiendas.itemSelectionChanged.connect(self._load_tienda_into_form)
        v.addWidget(QLabel("<b>Lista de tiendas:</b>"))
        v.addWidget(self.list_tiendas)

        form = QFormLayout()
        self.t_nombre = QLineEdit()
        self.t_cat = QComboBox()
        self._refresh_categorias_combo()
        self.t_lat = QDoubleSpinBox()
        self.t_lat.setRange(-90, 90)
        self.t_lat.setDecimals(6)
        self.t_lng = QDoubleSpinBox()
        self.t_lng.setRange(-180, 180)
        self.t_lng.setDecimals(6)
        self.t_wa = QLineEdit()
        self.t_dir = QLineEdit()
        self.t_fachada = QLineEdit()
        b_fachada = QPushButton("Seleccionar foto de fachada")
        b_fachada.clicked.connect(self._select_store_image)
        form.addRow("Nombre*:", self.t_nombre)
        form.addRow("Categoría*:", self.t_cat)
        form.addRow("Lat*:", self.t_lat)
        form.addRow("Lng*:", self.t_lng)
        form.addRow("WhatsApp*:", self.t_wa)
        form.addRow("Dirección:", self.t_dir)
        form.addRow("Foto fachada:", self.t_fachada)
        form.addRow("", b_fachada)
        v.addLayout(form)

        btn_row = QHBoxLayout()
        b_new = QPushButton("➕ Nueva")
        b_new.clicked.connect(self._new_tienda)
        b_save = QPushButton("💾 Guardar")
        b_save.clicked.connect(self._save_tienda)
        b_del = QPushButton("🗑 Eliminar")
        b_del.clicked.connect(self._del_tienda)
        btn_row.addWidget(b_new)
        btn_row.addWidget(b_save)
        btn_row.addWidget(b_del)
        v.addLayout(btn_row)
        self._refresh_tiendas_list()
        return w

    def _refresh_tiendas_list(self):
        self.list_tiendas.clear()
        for t in database.get_all_tiendas():
            self.list_tiendas.addItem(f"[{t[0]}] {t[1]}  —  {t[2]}")

    def _refresh_categorias_combo(self):
        self.t_cat.clear()
        for c in database.get_all_categorias():
            self.t_cat.addItem(c[0])

    def _load_tienda_into_form(self):
        item = self.list_tiendas.currentItem()
        if not item:
            return
        tienda_id = int(item.text().split("]")[0].strip("["))
        tienda = database.get_tienda_by_id(tienda_id)
        if tienda:
            _, nombre, cat, lat, lng, wa, dir_txt, fachada = tienda[:8]
            self.t_nombre.setText(nombre)
            idx = self.t_cat.findText(cat)
            if idx >= 0:
                self.t_cat.setCurrentIndex(idx)
            self.t_lat.setValue(lat)
            self.t_lng.setValue(lng)
            self.t_wa.setText(wa or "")
            self.t_dir.setText(dir_txt or "")
            self.t_fachada.setText(fachada or "")

    def _new_tienda(self):
        self.t_nombre.clear()
        self.t_lat.setValue(self.parent().cfg["map_center_lat"] if self.parent() else -12.0864)
        self.t_lng.setValue(self.parent().cfg["map_center_lng"] if self.parent() else -77.0358)
        self.t_wa.clear()
        self.t_dir.clear()
        self.t_fachada.clear()
        self.list_tiendas.clearSelection()

    def _select_store_image(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Seleccionar foto de fachada", "",
            "Imágenes (*.png *.jpg *.jpeg *.webp)"
        )
        if path:
            self.t_fachada.setText(path)

    def _save_tienda(self):
        nombre = self.t_nombre.text().strip()
        cat = self.t_cat.currentText()
        wa = self.t_wa.text().strip()
        if not (nombre and cat and wa):
            QMessageBox.warning(self, "Datos incompletos", "Nombre, categoría y WhatsApp son obligatorios.")
            return
        item = self.list_tiendas.currentItem()
        if item:
            tienda_id = int(item.text().split("]")[0].strip("["))
            database.update_tienda(tienda_id, nombre, cat, self.t_lat.value(),
                                   self.t_lng.value(), wa, self.t_dir.text().strip(),
                                   self.t_fachada.text().strip())
        else:
            database.add_tienda(nombre, cat, self.t_lat.value(),
                                self.t_lng.value(), wa, self.t_dir.text().strip(),
                                self.t_fachada.text().strip())
        self._refresh_tiendas_list()
        self._refresh_owner_store_combo()
        QMessageBox.information(self, "OK", "Tienda guardada.")

    def _del_tienda(self):
        item = self.list_tiendas.currentItem()
        if not item:
            return
        tienda_id = int(item.text().split("]")[0].strip("["))
        if QMessageBox.question(self, "Confirmar", "¿Eliminar tienda y todos sus productos?") \
                != QMessageBox.StandardButton.Yes:
            return
        database.delete_tienda(tienda_id)
        self._refresh_tiendas_list()
        self._refresh_owner_store_combo()
        self._refresh_owner_accounts_list()
        self._new_tienda()

    # ---- Productos ----
    def _build_productos_tab(self):
        w = QWidget()
        v = QVBoxLayout(w)
        self.combo_prod_tienda = QComboBox()
        self._refresh_tiendas_combo()
        self.combo_prod_tienda.currentIndexChanged.connect(self._refresh_productos_list)
        v.addWidget(QLabel("<b>Tienda:</b>"))
        v.addWidget(self.combo_prod_tienda)

        self.list_productos_admin = QListWidget()
        self.list_productos_admin.itemSelectionChanged.connect(self._load_producto_into_form)
        v.addWidget(QLabel("<b>Productos:</b>"))
        v.addWidget(self.list_productos_admin)

        form = QFormLayout()
        self.p_nombre = QLineEdit()
        self.p_precio = QDoubleSpinBox()
        self.p_precio.setRange(0, 999999)
        self.p_precio.setDecimals(2)
        self.p_precio.setPrefix("$ ")
        self.p_stock = QSpinBox()
        self.p_stock.setRange(0, 999999)
        self.p_descripcion = QTextEdit()
        self.p_descripcion.setFixedHeight(70)
        self.p_imagenes = QListWidget()
        self.p_imagenes.setMaximumHeight(80)
        b_add_image = QPushButton("Agregar foto")
        b_add_image.clicked.connect(self._add_product_images)
        b_remove_image = QPushButton("Quitar foto seleccionada")
        b_remove_image.clicked.connect(self._remove_product_image)
        form.addRow("Nombre*:", self.p_nombre)
        form.addRow("Precio*:", self.p_precio)
        form.addRow("Stock disponible:", self.p_stock)
        form.addRow("Descripción:", self.p_descripcion)
        form.addRow("Fotos:", self.p_imagenes)
        form.addRow("", b_add_image)
        form.addRow("", b_remove_image)
        v.addLayout(form)

        btn_row = QHBoxLayout()
        b_new = QPushButton("➕ Nuevo")
        b_new.clicked.connect(self._new_producto)
        b_save = QPushButton("💾 Guardar")
        b_save.clicked.connect(self._save_producto)
        b_del = QPushButton("🗑 Eliminar")
        b_del.clicked.connect(self._del_producto)
        btn_row.addWidget(b_new)
        btn_row.addWidget(b_save)
        btn_row.addWidget(b_del)
        v.addLayout(btn_row)
        return w

    def _refresh_tiendas_combo(self):
        self.combo_prod_tienda.clear()
        for t in database.get_all_tiendas():
            self.combo_prod_tienda.addItem(f"{t[0]} - {t[1]}", t[0])

    def _refresh_productos_list(self):
        self.list_productos_admin.clear()
        tienda_id = self.combo_prod_tienda.currentData()
        if tienda_id:
            for p in database.get_productos_by_tienda(tienda_id):
                self.list_productos_admin.addItem(
                    f"[{p[0]}] {p[2]} — $ {p[3]:.2f} | Stock: {p[4]}"
                )

    def _load_producto_into_form(self):
        item = self.list_productos_admin.currentItem()
        if not item:
            return
        product_id = int(item.text().split("]")[0].strip("["))
        product = database.get_producto_by_id(product_id)
        if product:
            _, _, nombre, precio, stock, descripcion, imagen, imagenes = product[:8]
            self.p_nombre.setText(nombre)
            self.p_precio.setValue(precio)
            self.p_stock.setValue(stock)
            self.p_descripcion.setPlainText(descripcion or "")
            self.p_imagenes.clear()
            for path in _decode_image_paths(imagen, imagenes):
                self.p_imagenes.addItem(path)

    def _new_producto(self):
        self.list_productos_admin.clearSelection()
        self.p_nombre.clear()
        self.p_precio.setValue(0)
        self.p_stock.setValue(0)
        self.p_descripcion.clear()
        self.p_imagenes.clear()

    def _add_product_images(self):
        paths, _ = QFileDialog.getOpenFileNames(
            self, "Seleccionar fotos del producto", "",
            "Imágenes (*.png *.jpg *.jpeg *.webp)"
        )
        existing = {self.p_imagenes.item(i).text() for i in range(self.p_imagenes.count())}
        for path in paths:
            if path not in existing:
                self.p_imagenes.addItem(path)
                existing.add(path)

    def _remove_product_image(self):
        row = self.p_imagenes.currentRow()
        if row >= 0:
            self.p_imagenes.takeItem(row)

    def _save_producto(self):
        tienda_id = self.combo_prod_tienda.currentData()
        nombre = self.p_nombre.text().strip()
        if not (tienda_id and nombre):
            QMessageBox.warning(self, "Datos incompletos", "Selecciona tienda y nombre.")
            return
        item = self.list_productos_admin.currentItem()
        if item:
            pid = int(item.text().split("]")[0].strip("["))
            images = [self.p_imagenes.item(i).text() for i in range(self.p_imagenes.count())]
            database.update_producto(
                pid, nombre, self.p_precio.value(), self.p_stock.value(),
                self.p_descripcion.toPlainText().strip(), images,
            )
        else:
            images = [self.p_imagenes.item(i).text() for i in range(self.p_imagenes.count())]
            database.add_producto(
                tienda_id, nombre, self.p_precio.value(), self.p_stock.value(),
                self.p_descripcion.toPlainText().strip(), images,
            )
        self._refresh_productos_list()
        QMessageBox.information(self, "OK", "Producto guardado.")

    def _del_producto(self):
        item = self.list_productos_admin.currentItem()
        if not item:
            return
        pid = int(item.text().split("]")[0].strip("["))
        if QMessageBox.question(self, "Confirmar", "¿Eliminar producto?") \
                != QMessageBox.StandardButton.Yes:
            return
        database.delete_producto(pid)
        self._refresh_productos_list()

    # ---- Categorías ----
    def _build_categorias_tab(self):
        w = QWidget()
        v = QVBoxLayout(w)
        self.list_cats = QListWidget()
        v.addWidget(self.list_cats)

        form = QFormLayout()
        self.c_nombre = QLineEdit()
        self.c_color = QComboBox()
        self.c_color.addItems(["red", "blue", "green", "orange", "purple", "darkred", "cadetblue"])
        form.addRow("Nombre*:", self.c_nombre)
        form.addRow("Color:", self.c_color)
        v.addLayout(form)

        btn_row = QHBoxLayout()
        b_add = QPushButton("➕ Agregar categoría")
        b_add.clicked.connect(self._add_categoria)
        b_del = QPushButton("🗑 Eliminar")
        b_del.clicked.connect(self._del_categoria)
        btn_row.addWidget(b_add)
        btn_row.addWidget(b_del)
        v.addLayout(btn_row)
        self._refresh_categorias_list()
        return w

    def _refresh_categorias_list(self):
        self.list_cats.clear()
        for c in database.get_all_categorias():
            self.list_cats.addItem(c[0])

    def _add_categoria(self):
        nombre = self.c_nombre.text().strip()
        if not nombre:
            return
        database.add_categoria(nombre, self.c_color.currentText())
        self._refresh_categorias_list()
        self._refresh_categorias_combo()
        self.c_nombre.clear()

    def _del_categoria(self):
        item = self.list_cats.currentItem()
        if not item:
            return
        try:
            database.delete_categoria(item.text())
        except ValueError as e:
            QMessageBox.warning(self, "No se puede", str(e))
            return
        self._refresh_categorias_list()
        self._refresh_categorias_combo()


# =================== MAIN ===================
if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName("FiestaApp")
    app.setWindowIcon(QIcon(build_app_logo_pixmap(256)))

    window = FiestaApp()
    splash = AppSplash()
    splash.show()
    app.processEvents()

    def show_main_window():
        window.show()
        window.raise_()
        window.activateWindow()

    QTimer.singleShot(3800, lambda: splash.start_fade_out(show_main_window))

    sys.exit(app.exec())
