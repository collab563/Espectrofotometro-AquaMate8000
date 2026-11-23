import os
import tempfile
import unittest

import database
from fastapi.testclient import TestClient
from main import customer_order_progress_html
import owner_api


class OrderLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        handle, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        database.DB_PATH = self.db_path
        database.init_db()
        self.store = database.get_all_tiendas()[0]
        self.product = database.get_productos_by_tienda(self.store[0])[0]

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        os.unlink(self.db_path)

    def create_order(self, quantity=1):
        return database.create_order(
            self.store[0],
            "tracking-token-abcdefghijklmnopqrstuvwxyz",
            [{
                "product_id": self.product[0],
                "nombre": self.product[2],
                "precio": float(self.product[3]),
                "cantidad": quantity,
            }],
            float(self.product[3]) * quantity,
            -12.0,
            -77.0,
        )

    def test_order_persists_and_status_moves_forward(self):
        initial_stock = self.product[4]
        order_id = self.create_order()

        order = database.get_order_for_store(order_id, self.store[0])
        public_order = database.get_order_by_tracking_token(
            "tracking-token-abcdefghijklmnopqrstuvwxyz"
        )
        self.assertEqual(order["estado"], "recibido")
        self.assertEqual(order["productos"][0]["nombre"], self.product[2])
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock - 1)
        self.assertEqual(public_order["estado"], "recibido")

        self.assertTrue(database.update_order_status(self.store[0], order_id, "aceptado"))
        self.assertTrue(database.update_order_status(self.store[0], order_id, "en_preparacion"))
        self.assertTrue(database.update_order_status(self.store[0], order_id, "enviado"))
        self.assertTrue(database.update_order_status(self.store[0], order_id, "cancelado"))
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock)

    def test_failed_stock_reservation_rolls_back_without_creating_order(self):
        initial_stock = self.product[4]
        with self.assertRaises(ValueError):
            self.create_order(initial_stock + 1)

        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock)
        self.assertEqual(database.get_orders_for_store(self.store[0]), [])

    def test_cancelling_order_restores_reserved_stock_once(self):
        initial_stock = self.product[4]
        order_id = self.create_order()
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock - 1)

        self.assertTrue(database.update_order_status(self.store[0], order_id, "cancelado"))
        self.assertFalse(database.update_order_status(self.store[0], order_id, "cancelado"))
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock)

    def test_order_payment_confirmation_cancels_and_stays_cancelled_when_unpaid(self):
        order_id = self.create_order()

        self.assertTrue(database.set_order_payment_confirmation(self.store[0], order_id, True))
        paid = database.get_order_for_store(order_id, self.store[0])
        self.assertIsNotNone(paid["paid_at"])
        self.assertTrue(paid["payment_confirmed"])
        self.assertEqual(paid["estado"], "cancelado")

        self.assertTrue(database.set_order_payment_confirmation(self.store[0], order_id, False))
        unpaid = database.get_order_for_store(order_id, self.store[0])
        self.assertIsNone(unpaid["paid_at"])
        self.assertFalse(unpaid["payment_confirmed"])
        self.assertEqual(unpaid["estado"], "cancelado")

    def test_marking_sent_order_paid_cancels_and_restores_stock_once(self):
        initial_stock = self.product[4]
        order_id = self.create_order()
        database.update_order_status(self.store[0], order_id, "aceptado")
        database.update_order_status(self.store[0], order_id, "en_preparacion")
        database.update_order_status(self.store[0], order_id, "enviado")
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock - 1)

        self.assertTrue(database.set_order_payment_confirmation(self.store[0], order_id, True))
        cancelled = database.get_order_for_store(order_id, self.store[0])
        self.assertEqual(cancelled["estado"], "cancelado")
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock)

        self.assertTrue(database.set_order_payment_confirmation(self.store[0], order_id, False))
        self.assertTrue(database.set_order_payment_confirmation(self.store[0], order_id, True))
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock)

    def test_reopening_cancelled_order_returns_to_received_and_reserves_stock(self):
        initial_stock = self.product[4]
        order_id = self.create_order()
        database.update_order_status(self.store[0], order_id, "cancelado")

        self.assertTrue(database.update_order_status(self.store[0], order_id, "recibido"))

        order = database.get_order_for_store(order_id, self.store[0])
        self.assertEqual(order["estado"], "recibido")
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock - 1)
        tracked = database.get_order_by_tracking_token(
            "tracking-token-abcdefghijklmnopqrstuvwxyz"
        )
        self.assertEqual(tracked["estado"], "recibido")
        self.assertTrue(database.update_order_status(self.store[0], order_id, "aceptado"))

    def test_reopening_without_stock_keeps_order_cancelled(self):
        order_id = self.create_order()
        database.update_order_status(self.store[0], order_id, "cancelado")
        with database.get_conn() as conn:
            conn.execute("UPDATE productos SET stock = 0 WHERE id = ?", (self.product[0],))

        with self.assertRaisesRegex(ValueError, "stock"):
            database.update_order_status(self.store[0], order_id, "recibido")

        self.assertEqual(database.get_order_for_store(order_id, self.store[0])["estado"], "cancelado")
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], 0)

    def test_reopening_sent_order_resets_to_received_without_reserving_stock_twice(self):
        initial_stock = self.product[4]
        order_id = self.create_order()
        database.update_order_status(self.store[0], order_id, "aceptado")
        database.update_order_status(self.store[0], order_id, "en_preparacion")
        database.update_order_status(self.store[0], order_id, "enviado")
        stock_after_first_reservation = database.get_producto_by_id(self.product[0])[4]

        self.assertTrue(database.update_order_status(self.store[0], order_id, "recibido"))

        self.assertEqual(database.get_order_for_store(order_id, self.store[0])["estado"], "recibido")
        self.assertEqual(stock_after_first_reservation, initial_stock - 1)
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock - 1)

    def test_owner_order_queries_are_scoped_to_the_store(self):
        order_id = self.create_order()

        self.assertIsNone(database.get_order_for_store(order_id, self.store[0] + 1000))
        self.assertEqual(database.get_orders_for_store(self.store[0])[0]["id"], order_id)

    def test_seller_status_updates_are_visible_to_buyer_tracking_token(self):
        self.create_order()
        token = "tracking-token-abcdefghijklmnopqrstuvwxyz"
        owner = {"tienda_id": self.store[0]}

        orders = owner_api.owner_orders(owner=owner)["pedidos"]
        self.assertEqual(orders[0]["estado"], "recibido")

        owner_api.owner_update_order_status(
            orders[0]["id"],
            owner_api.OrderStatusInput(estado="aceptado"),
            owner=owner,
        )
        tracked = owner_api.public_order_status(token)

        self.assertEqual(tracked["estado"], "aceptado")
        self.assertEqual(tracked["progreso"], 1)

    def test_status_patch_accepts_json_body_and_updates_order(self):
        order_id = self.create_order()
        owner = {"tienda_id": self.store[0]}
        owner_api.app.dependency_overrides[owner_api.current_owner] = lambda: owner
        try:
            with TestClient(owner_api.app) as client:
                response = client.patch(
                    f"/api/orders/{order_id}/status",
                    json={"estado": "aceptado"},
                )
        finally:
            owner_api.app.dependency_overrides.pop(owner_api.current_owner, None)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["estado"], "aceptado")

    def test_payment_confirmation_cancels_order_and_replenishes_stock(self):
        initial_stock = self.product[4]
        order_id = self.create_order()
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock - 1)
        owner_api.app.dependency_overrides[owner_api.current_owner] = lambda: {
            "tienda_id": self.store[0]
        }
        try:
            with TestClient(owner_api.app) as client:
                response = client.patch(
                    f"/api/orders/{order_id}/payment-confirmation",
                    json={"paid": True},
                )
                orders = client.get("/api/orders").json()["pedidos"]
                unpaid_response = client.patch(
                    f"/api/orders/{order_id}/payment-confirmation",
                    json={"paid": False},
                )
        finally:
            owner_api.app.dependency_overrides.pop(owner_api.current_owner, None)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["payment_confirmed"])
        self.assertIsNotNone(response.json()["paid_at"])
        self.assertEqual(response.json()["estado"], "cancelado")
        self.assertTrue(orders[0]["payment_confirmed"])
        self.assertIsNotNone(orders[0]["paid_at"])
        self.assertEqual(orders[0]["estado"], "cancelado")
        self.assertEqual(database.get_producto_by_id(self.product[0])[4], initial_stock)
        self.assertEqual(
            owner_api.public_order_status("tracking-token-abcdefghijklmnopqrstuvwxyz")["estado"],
            "cancelado",
        )
        self.assertEqual(unpaid_response.status_code, 200, unpaid_response.text)
        self.assertFalse(unpaid_response.json()["payment_confirmed"])
        self.assertIsNone(unpaid_response.json()["paid_at"])
        self.assertEqual(
            database.get_order_for_store(order_id, self.store[0])["estado"],
            "cancelado",
        )

    def test_status_patch_reopens_cancelled_order_as_received(self):
        order_id = self.create_order()
        database.update_order_status(self.store[0], order_id, "cancelado")
        owner_api.app.dependency_overrides[owner_api.current_owner] = lambda: {
            "tienda_id": self.store[0]
        }
        try:
            with TestClient(owner_api.app) as client:
                response = client.patch(
                    f"/api/orders/{order_id}/status",
                    json={"estado": "recibido"},
                )
        finally:
            owner_api.app.dependency_overrides.pop(owner_api.current_owner, None)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["estado"], "recibido")
        self.assertEqual(
            owner_api.public_order_status("tracking-token-abcdefghijklmnopqrstuvwxyz")["progreso"],
            0,
        )

    def test_desktop_customer_progress_has_four_dots_and_separate_cancelled_state(self):
        received = customer_order_progress_html({"id": 18, "estado": "recibido"})
        self.assertEqual(received.count("#39ff14"), 1)

        progress = customer_order_progress_html({"id": 18, "estado": "en_preparacion"})
        self.assertEqual(progress.count("<span title="), 4)
        self.assertEqual(progress.count("#39ff14"), 3)

        cancelled = customer_order_progress_html({"id": 18, "estado": "cancelado"})
        self.assertIn("Cancelado", cancelled)
        self.assertNotIn("#39ff14", cancelled)
        self.assertEqual(cancelled.count("<span title="), 4)
        self.assertEqual(cancelled.count("#52605a"), 4)


if __name__ == "__main__":
    unittest.main()
