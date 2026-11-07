import unittest

from sqlalchemy.exc import IntegrityError

from app import create_app
from app.extensions import db
from app.models import User


class UserModelTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            }
        )
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        db.session.remove()
        self.app_context.pop()

    def test_password_is_hashed_and_can_be_verified(self):
        user = User(full_name="Test Student", email="student@example.test")
        user.set_password("correct-horse-battery")

        self.assertNotEqual(user.password_hash, "correct-horse-battery")
        self.assertTrue(user.check_password("correct-horse-battery"))
        self.assertFalse(user.check_password("wrong-password"))

    def test_user_role_defaults_to_student(self):
        user = User(
            full_name="Test Student",
            email="student@example.test",
        )
        user.set_password("correct-horse-battery")
        db.session.add(user)
        db.session.commit()

        self.assertEqual(user.role, "student")

    def test_invalid_user_role_is_rejected_by_database(self):
        user = User(
            full_name="Test User",
            email="invalid-role@example.test",
            password_hash="hashed",
            role="superuser",
        )
        db.session.add(user)

        with self.assertRaises(IntegrityError):
            db.session.commit()


if __name__ == "__main__":
    unittest.main()
