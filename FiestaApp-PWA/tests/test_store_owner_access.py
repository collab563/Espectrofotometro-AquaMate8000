import os
import tempfile
import unittest

import owner_api
import database


class StoreOwnerAccessTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        handle, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        database.DB_PATH = self.db_path
        database.init_db()
        database.add_tienda("Cuenta prueba A", "Torterías", 0, 0, "511111111", "")
        database.add_tienda("Cuenta prueba B", "Dulcerías", 1, 1, "522222222", "")
        stores = {store[1]: store[0] for store in database.get_all_tiendas()}
        self.store_a = stores["Cuenta prueba A"]
        self.store_b = stores["Cuenta prueba B"]

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        os.unlink(self.db_path)

    def test_passwords_are_hashed_and_authentication_can_be_revoked(self):
        password = "Unique-owner-password-2026!"
        database.create_store_owner(self.store_a, "owner.a", password)

        owner = database.authenticate_store_owner("OWNER.A", password)
        stored = database.get_store_owner_by_username("owner.a")
        self.assertEqual(owner["tienda_id"], self.store_a)
        self.assertNotIn(password, stored["password_hash"])
        self.assertIsNone(database.authenticate_store_owner("owner.a", "incorrect"))

        database.set_store_owner_active("owner.a", False)
        self.assertIsNone(database.authenticate_store_owner("owner.a", password))
        self.assertEqual(database.get_store_owner_by_username("owner.a")["auth_version"], 1)

    def test_spanish_accented_usernames_are_accepted(self):
        username = "se\u00f1oramaria_123.123-123"
        password = "Unique-owner-password-2026!"
        database.create_store_owner(self.store_a, username, password)

        owner = database.authenticate_store_owner("Se\u00f1oraMaria_123.123-123", password)

        self.assertEqual(owner["tienda_id"], self.store_a)

    def test_owner_cannot_edit_or_delete_another_stores_product(self):
        product_id = database.add_owner_product(self.store_a, "Producto privado", 8.5, 2)

        self.assertFalse(
            database.update_owner_product(self.store_b, product_id, "Intruso", 0, 0, "")
        )
        self.assertFalse(database.delete_owner_product(self.store_b, product_id))
        self.assertEqual(database.get_producto_by_id(product_id)[2], "Producto privado")

    def test_store_open_status_persists_when_toggled(self):
        self.assertEqual(database.get_tienda_by_id(self.store_a)[9], 1)

        self.assertTrue(database.update_owner_store_open(self.store_a, False))
        self.assertEqual(database.get_tienda_by_id(self.store_a)[9], 0)

        self.assertTrue(database.update_owner_store_open(self.store_a, True))
        self.assertEqual(database.get_tienda_by_id(self.store_a)[9], 1)

    def test_password_change_requires_current_password_and_revokes_old_login(self):
        old_password = "Original-owner-password-2026!"
        new_password = "Replacement-owner-password-2026!"
        database.create_store_owner(self.store_a, "owner.change", old_password)

        self.assertFalse(
            database.change_store_owner_password("owner.change", "wrong", new_password)
        )
        self.assertTrue(
            database.change_store_owner_password("owner.change", old_password, new_password)
        )
        self.assertIsNone(database.authenticate_store_owner("owner.change", old_password))
        self.assertIsNotNone(database.authenticate_store_owner("owner.change", new_password))
        self.assertEqual(database.get_store_owner_by_username("owner.change")["auth_version"], 1)

    def test_store_free_delivery_settings_include_radius_and_minimum_purchase(self):
        database.update_owner_store(
            self.store_a,
            "Cuenta prueba A",
            "Torterías",
            0,
            0,
            "511111111",
            "",
            True,
            35,
            199.5,
        )

        store = database.get_tienda_by_id(self.store_a)
        self.assertEqual(store[10], 1)
        self.assertEqual(store[11], 35)
        self.assertEqual(store[12], 199.5)

    def test_free_delivery_is_granted_only_when_distance_and_minimum_match(self):
        database.update_owner_store(
            self.store_a,
            "Cuenta prueba A",
            "Torterías",
            -12.0864,
            -77.0358,
            "511111111",
            "",
            True,
            50,
            120.0,
        )

        free, message = owner_api.calculate_free_delivery_status(
            database.get_tienda_by_id(self.store_a),
            150.0,
            -12.0864,
            -77.0358,
        )
        self.assertTrue(free)
        self.assertIn("gratis", message.lower())

        free_far, _ = owner_api.calculate_free_delivery_status(
            database.get_tienda_by_id(self.store_a),
            60.0,
            -12.0900,
            -77.0400,
        )
        self.assertFalse(free_far)


if __name__ == "__main__":
    unittest.main()