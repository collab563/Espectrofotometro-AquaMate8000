import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from PyQt6.QtCore import QUrl

import map_engine
from main import FiestaApp, free_delivery_details_html


def test_map_shows_open_and_closed_status_dots():
    stores = [
        (1, "Open QA Store", "QA Bakery", -12.0, -77.0, "", "", "", "", 1, 1, 750, 125.5),
        (2, "Closed QA Store", "QA Bakery", -12.01, -77.01, "", "", "", "", 0, 0, 20, 0),
    ]
    original_cwd = os.getcwd()

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as directory:
        os.chdir(directory)
        try:
            map_path = map_engine.render_map(
                stores,
                [("QA Bakery", "blue", "birthday-cake")],
                -12.0,
                -77.0,
            )
            generated_map = Path(map_path).read_text(encoding="utf-8")
        finally:
            os.chdir(original_cwd)

    assert 'fiesta-marker-status is-open' in generated_map
    assert 'fiesta-marker-status is-closed' in generated_map
    assert "Estado: Abierta" in generated_map
    assert "Estado: Cerrada" in generated_map
    assert "Radio máximo" not in generated_map
    assert "Pago mínimo de compra" not in generated_map
    assert "Envío gratis" not in generated_map
    assert "window.fiestaDrawRoadRoute" in generated_map
    assert 'color: "#0878f9"' in generated_map
    assert "window.fiestaSetDeliveryPointPicker" in generated_map
    assert "delivery-point=" in generated_map
    picker_listener = generated_map.index('.on("click", function(event)')
    map_initialization = generated_map.index(" = L.map(")
    listener_timer = generated_map.rfind("setTimeout(function() {", 0, picker_listener)
    assert 0 <= listener_timer < picker_listener < map_initialization
    assert generated_map.index("}, 0);", picker_listener) < map_initialization
    assert ".fiesta-marker-status.is-open { background: #20b765; }" in generated_map
    assert ".fiesta-marker-status.is-closed { background: #e03737; }" in generated_map


def test_map_centers_on_selected_address_coordinates():
    original_cwd = os.getcwd()
    selected_location = (-8.0599454, -79.0618876)

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as directory:
        os.chdir(directory)
        try:
            map_path = map_engine.render_map(
                [],
                [],
                *selected_location,
                user_location=selected_location,
                user_location_label="Selected address",
            )
            generated_map = Path(map_path).read_text(encoding="utf-8")
        finally:
            os.chdir(original_cwd)

    assert "center: [-8.0599454, -79.0618876]" in generated_map
    assert "Selected address" in generated_map


def test_store_delivery_details_only_show_when_enabled():
    enabled_store = (1, "Store", "Bakery", 0, 0, "", "", "", "", 1, 1, 750, 125.5)
    disabled_store = (2, "Store", "Bakery", 0, 0, "", "", "", "", 1, 0, 20, 0)

    details = free_delivery_details_html(enabled_store)

    assert "Radio máximo:</b> 750 m" in details
    assert "Pago mínimo de compra para envío gratis:</b> S/ 125.50" in details
    assert "Envío gratis:</b>" not in details
    assert free_delivery_details_html(disabled_store) == ""


def test_desktop_map_click_hash_saves_the_delivery_point():
    selected_points = []
    app = SimpleNamespace(
        _set_delivery_point_from_map=lambda latitude, longitude: selected_points.append(
            (latitude, longitude)
        )
    )

    FiestaApp._handle_map_url(
        app,
        QUrl("file:///map_view.html#delivery-point=-12.0464,-77.0428"),
    )

    assert selected_points == [(-12.0464, -77.0428)]


def test_desktop_map_delivery_point_updates_location_and_map():
    app = SimpleNamespace(
        _delivery_point_picker_pending=True,
        user_location=None,
        user_location_accuracy_meters=None,
        user_location_label="",
        location_status=Mock(),
        _refresh_cart=Mock(),
        refresh_map=Mock(),
        status=Mock(),
    )

    FiestaApp._set_delivery_point_from_map(app, -12.0464, -77.0428)

    assert app.user_location == (-12.0464, -77.0428)
    assert app.user_location_accuracy_meters == 0
    assert app.user_location_label == "Punto de entrega elegido en el mapa"
    assert app._delivery_point_picker_pending is False
    app._refresh_cart.assert_called_once()
    app.refresh_map.assert_called_once()