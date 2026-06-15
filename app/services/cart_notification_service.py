import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session

from app.models.cart import TravelCart
from app.models.user import User
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

class CartNotificationService:

    @staticmethod
    def send_abandoned_notifications(db: Session = None) -> None:
        """Background job to send abandoned cart notifications."""
        close_db = False
        if db is None:
            from app.utils.database import SessionLocal
            db = SessionLocal()
            close_db = True

        try:
            now = datetime.utcnow()
            thirty_mins_ago = now - timedelta(minutes=30)
            twenty_four_hours_ago = now - timedelta(hours=24)

            # Find users who:
            # 1. Have at least one item in their cart
            # 2. Last item added was > 30 minutes ago
            # 3. Were not notified in the last 24 hours (notified_at is None or notified_at < 24 hours ago)
            # 4. Have an FCM token
            stmt = select(
                TravelCart.user_id,
                func.count(TravelCart.id).label("count"),
                func.max(TravelCart.added_at).label("last_added"),
                func.max(TravelCart.notified_at).label("last_notified")
            ).group_by(TravelCart.user_id)
            
            results = db.execute(stmt).all()
            
            for user_id, count, last_added, last_notified in results:
                # Check condition 2: last_added < thirty_mins_ago
                if last_added > thirty_mins_ago:
                    continue
                # Check condition 3: last_notified is None or last_notified < twenty_four_hours_ago
                if last_notified and last_notified > twenty_four_hours_ago:
                    continue
                
                # Fetch user
                user_stmt = select(User).where(User.id == user_id)
                user = db.execute(user_stmt).scalar_one_or_none()
                if not user or not user.fcm_token or not user.fcm_token.strip():
                    continue
                
                # Get the first item name in the cart to display in body
                first_item_stmt = select(TravelCart.item_name).where(
                    TravelCart.user_id == user_id
                ).order_by(TravelCart.added_at.asc()).limit(1)
                first_item_name = db.execute(first_item_stmt).scalar() or "An experience"

                # Send notification
                title = f"You have {count} saved experiences 🗺️"
                body = f"Ready to plan your trip? {first_item_name} is waiting."
                data = { "action": "open_cart" }
                
                logger.info(f"Sending abandoned cart notification to user {user_id}")
                
                # We wrap FCM in try/except as per CRITICAL RULE 9
                success = False
                try:
                    success = NotificationService.send_to_token(
                        token=user.fcm_token,
                        title=title,
                        body=body,
                        data=data
                    )
                except Exception as fcm_exc:
                    logger.error(f"FCM always in try/except violation prevented: {fcm_exc}")

                if success:
                    # Update notified_at for all items in the user's cart in 2.0 update style
                    db.execute(
                        update(TravelCart)
                        .where(TravelCart.user_id == user_id)
                        .values(notified_at=now)
                    )
                    db.commit()

        except Exception as e:
            logger.error(f"Error in send_abandoned_notifications: {e}")
        finally:
            if close_db:
                db.close()
