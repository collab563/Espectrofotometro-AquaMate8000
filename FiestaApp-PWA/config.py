"""
config.py — Configuración persistente de la app.
Soporta modo oscuro/claro, ubicación del mapa y ajustes generales.
"""
import json
import os

CONFIG_FILE = "app_config.json"

DEFAULT_CONFIG = {
    "theme": "light",           # "light" | "dark"
    "map_center_lat": -12.0864,
    "map_center_lng": -77.0358,
    "map_zoom": 14,
    "radius_km": 10.0,
    "radius_filter_enabled": True,
    "app_title": "Directorio de Fiestas y Eventos",
    "auto_open_whatsapp": True,
    "admin_password": "admin123",   # PIN simple para entrar al panel admin
}


def load_config() -> dict:
    """Carga configuración o crea una por defecto."""
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            # Merge con defaults para nuevas claves
            for k, v in DEFAULT_CONFIG.items():
                cfg.setdefault(k, v)
            return cfg
    except (json.JSONDecodeError, IOError):
        return DEFAULT_CONFIG.copy()


def save_config(cfg: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def update_config(key: str, value):
    cfg = load_config()
    cfg[key] = value
    save_config(cfg)
