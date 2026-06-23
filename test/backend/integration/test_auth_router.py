import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db
from test.backend.test_helpers import (
    init_test_db,
    clean_test_db,
    override_get_db,
    TestingSessionLocal,
)


class TestAuthRouter(unittest.TestCase):
    def setUp(self):
        # Override dependency
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        
        # Initialize database synchronously using an event loop helper
        import asyncio
        asyncio.run(init_test_db())

    def tearDown(self):
        app.dependency_overrides.clear()
        import asyncio
        asyncio.run(clean_test_db())

    def test_register_success(self):
        response = self.client.post(
            "/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "password123",
                "name": "New User",
            },
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["email"], "newuser@example.com")
        self.assertEqual(data["user"]["name"], "New User")

    def test_register_duplicate_email(self):
        # Register first user
        self.client.post(
            "/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "password123",
                "name": "User One",
            },
        )

        # Register second user with same email
        response = self.client.post(
            "/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "anotherpassword",
                "name": "User Two",
            },
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("Email already registered", response.json()["detail"])

    def test_login_success(self):
        # Register user first
        self.client.post(
            "/auth/register",
            json={
                "email": "loginuser@example.com",
                "password": "correctpassword",
                "name": "Login User",
            },
        )

        # Login
        response = self.client.post(
            "/auth/login",
            json={
                "email": "loginuser@example.com",
                "password": "correctpassword",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        # Verify cookie is set
        self.assertIn("refresh_token", response.cookies)

    def test_login_invalid_credentials(self):
        response = self.client.post(
            "/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "somepassword",
            },
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Invalid email or password", response.json()["detail"])

    def test_logout(self):
        response = self.client.post("/auth/logout")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Logged out successfully"})


if __name__ == "__main__":
    unittest.main()
