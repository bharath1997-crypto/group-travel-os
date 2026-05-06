import os
from dotenv import load_dotenv

load_dotenv()

from app.utils.database import engine, Base
from app.models.explore_content import ExploreContent
from app.services.external.youtube_provider import YouTubeProvider

def main():
    print("Creating ExploreContent table if not exists...")
    Base.metadata.create_all(bind=engine, tables=[ExploreContent.__table__])
    print("Table ready.")

    print("\nTesting YouTube API Key...")
    if not os.getenv("YOUTUBE_API_KEY"):
        print("No YOUTUBE_API_KEY configured.")
    try:
        yt = YouTubeProvider()
        shorts = yt.fetch_shorts("Chicago")
        print(f"Fetched {len(shorts)} shorts.")

        if shorts:
            print(f"Sample Video Title: {shorts[0].get('snippet', {}).get('title')}")
            print(f"Sample Video ID: {shorts[0].get('id', {}).get('videoId')}")
        else:
            print(
                "No shorts found. Please verify the YOUTUBE_API_KEY is valid "
                "and has YouTube Data API v3 enabled."
            )
    except Exception as e:
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
