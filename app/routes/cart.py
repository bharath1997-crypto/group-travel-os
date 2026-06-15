from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.user import User
from app.schemas.cart import (
    CartItemCreate,
    CartItemResponse,
    CartConvertToTripRequest,
    CartConvertToTripResponse,
    CartCountResponse
)
from app.services.cart_service import CartService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/cart", tags=["cart"])

@router.get("", response_model=list[CartItemResponse])
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[CartItemResponse]:
    return CartService.get_cart_items(db, current_user.id)

@router.post("", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_cart(
    body: CartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CartItemResponse:
    return CartService.add_item(db, current_user.id, body)

@router.delete("/{item_id}")
def remove_from_cart(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    CartService.remove_item(db, current_user.id, item_id)
    return {"message": "Item removed from cart"}

@router.delete("")
def clear_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    CartService.clear_cart(db, current_user.id)
    return {"message": "Cart cleared"}

@router.post("/convert-to-trip", response_model=CartConvertToTripResponse)
def convert_to_trip(
    body: CartConvertToTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CartConvertToTripResponse:
    trip_id = CartService.convert_to_trip(db, current_user, body)
    return CartConvertToTripResponse(trip_id=trip_id)

@router.get("/count", response_model=CartCountResponse)
def get_cart_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CartCountResponse:
    count = CartService.get_cart_count(db, current_user.id)
    return CartCountResponse(count=count)
