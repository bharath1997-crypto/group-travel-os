from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired
)
from fastapi_mail import (
    ConnectionConfig,
    FastMail,
    MessageSchema,
    MessageType,
    MultipartSubtypeEnum
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
        name: str = "",
        first_name: str = ""
    ) -> bool:
        try:
            display_name = first_name or name or "Traveler"
            
            subject = (
                f"Welcome to Rovvy, {display_name}! "
                f"Your adventure starts now 🌍"
            )
            
            html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Rovvy</title>
    <style>
        @media only screen and (max-width: 600px) {{
            .container {{
                width: 100% !important;
                border-radius: 0 !important;
            }}
            .stack {{
                display: block !important;
                width: 100% !important;
                box-sizing: border-box;
                margin-bottom: 16px !important;
            }}
            .stack:last-child {{
                margin-bottom: 0 !important;
            }}
            .padding-mobile {{
                padding: 20px !important;
            }}
        }}
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0F172A;">
        <tr>
            <td align="center" style="padding: 40px 20px;" class="padding-mobile">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" class="container" style="max-width: 600px; background-color: #1E293B; border-radius: 12px; overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #0F172A; padding: 32px 40px; border-bottom: 2px solid #0F766E;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <div style="font-size: 24px; font-weight: bold; color: #0F766E;">rovvy</div>
                                        <div style="font-size: 14px; color: #94A3B8; margin-top: 4px;">Roam together</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Hero -->
                    <tr>
                        <td style="padding: 40px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                            <h1 style="font-size: 28px; font-weight: bold; color: #F8FAFC; margin: 0 0 16px 0;">Welcome aboard, {display_name}!</h1>
                            <p style="font-size: 16px; color: #94A3B8; line-height: 1.6; margin: 0;">
                                Your account is verified and ready to go. Start planning your first group trip today.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- What You Can Do (Feature Cards) -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;" class="padding-mobile">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td width="32%" class="stack" style="background-color: #0F172A; border-radius: 8px; padding: 20px; text-align: center; vertical-align: top;">
                                        <div style="font-size: 24px; margin-bottom: 12px;">✈️</div>
                                        <div style="font-weight: bold; color: #F8FAFC; margin-bottom: 8px;">Plan Group Trips</div>
                                        <div style="font-size: 13px; color: #94A3B8; line-height: 1.5;">Create trips, invite friends, vote on destinations together.</div>
                                    </td>
                                    <td width="2%" class="stack" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
                                    <td width="32%" class="stack" style="background-color: #0F172A; border-radius: 8px; padding: 20px; text-align: center; vertical-align: top;">
                                        <div style="font-size: 24px; margin-bottom: 12px;">💸</div>
                                        <div style="font-weight: bold; color: #F8FAFC; margin-bottom: 8px;">Split Expenses</div>
                                        <div style="font-size: 13px; color: #94A3B8; line-height: 1.5;">Track costs, split bills, and settle up instantly.</div>
                                    </td>
                                    <td width="2%" class="stack" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
                                    <td width="32%" class="stack" style="background-color: #0F172A; border-radius: 8px; padding: 20px; text-align: center; vertical-align: top;">
                                        <div style="font-size: 24px; margin-bottom: 12px;">📍</div>
                                        <div style="font-weight: bold; color: #F8FAFC; margin-bottom: 8px;">Coordinate Live</div>
                                        <div style="font-size: 13px; color: #94A3B8; line-height: 1.5;">Share location, set meet points, and stay in sync during trips.</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td style="padding: 20px 40px 40px 40px; text-align: center;" class="padding-mobile">
                            <a href="https://rovvy.app/dashboard" style="display: inline-block; background-color: #0F766E; color: #F8FAFC; padding: 16px 40px; border-radius: 8px; font-size: 18px; font-weight: bold; text-decoration: none;">Start Planning Now</a>
                        </td>
                    </tr>
                    
                    <!-- Quick Start Tips -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;" class="padding-mobile">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0F172A; border-radius: 8px; padding: 24px 32px;">
                                <tr>
                                    <td>
                                        <h2 style="font-size: 18px; font-weight: bold; color: #F8FAFC; margin: 0 0 20px 0;">Get started in 3 steps</h2>
                                        
                                        <div style="border-left: 3px solid #0F766E; padding-left: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: bold; color: #F8FAFC; font-size: 14px;">Create your first trip</div>
                                            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Go to Plan → New Trip</div>
                                        </div>
                                        
                                        <div style="border-left: 3px solid #0F766E; padding-left: 16px; margin-bottom: 16px;">
                                            <div style="font-weight: bold; color: #F8FAFC; font-size: 14px;">Invite your crew</div>
                                            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Share the invite link with friends</div>
                                        </div>
                                        
                                        <div style="border-left: 3px solid #0F766E; padding-left: 16px;">
                                            <div style="font-weight: bold; color: #F8FAFC; font-size: 14px;">Explore destinations</div>
                                            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Browse flights, hotels & activities</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Social Section -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px; text-align: center;" class="padding-mobile">
                            <p style="font-size: 14px; color: #94A3B8; margin: 0 0 12px 0;">Follow us for travel inspiration</p>
                            <a href="https://instagram.com/rovvyapp" style="color: #0F766E; text-decoration: none; margin: 0 10px; font-size: 14px; font-weight: bold;">Instagram: @rovvyapp</a>
                            <a href="https://tiktok.com/@rovvyapp" style="color: #0F766E; text-decoration: none; margin: 0 10px; font-size: 14px; font-weight: bold;">TikTok: @rovvyapp</a>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0F172A; padding: 24px 40px; text-align: center; font-size: 12px; color: #94A3B8;">
                            <p style="margin: 0 0 8px 0;">You're receiving this because you created a Rovvy account with {email}.</p>
                            <p style="margin: 0 0 16px 0;">© 2026 Rovvy. Roam together.</p>
                            <a href="https://rovvy.app/profile" style="color: #0F766E; text-decoration: none;">Manage preferences</a>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
            
            plain = f"""Welcome to Rovvy, {display_name}!

Your email is verified and you're ready to roam together.

What you can do:
✈️ Plan group trips together
💸 Split expenses instantly  
📍 Coordinate live during trips

Get started: https://rovvy.app/dashboard

Quick start:
1. Create your first trip → Plan → New Trip
2. Invite friends → Share invite link
3. Explore → Browse flights & hotels

Follow us:
Instagram: @rovvyapp
TikTok: @rovvyapp

© 2026 Rovvy. Roam together.
Manage preferences: https://rovvy.app/profile"""
            
            message = MessageSchema(
                subject=subject,
                recipients=[email],
                body=html,
                subtype=MessageType.html,
                alternative_body=plain,
                multipart_subtype=MultipartSubtypeEnum.alternative
            )
            fm = FastMail(self.get_mail_config())
            await fm.send_message(message)
            return True
        except Exception as e:
            print(f"Welcome email failed: {e}")
            return False
