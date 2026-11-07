import unittest

from flask import g, jsonify
from flask_jwt_extended import create_access_token

from app import create_app
from app.auth.decorators import role_required
from app.extensions import db
from app.models import User


class AuthEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "JWT_SECRET_KEY": "test-secret-that-is-at-least-thirty-two-bytes",
            }
        )
        self.client = self.app.test_client()

        @role_required("admin")
        def admin_endpoint():
            return jsonify(user_id=g.current_user.id), 200

        self.app.add_url_rule(
            "/api/test/admin",
            view_func=admin_endpoint,
        )

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()

    def _register(self, **overrides):
        payload = {
            "full_name": "Test Student",
            "email": "student@example.test",
            "password": "correct-horse-battery",
        }
        payload.update(overrides)
        return self.client.post("/api/auth/register", json=payload)

    def _create_user_token(self, role="student"):
        with self.app.app_context():
            user = User(
                full_name="Test User",
                email=f"{role}@example.test",
                role=role,
            )
            user.set_password("correct-horse-battery")
            db.session.add(user)
            db.session.commit()
            return create_access_token(identity=str(user.id))

    def test_registration_creates_student_without_returning_password(self):
        response = self._register(
            full_name="  Test Student  ",
            email="  STUDENT@example.test ",
        )

        self.assertEqual(response.status_code, 201)
        user_data = response.get_json()["user"]
        self.assertEqual(user_data["full_name"], "Test Student")
        self.assertEqual(user_data["email"], "student@example.test")
        self.assertEqual(user_data["role"], "student")
        self.assertNotIn("password", response.get_json())
        self.assertNotIn("password_hash", response.get_json())

        with self.app.app_context():
            user = db.session.scalar(
                db.select(User).where(User.email == "student@example.test")
            )
            self.assertTrue(user.check_password("correct-horse-battery"))
            self.assertNotEqual(user.password_hash, "correct-horse-battery")

    def test_registration_rejects_privileged_role_self_assignment(self):
        for role in ("health_personnel", "admin"):
            with self.subTest(role=role):
                response = self._register(
                    email=f"{role}@example.test",
                    role=role,
                )
                self.assertEqual(response.status_code, 403)

    def test_registration_rejects_invalid_data_and_role(self):
        invalid_payloads = [
            ({}, "Full name is required."),
            ({"full_name": "Student", "email": "not-an-email", "password": "password123"}, "A valid email address is required."),
            ({"full_name": "Student", "email": "student@example.test", "password": "short"}, "Password must be at least 8 characters long."),
            ({"full_name": "Student", "email": "student@example.test", "password": "password123", "role": "moderator"}, "Role must be student, health_personnel, or admin."),
        ]

        for payload, expected_error in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/api/auth/register", json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["error"], expected_error)

    def test_duplicate_registration_returns_conflict(self):
        self.assertEqual(self._register().status_code, 201)
        response = self._register(email="STUDENT@example.test")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json()["error"],
            "An account with this email already exists.",
        )

    def test_login_returns_access_token_and_safe_user_data(self):
        self.assertEqual(self._register().status_code, 201)
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "STUDENT@example.test",
                "password": "correct-horse-battery",
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["access_token"])
        self.assertEqual(data["token_type"], "Bearer")
        self.assertEqual(data["user"]["role"], "student")
        self.assertNotIn("password", data)
        self.assertNotIn("password_hash", data)

    def test_login_rejects_invalid_credentials(self):
        self._register()
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "student@example.test",
                "password": "incorrect-password",
            },
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["error"], "Invalid email or password.")

    def test_me_requires_token_and_returns_safe_user_data(self):
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        token = self._create_user_token()

        response = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "student")
        self.assertNotIn("password_hash", response.get_json()["user"])

    def test_role_decorator_enforces_database_role(self):
        self.assertEqual(
            self.client.get("/api/test/admin").status_code,
            401,
        )
        student_token = self._create_user_token("student")
        denied = self.client.get(
            "/api/test/admin",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        self.assertEqual(denied.status_code, 403)

        admin_token = self._create_user_token("admin")
        allowed = self.client.get(
            "/api/test/admin",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        self.assertEqual(allowed.status_code, 200)


if __name__ == "__main__":
    unittest.main()
