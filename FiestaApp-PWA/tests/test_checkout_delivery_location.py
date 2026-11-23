from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

import owner_api
import pytest


def test_confirmed_order_message_contains_selected_map_location():
    product = (7, 3, "Torta de prueba", 25.0, 5, "", "", "[]")
    store = (3, "Tienda QA", "Torterías", -12.0, -77.0, "51999999999", "", "", "", 1, 0, 20, 0)
    payload = owner_api.CheckoutInput(
        items=[owner_api.CheckoutItem(product_id=7, quantity=1)],
        user_lat=-12.0464,
        user_lng=-77.0428,
    )

    with (
        patch.object(owner_api.database, "get_producto_by_id", return_value=product),
        patch.object(owner_api.database, "get_tienda_by_id", return_value=store),
        patch.object(owner_api.database, "create_order", return_value=42) as create_order,
    ):
        result = owner_api.prepare_public_order(payload)

    message = parse_qs(urlsplit(result["whatsapp_url"]).query)["text"][0]
    assert "https://www.openstreetmap.org/?mlat=-12.046400&mlon=-77.042800" in message
    assert "📋 Coordenadas para copiar:\n```\n-12.046400, -77.042800\n```" in message
    assert result["order_id"] == 42
    assert len(result["tracking_token"]) >= 32
    assert create_order.call_args.args[0] == store[0]
    assert "Pedido #42" in message


def test_order_checkout_requires_delivery_coordinates():
    payload = owner_api.CheckoutInput(
        items=[owner_api.CheckoutItem(product_id=7, quantity=1)]
    )

    with pytest.raises(owner_api.HTTPException) as error:
        owner_api.prepare_public_order(payload)

    assert error.value.status_code == 422
    assert "ubicación de entrega" in error.value.detail.lower()