import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.email_verification_service import EmailVerificationService
from config import settings

async def main():
    print("Testing Brevo Email Sending...")
    print(f"MAIL_SERVER: {settings.mail_server}")
    print(f"MAIL_PORT: {settings.mail_port}")
    print(f"MAIL_FROM: {settings.mail_from}")
    print(f"MAIL_USERNAME: {settings.mail_username}")
    
    svc = EmailVerificationService()
    token = svc.generate_token("test@example.com")
    
    print("\nSending test verification email...")
    success = await svc.send_verification_email(
        email="bnidumol@depaul.edu", # User's email from screenshot
        token=token,
        user_name="Test User"
    )
    
    if success:
        print("Success! Email sent.")
    else:
        print("Failed to send email. Check console output above or Brevo logs.")

if __name__ == '__main__':
    asyncio.run(main())
