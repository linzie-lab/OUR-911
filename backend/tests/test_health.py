import unittest

from sqlalchemy import inspect

from app import create_app
from app.extensions import db


class HealthEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

    def test_health_endpoint_returns_ok(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_local_vite_origins_are_allowed(self):
        response = self.client.get(
            "/api/health",
            headers={"Origin": "http://127.0.0.1:5174"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["Access-Control-Allow-Origin"],
            "http://127.0.0.1:5174",
        )

    def test_database_tables_are_initialized(self):
        expected_tables = {
            "users",
            "facilities",
            "first_aid_guides",
            "incidents",
            "incident_updates",
            "donors",
            "blood_requests",
            "donor_matches",
            "campus_zones",
            "emergency_contacts",
            "notifications",
        }

        with self.app.app_context():
            self.assertEqual(set(inspect(db.engine).get_table_names()), expected_tables)


if __name__ == "__main__":
    unittest.main()
