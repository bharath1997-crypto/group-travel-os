from config import settings
print(f"GOOGLE_CLIENT_ID: {settings.GOOGLE_CLIENT_ID}")
print(f"GOOGLE_CLIENT_SECRET: {'Set' if settings.GOOGLE_CLIENT_SECRET else 'Not Set'}")
