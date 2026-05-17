import asyncio
from app.services.email_verification_service import EmailVerificationService

async def test():
    svc = EmailVerificationService()
    token = svc.generate_token("test@gmail.com")
    result = await svc.send_verification_email(
        "nidumolubharath230@gmail.com",
        token,
        "Bharath",
        otp="482910",
    )
    print("Email sent:", result)

if __name__ == "__main__":
    asyncio.run(test())
