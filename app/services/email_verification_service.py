from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired
)
from fastapi_mail import (
    ConnectionConfig,
    FastMail,
    MessageSchema,
    MessageType
)
from config import settings

VERIFY_SALT = "rovvy-email-verify-2026"

class EmailVerificationService:

    def generate_token(self, email: str) -> str:
        s = URLSafeTimedSerializer(
            settings.email_verification_secret
        )
        return s.dumps(
            {"email": email}, 
            salt=VERIFY_SALT
        )

    def verify_token(
        self, 
        token: str,
        max_age: int = 86400
    ) -> str:
        s = URLSafeTimedSerializer(
            settings.email_verification_secret
        )
        try:
            data = s.loads(
                token,
                salt=VERIFY_SALT,
                max_age=max_age
            )
            return data["email"]
        except SignatureExpired:
            raise
        except BadSignature:
            raise

    def get_mail_config(self) -> ConnectionConfig:
        # Get SMTP credentials from settings
        # Try BREVO_SMTP_LOGIN or MAIL_USERNAME
        username = getattr(
            settings, 
            'brevo_smtp_login', 
            None
        ) or getattr(
            settings, 
            'mail_username', 
            ''
        )
        password = getattr(
            settings,
            'brevo_smtp_password',
            None  
        ) or getattr(
            settings,
            'mail_password',
            ''
        )
        
        # If mail_username isn't found, try SMTP_USER from existing
        if not username:
            username = getattr(settings, 'SMTP_USER', '')
            password = getattr(settings, 'SMTP_PASSWORD', '')
        
        return ConnectionConfig(
            MAIL_USERNAME=username,
            MAIL_PASSWORD=password,
            MAIL_FROM=settings.mail_from,
            MAIL_FROM_NAME=settings.mail_from_name,
            MAIL_PORT=settings.mail_port,
            MAIL_SERVER=settings.mail_server,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
        )

    async def send_verification_email(
        self,
        email: str,
        token: str,
        user_name: str = ""
    ) -> bool:
        try:
            verify_url = (
                f"https://rovvy.app"
                f"/auth/verify-email?token={token}"
            )
            html = f"""
            <div style="font-family:Inter,sans-serif;
                max-width:600px;margin:0 auto;
                background:#0F172A;color:#F8FAFC;
                padding:40px;border-radius:12px">
                <h1 style="color:#0F766E;
                    font-size:24px;margin:0">
                    rovvy
                </h1>
                <p style="color:#94A3B8;
                    font-size:13px;margin-top:4px">
                    Roam together
                </p>
                <h2 style="margin-top:32px;
                    font-size:20px">
                    Verify your email
                </h2>
                <p style="color:#94A3B8;
                    line-height:1.6">
                    Hi {user_name or 'there'}! 
                    Click the button below to verify 
                    your Rovvy account. 
                    This link expires in 24 hours.
                </p>
                <a href="{verify_url}"
                    style="display:inline-block;
                        background:#0F766E;
                        color:white;
                        padding:14px 32px;
                        border-radius:8px;
                        text-decoration:none;
                        font-weight:bold;
                        margin-top:24px;
                        font-size:16px">
                    Verify Email Address
                </a>
                <p style="color:#94A3B8;
                    font-size:12px;
                    margin-top:32px;
                    line-height:1.6">
                    If you didn't create a Rovvy account,
                    you can safely ignore this email.
                    <br/>
                    <a href="{verify_url}" 
                        style="color:#0F766E">
                        {verify_url}
                    </a>
                </p>
            </div>
            """
            message = MessageSchema(
                subject="Verify your Rovvy email ✈️",
                recipients=[email],
                body=html,
                subtype=MessageType.html,
            )
            fm = FastMail(self.get_mail_config())
            await fm.send_message(message)
            return True
        except Exception as e:
            print(f"Email send failed: {e}")
            return False

    async def send_welcome_email(
        self,
        email: str,
        name: str = ""
    ) -> bool:
        try:
            html = f"""
            <div style="font-family:Inter,sans-serif;
                max-width:600px;margin:0 auto;
                background:#0F172A;color:#F8FAFC;
                padding:40px;border-radius:12px">
                <h1 style="color:#0F766E">rovvy</h1>
                <h2>Welcome{' ' + name if name else ''}! 🎉</h2>
                <p style="color:#94A3B8;line-height:1.6">
                    Your email is verified. 
                    You're ready to roam together.
                    Start planning your first group trip!
                </p>
                <a href="https://rovvy.app/dashboard"
                    style="display:inline-block;
                        background:#0F766E;
                        color:white;
                        padding:14px 32px;
                        border-radius:8px;
                        text-decoration:none;
                        font-weight:bold;
                        margin-top:24px">
                    Start Planning 🌍
                </a>
            </div>
            """
            message = MessageSchema(
                subject="Welcome to Rovvy! 🌍 Roam together",
                recipients=[email],
                body=html,
                subtype=MessageType.html,
            )
            fm = FastMail(self.get_mail_config())
            await fm.send_message(message)
            return True
        except Exception as e:
            print(f"Welcome email failed: {e}")
            return False
