import unittest
import uuid
from datetime import datetime, timezone

# Adjust path and import settings/auth_service
from test.backend.test_helpers import backend_path
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


class TestAuthService(unittest.TestCase):
    def test_password_hashing(self):
        password = "mysecurepassword"
        hashed = hash_password(password)

        self.assertNotEqual(password, hashed)
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("wrongpassword", hashed))

    def test_token_creation_and_decoding(self):
        user_id = uuid.uuid4()

        # Test Access Token
        access_token = create_access_token(user_id)
        payload = decode_token(access_token)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], str(user_id))
        self.assertEqual(payload["type"], "access")
        self.assertIn("exp", payload)

        # Test Refresh Token
        refresh_token = create_refresh_token(user_id)
        payload_refresh = decode_token(refresh_token)

        self.assertIsNotNone(payload_refresh)
        self.assertEqual(payload_refresh["sub"], str(user_id))
        self.assertEqual(payload_refresh["type"], "refresh")

    def test_decode_invalid_token(self):
        self.assertIsNone(decode_token("invalid.token.string"))
        self.assertIsNone(decode_token(""))


if __name__ == "__main__":
    unittest.main()
