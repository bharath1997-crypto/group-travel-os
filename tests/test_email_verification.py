import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from itsdangerous import SignatureExpired, BadSignature

from app.main import app
from app.utils.auth import get_current_user
from app.utils.database import get_db
from tests.conftest import exec_result

client = TestClient(app)

@pytest.fixture
def override_deps(db, mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: db
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def mock_svc():
    with patch("app.routes.email_verification.svc") as svc:
        svc.generate_token.return_value = "fake-token"
        svc.send_verification_email = AsyncMock(return_value=True)
        svc.send_welcome_email = AsyncMock(return_value=True)
        yield svc

def test_request_verification_200(override_deps, db, mock_user, mock_svc):
    mock_user.is_verified = False
    mock_user.verification_token_sent_at = None
    response = client.post("/api/v1/auth/request-verification")
    assert response.status_code == 200
    assert response.json()["message"] == "Verification email sent. Check your inbox."
    mock_svc.generate_token.assert_called_once()
    mock_svc.send_verification_email.assert_called_once()

def test_already_verified_200(override_deps, db, mock_user, mock_svc):
    mock_user.is_verified = True
    response = client.post("/api/v1/auth/request-verification")
    assert response.status_code == 200
    assert "already verified" in response.json()["message"].lower()

def test_rate_limit_60_seconds_429(override_deps, db, mock_user, mock_svc):
    mock_user.is_verified = False
    mock_user.verification_token_sent_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    response = client.post("/api/v1/auth/request-verification")
    assert response.status_code == 429
    assert "wait 60 seconds" in str(response.json()["detail"]).lower()

def test_verify_email_valid_token_200(override_deps, db, mock_user, mock_svc):
    mock_svc.verify_token.return_value = "test@example.com"
    mock_user.is_verified = False
    db.execute.return_value = exec_result(scalar_one_or_none=mock_user)
    
    response = client.get("/api/v1/auth/verify-email?token=fake-token")
    assert response.status_code == 200
    assert response.json()["verified"] is True
    assert mock_user.is_verified is True
    assert mock_user.verified_at is not None

def test_verify_email_expired_token_400(override_deps, db, mock_svc):
    mock_svc.verify_token.side_effect = SignatureExpired("expired")
    response = client.get("/api/v1/auth/verify-email?token=fake-token")
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]

def test_verify_email_invalid_token_400(override_deps, db, mock_svc):
    mock_svc.verify_token.side_effect = BadSignature("bad")
    response = client.get("/api/v1/auth/verify-email?token=fake-token")
    assert response.status_code == 400
    assert "Invalid verification link" in response.json()["detail"]

def test_registration_triggers_verification_email(override_deps, db, mock_svc):
    mock_user = MagicMock()
    mock_user.id = "00000000-0000-0000-0000-000000000001"
    mock_user.email = "new@example.com"
    mock_user.full_name = "New"
    mock_user.username = None
    mock_user.phone = None
    mock_user.whatsapp_number = None
    mock_user.whatsapp_verified = False
    mock_user.country = None
    mock_user.recovery_email = None
    mock_user.instagram_handle = None
    mock_user.avatar_url = None
    mock_user.profile_picture = None
    mock_user.cover_url = None
    mock_user.google_sub = None
    mock_user.is_active = True
    mock_user.is_verified = False
    mock_user.profile_public = True
    mock_user.created_at = datetime.now(timezone.utc)
    mock_user.updated_at = datetime.now(timezone.utc)
    
    with patch("app.routes.auth.AuthService.register", return_value=(mock_user, "access", 3600)), \
         patch("app.services.email_verification_service.EmailVerificationService", return_value=mock_svc):
        
        resp = client.post("/api/v1/auth/register", json={
            "full_name": "New", "email": "new@example.com", "password": "Password123!", "date_of_birth": "2000-01-01"
        })
        assert resp.status_code == 201
        # Async tasks from BackgroundTasks run in same thread after response
        mock_svc.generate_token.assert_called_once()
        mock_svc.send_verification_email.assert_called_once()
