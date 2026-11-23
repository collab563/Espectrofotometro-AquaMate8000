from unittest.mock import patch

import owner_api


STORE = (
    1,
    "Privacy QA Store",
    "QA Bakery",
    -12.0,
    -77.0,
    "51999999999",
    "QA address",
    "",
    "2026-01-01",
    1,
    1,
    500,
    100.0,
)


def test_public_store_list_omits_whatsapp_number():
    with (
        patch.object(owner_api.app_config, "load_config", return_value={}),
        patch.object(owner_api.database, "get_all_categorias", return_value=[]),
        patch.object(owner_api.database, "get_all_tiendas", return_value=[STORE]),
    ):
        stores = owner_api.public_data()["tiendas"]

    assert len(stores) == 1
    assert "whatsapp" not in stores[0]


def test_public_store_catalog_omits_whatsapp_number_but_private_serializer_keeps_it():
    with (
        patch.object(owner_api.database, "get_tienda_by_id", return_value=STORE),
        patch.object(owner_api.database, "get_productos_by_tienda", return_value=[]),
    ):
        store = owner_api.public_store_products(STORE[0])["tienda"]

    assert "whatsapp" not in store
    assert owner_api._serialize_store(STORE)["whatsapp"] == STORE[5]