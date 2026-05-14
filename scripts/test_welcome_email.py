import asyncio
import sys
import os
sys.path.insert(0, os.getcwd())

from app.services.email_verification_service import EmailVerificationService

async def test():
    svc = EmailVerificationService()
    result = await svc.send_welcome_email(
        email="nidumolubharath230@gmail.com",
        first_name="Bharath"
    )
    print("Welcome email sent:", result)

if __name__ == "__main__":
    asyncio.run(test())
