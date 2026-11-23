"""
map_engine.py — Genera el HTML del mapa con Folium.
Soporta marcadores clickables que disparan callbacks en Python
vía un puente JavaScript-Python (window.qtBridge).
"""
import folium
import os
import html
from typing import List, Tuple

TILES_LIGHT = "OpenStreetMap"
TILES_DARK = "CartoDB dark_matter"
MARKER_COLORS = {
    "red": "#d84a4a",
    "darkred": "#ad3030",
    "blue": "#397fc1",
    "green": "#318b5c",
    "orange": "#d78332",
    "purple": "#855ea7",
    "cadetblue": "#4a9a9a",
}


def _category_styles(categorias) -> dict:
    """Genera {categoria: {color, icono}} desde la tabla categorias."""
    return {
        nombre: {"color": color, "icon": icono}
        for nombre, color, icono in categorias
    }


def render_map(
    tiendas: List[Tuple],
    categorias,
    center_lat: float,
    center_lng: float,
    zoom: int = 14,
    dark_mode: bool = False,
    user_location=None,
    radius_km=None,
    user_location_label: str = "Tu ubicación",
) -> str:
    """Genera mapa interactivo. Retorna ruta absoluta del HTML."""

    # El mapa se mantiene siempre en modo claro aunque la app se encuentre en "dark mode".
    # Esto evita que el fondo del mapa cambie junto con la interfaz principal.
    tiles = TILES_LIGHT
    m = folium.Map(
        location=[center_lat, center_lng],
        zoom_start=zoom,
        tiles=tiles,
        control_scale=True,
    )
    m.get_root().header.add_child(folium.Element("""
        <style>
            .leaflet-div-icon.fiesta-marker-wrapper { border: 0; background: transparent; }
            .fiesta-marker-shell { position: relative; width: 38px; height: 44px; }
            .fiesta-marker-pin {
                position: absolute; top: 1px; left: 4px; width: 30px; height: 30px;
                border: 2px solid #fff; border-radius: 50% 50% 50% 0;
                box-shadow: 0 2px 5px #14231f70; transform: rotate(-45deg);
            }
            .fiesta-marker-pin .fa {
                position: absolute; top: 7px; left: 7px; color: #fff;
                font-size: 12px; transform: rotate(45deg);
            }
            .fiesta-marker-status {
                position: absolute; right: -1px; bottom: -1px; width: 14px; height: 14px;
                border: 2px solid #fff; border-radius: 50%;
                box-shadow: 0 1px 3px #14231f80;
            }
            .fiesta-marker-status.is-open { background: #20b765; }
            .fiesta-marker-status.is-closed { background: #e03737; }
        </style>
    """))

    if user_location:
        user_lat, user_lng = user_location
        folium.Circle(
            location=[user_lat, user_lng],
            radius=max(float(radius_km or 0), 0) * 1000,
            color="#1976D2",
            weight=2,
            fill=True,
            fill_color="#1976D2",
            fill_opacity=0.12,
            tooltip=f"Radio de búsqueda: {float(radius_km or 0):.1f} km",
        ).add_to(m)
        folium.Marker(
            location=[user_lat, user_lng],
            tooltip=user_location_label,
            icon=folium.Icon(color="blue", icon="street-view", prefix="fa"),
        ).add_to(m)

    styles = _category_styles(categorias)
    # Default para categorías sin definir
    DEFAULT = {"color": "green", "icon": "shopping-cart"}

    for t in tiendas:
        # Soporta tuplas con o sin 'created_at' al final
        t_id, nombre, cat, lat, lng, wa, dir_txt = t[:7]
        fachada = t[7] if len(t) > 7 else ""
        is_open = bool(t[9]) if len(t) > 9 else True
        status_text = "Abierta" if is_open else "Cerrada"
        status_color = "#228553" if is_open else "#c23b3b"
        st = styles.get(cat, DEFAULT)
        marker_color = MARKER_COLORS.get(st["color"], "#4384b4")
        icon_name = html.escape(str(st["icon"]), quote=True)
        status_class = "is-open" if is_open else "is-closed"

        # El popup usa un hash interno en la misma página local para no depender de
        # protocolos del sistema operativo ni de WebChannel externo.
        popup_html = f"""
        <div style="font-family: Arial; width: 180px;">
            <h4 style="margin: 0 0 6px 0;"><b>{html.escape(str(nombre))}</b></h4>
            <p style="margin: 2px 0;"><b>Categoría:</b> {html.escape(str(cat))}</p>
            <p style="margin: 2px 0;"><b>Dirección:</b> {html.escape(str(dir_txt or '-'))}</p>
            <p style="margin: 2px 0;color:{status_color};"><b>Estado: {status_text}</b></p>
            <button onclick="window.location.hash='tienda={t_id}'"
                    style="background:#25D366;color:white;padding:6px 10px;
                           border:none;border-radius:4px;cursor:pointer;
                           margin-top:6px;width:100%;font-weight:bold;">
                Ver Catálogo
            </button>
        </div>
        """

        marker_icon = folium.DivIcon(
            html=(
                '<div class="fiesta-marker-shell">'
                f'<div class="fiesta-marker-pin" style="background:{marker_color}">'
                f'<i class="fa fa-{icon_name}" aria-hidden="true"></i>'
                f'<span class="fiesta-marker-status {status_class}" title="{status_text}"></span>'
                '</div></div>'
            ),
            class_name="fiesta-marker-wrapper",
            icon_size=(38, 44),
            icon_anchor=(19, 42),
            popup_anchor=(0, -38),
        )
        marker = folium.Marker(
            location=[lat, lng],
            popup=folium.Popup(popup_html, max_width=220),
            tooltip=f"{nombre} ({cat}) · {status_text}",
            icon=marker_icon,
        ).add_to(m)

        if fachada:
            image_src = html.escape(fachada.replace("\\", "/"), quote=True)
            image_block = (
                f"<img src='file:///{image_src.lstrip('/')}' "
                "style='width:220px;height:140px;object-fit:cover;border-radius:6px;'>"
            )
        else:
            image_block = (
                "<div style='width:220px;height:140px;background:#eeeeee;"
                "display:flex;align-items:center;justify-content:center;'>"
                "Sin foto de fachada</div>"
            )
        context_popup = (
            "<div style='font-family:Arial;text-align:center;'>"
            f"<b>{html.escape(nombre)}</b><br>{image_block}</div>"
        ).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "")
        m.get_root().script.add_child(folium.Element(
            "setTimeout(function() {"
            f"if (typeof {marker.get_name()} !== 'undefined') {{"
            f"{marker.get_name()}.on('contextmenu', function() {{"
            f"L.popup({{maxWidth:250}}).setLatLng(this.getLatLng())"
            f".setContent('{context_popup}').openOn({m.get_name()});"
            "});"
            "}"
            "}, 0);"
        ))

    # El hash se usa como canal interno dentro del mismo archivo HTML.
    # Así la app puede reaccionar al click sin lanzar un protocolo externo.
    bridge_init = """
    <script>
    window.fiestaSelectTienda = function(id) {
        window.location.hash = 'tienda=' + id;
    };
    </script>
    """
    m.get_root().html.add_child(folium.Element(bridge_init))
    route_map = m.get_name()
    route_script = f"""
    window.fiestaClearRoadRoute = function() {{
        if (window.fiestaRoadRouteLayer) {{
            {route_map}.removeLayer(window.fiestaRoadRouteLayer);
            window.fiestaRoadRouteLayer = null;
        }}
    }};
    window.fiestaDrawRoadRoute = function(points) {{
        window.fiestaClearRoadRoute();
        if (!Array.isArray(points) || points.length < 2) return;
        window.fiestaRoadRouteLayer = L.layerGroup().addTo({route_map});
        var bounds = L.latLngBounds(points);
        L.polyline(points, {{color: "#ffffff", weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round"}})
            .addTo(window.fiestaRoadRouteLayer);
        L.polyline(points, {{color: "#0878f9", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round"}})
            .addTo(window.fiestaRoadRouteLayer);
        {route_map}.fitBounds(bounds, {{padding: [42, 42], maxZoom: 17}});
    }};
    window.fiestaSetDeliveryPointPicker = function(enabled) {{
        window.fiestaDeliveryPointPickerActive = Boolean(enabled);
    }};
    setTimeout(function() {{
        {route_map}.on("click", function(event) {{
            if (!window.fiestaDeliveryPointPickerActive) return;
            window.fiestaDeliveryPointPickerActive = false;
            var point = event.latlng;
            L.marker(point).addTo({route_map}).bindPopup("Punto de entrega elegido").openPopup();
            window.location.hash = "delivery-point=" + point.lat.toFixed(6) + "," + point.lng.toFixed(6);
        }});
    }}, 0);
    """
    m.get_root().script.add_child(folium.Element(route_script))

    file_path = os.path.abspath("map_view.html")
    m.save(file_path)
    return file_path
