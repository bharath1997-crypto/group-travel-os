from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from itsdangerous import SignatureExpired, BadSignature

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.models.user import User
from app.services.email_verification_service import EmailVerificationService
from app.utils.exceptions import AppException

router = APIRouter(
    prefix="/auth", 
    tags=["Email Verification"]
)

svc = EmailVerificationService()

@router.post("/request-verification")
async def request_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.is_verified:
        return {"message": "Email already verified"}
    
    # Rate limit: 60 seconds between requests
    if current_user.verification_token_sent_at:
        elapsed = (
            datetime.now(timezone.utc) - 
            current_user.verification_token_sent_at.replace(tzinfo=timezone.utc)
        ).total_seconds()
        if elapsed < 60:
            AppException.rate_limit(
                "Please wait 60 seconds before requesting again"
            )
    
    token = svc.generate_token(current_user.email)
    
    name = getattr(current_user, 'full_name', '') \
        or getattr(current_user, 'username', '') or ''
    
    await svc.send_verification_email(
        current_user.email, 
        token,
        name
    )
    
    current_user.verification_token_sent_at = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "message": "Verification email sent. Check your inbox."
    }

@router.get("/verify-email")
async def verify_email(
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        email = svc.verify_token(token)
    except SignatureExpired:
        AppException.bad_request(
            "Verification link expired. Please request a new one."
        )
    except BadSignature:
        AppException.bad_request(
            "Invalid verification link."
        )
    
    result = db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        AppException.bad_request(
            "Invalid verification link."
        )
    
    if user.is_verified:
        return {
            "message": "Email already verified",
            "verified": True
        }
    
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    db.commit()
    
    # Send welcome email (non-blocking)
    await svc.send_welcome_email(
        user.email,
        name=getattr(user, 'name', '') or '',
        first_name=getattr(user, 'first_name', '') or ''
    )
    
    return {
        "message": "Email verified successfully! Welcome to Rovvy.",
        "verified": True
    }

@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Same as request-verification
    # Separate endpoint for frontend clarity
    return await request_verification(
        current_user, db
    )
