"""
theme.py — Sistema de temas claro/oscuro.
Retorna stylesheets Qt centralizados y la paleta de Folium para mapas.
"""

# Paleta Folium (tiles) según modo
DARK_TILES = "CartoDB dark_matter"
LIGHT_TILES = "OpenStreetMap"


def get_palette(dark: bool) -> dict:
    """Paleta de colores para sincronizar UI y mapa."""
    if dark:
        return {
            "bg": "#1e1e1e",
            "bg_alt": "#2b2b2b",
            "fg": "#e6e6e6",
            "accent": "#4f9eff",
            "border": "#3a3a3a",
            "muted": "#a0a0a0",
            "success": "#25D366",
            "danger": "#ff6b6b",
        }
    return {
        "bg": "#ffffff",
        "bg_alt": "#f6f7fb",
        "fg": "#1f2937",
        "accent": "#2563eb",
        "border": "#e5e7eb",
        "muted": "#6b7280",
        "success": "#25D366",
        "danger": "#dc2626",
    }


def get_stylesheet(dark: bool) -> str:
    p = get_palette(dark)
    return f"""
    QMainWindow, QDialog {{
        background-color: {p['bg']};
        color: {p['fg']};
    }}
    QWidget {{
        background-color: {p['bg']};
        color: {p['fg']};
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 10pt;
    }}
    QMenuBar {{
        background-color: {p['bg_alt']};
        color: {p['fg']};
        padding: 4px;
    }}
    QMenuBar::item:selected {{
        background-color: {p['accent']};
    }}
    QMenu {{
        background-color: {p['bg_alt']};
        color: {p['fg']};
        border: 1px solid {p['border']};
    }}
    QMenu::item:selected {{
        background-color: {p['accent']};
    }}
    QPushButton {{
        background-color: {p['accent']};
        color: white;
        border: none;
        padding: 8px 14px;
        border-radius: 6px;
        font-weight: 500;
    }}
    QPushButton:hover {{
        background-color: #1e4fcb;
    }}
    QPushButton:disabled {{
        background-color: {p['muted']};
    }}
    QLineEdit, QDoubleSpinBox, QComboBox {{
        background-color: {p['bg_alt']};
        color: {p['fg']};
        border: 1px solid {p['border']};
        border-radius: 5px;
        padding: 6px;
    }}
    QListWidget {{
        background-color: {p['bg_alt']};
        color: {p['fg']};
        border: 1px solid {p['border']};
        border-radius: 6px;
        padding: 4px;
    }}
    QListWidget::item:selected {{
        background-color: {p['accent']};
        color: white;
    }}
    QLabel {{
        color: {p['fg']};
    }}
    QStatusBar {{
        background-color: {p['bg_alt']};
        color: {p['muted']};
    }}
    QTabWidget::pane {{
        border: 1px solid {p['border']};
        background: {p['bg']};
    }}
    QTabBar::tab {{
        background: {p['bg_alt']};
        color: {p['fg']};
        padding: 8px 14px;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
    }}
    QTabBar::tab:selected {{
        background: {p['accent']};
        color: white;
    }}
    QSplitter::handle {{
        background-color: {p['border']};
    }}
    QScrollBar:vertical {{
        background: transparent;
        width: 18px;
        margin: 2px;
    }}
    QScrollBar:horizontal {{
        background: transparent;
        height: 18px;
        margin: 2px;
    }}
    QScrollBar::handle:vertical, QScrollBar::handle:horizontal {{
        background: {p['muted']};
        border-radius: 8px;
        min-width: 28px;
        min-height: 28px;
    }}
    QScrollBar::handle:vertical:hover, QScrollBar::handle:horizontal:hover {{
        background: {p['accent']};
    }}
    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
        height: 0;
        border: none;
        background: transparent;
    }}
    QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
        width: 0;
        border: none;
        background: transparent;
    }}
    QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical,
    QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {{
        background: transparent;
    }}
    """
