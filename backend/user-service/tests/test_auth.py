"""
Suite de tests du User Service : inscription, connexion, authentification
par cookie httpOnly, et réinitialisation de mot de passe.
Lancer avec : pytest (depuis le dossier user-service, venv activé)
"""
import uuid


def unique_email():
    return f"test-{uuid.uuid4().hex[:8]}@example.com"


class TestRegisterLogin:
    def test_register_success(self, client):
        r = client.post("/register", json={
            "name": "Alice", "email": unique_email(), "password": "password123",
        })
        assert r.status_code == 201
        body = r.get_json()
        assert body["success"] is True
        assert "passwordHash" not in body["data"]["user"]
        assert "token" not in body["data"]  # le token ne doit JAMAIS apparaître dans le JSON

    def test_register_sets_httponly_cookie(self, client):
        r = client.post("/register", json={
            "name": "Alice", "email": unique_email(), "password": "password123",
        })
        cookies = r.headers.getlist("Set-Cookie")
        assert any("mboatrip_token=" in c and "HttpOnly" in c for c in cookies)

    def test_register_duplicate_email_rejected(self, client):
        email = unique_email()
        client.post("/register", json={"name": "Alice", "email": email, "password": "password123"})
        r = client.post("/register", json={"name": "Bob", "email": email, "password": "password123"})
        assert r.status_code == 409

    def test_register_invalid_password_rejected(self, client):
        r = client.post("/register", json={"name": "Alice", "email": unique_email(), "password": "short"})
        assert r.status_code == 422

    def test_login_wrong_password_rejected(self, client):
        email = unique_email()
        client.post("/register", json={"name": "Alice", "email": email, "password": "password123"})
        r = client.post("/login", json={"email": email, "password": "wrongpassword"})
        assert r.status_code == 401

    def test_login_success(self, client):
        email = unique_email()
        client.post("/register", json={"name": "Alice", "email": email, "password": "password123"})
        r = client.post("/login", json={"email": email, "password": "password123"})
        assert r.status_code == 200


class TestCookieAuth:
    def test_me_without_cookie_rejected(self, client):
        r = client.get("/me")
        assert r.status_code == 401

    def test_me_with_session_cookie_works(self, client):
        client.post("/register", json={"name": "Alice", "email": unique_email(), "password": "password123"})
        r = client.get("/me")  # le test client conserve le cookie de la requête précédente
        assert r.status_code == 200
        assert r.get_json()["data"]["user"]["name"] == "Alice"

    def test_logout_clears_cookie(self, client):
        client.post("/register", json={"name": "Alice", "email": unique_email(), "password": "password123"})
        client.post("/logout")
        r = client.get("/me")
        assert r.status_code == 401


class TestPasswordReset:
    def test_forgot_password_unknown_email_no_leak(self, client):
        r = client.post("/forgot-password", json={"email": "doesnotexist@example.com"})
        assert r.status_code == 200
        assert "devResetToken" not in r.get_json()  # anti-énumération de comptes

    def test_forgot_password_known_email_returns_token(self, client):
        email = unique_email()
        client.post("/register", json={"name": "Bob", "email": email, "password": "password123"})
        client.post("/logout")
        r = client.post("/forgot-password", json={"email": email})
        assert r.status_code == 200
        assert r.get_json().get("devResetToken")

    def test_reset_with_invalid_token_rejected(self, client):
        r = client.post("/reset-password", json={"token": "invalid", "password": "newpassword123"})
        assert r.status_code == 400

    def test_full_reset_flow_and_token_is_single_use(self, client):
        email = unique_email()
        client.post("/register", json={"name": "Bob", "email": email, "password": "oldpassword123"})
        client.post("/logout")

        token = client.post("/forgot-password", json={"email": email}).get_json()["devResetToken"]

        r_reset = client.post("/reset-password", json={"token": token, "password": "newpassword123"})
        assert r_reset.status_code == 200

        r_old_login = client.post("/login", json={"email": email, "password": "oldpassword123"})
        assert r_old_login.status_code == 401

        r_new_login = client.post("/login", json={"email": email, "password": "newpassword123"})
        assert r_new_login.status_code == 200

        r_reuse = client.post("/reset-password", json={"token": token, "password": "encoreunautre123"})
        assert r_reuse.status_code == 400  # token à usage unique
