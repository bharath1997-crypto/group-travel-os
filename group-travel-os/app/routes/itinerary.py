from flask import Blueprint, request, jsonify
from .. import db
from ..models import Trip, ItineraryItem
from ..schemas import ItineraryItemSchema
from marshmallow import ValidationError

itinerary_bp = Blueprint("itinerary", __name__)
item_schema = ItineraryItemSchema()
items_schema = ItineraryItemSchema(many=True)


@itinerary_bp.get("/<int:trip_id>/itinerary")
def list_items(trip_id: int):
    db.get_or_404(Trip, trip_id)
    items = ItineraryItem.query.filter_by(trip_id=trip_id).order_by(ItineraryItem.scheduled_at).all()
    return jsonify(items_schema.dump(items)), 200


@itinerary_bp.post("/<int:trip_id>/itinerary")
def add_item(trip_id: int):
    db.get_or_404(Trip, trip_id)
    try:
        data = item_schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    item = ItineraryItem(trip_id=trip_id, **data)
    db.session.add(item)
    db.session.commit()
    return jsonify(item_schema.dump(item)), 201


@itinerary_bp.put("/<int:trip_id>/itinerary/<int:item_id>")
def update_item(trip_id: int, item_id: int):
    item = ItineraryItem.query.filter_by(id=item_id, trip_id=trip_id).first_or_404()
    try:
        data = item_schema.load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    for key, value in data.items():
        setattr(item, key, value)
    db.session.commit()
    return jsonify(item_schema.dump(item)), 200


@itinerary_bp.delete("/<int:trip_id>/itinerary/<int:item_id>")
def delete_item(trip_id: int, item_id: int):
    item = ItineraryItem.query.filter_by(id=item_id, trip_id=trip_id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Itinerary item deleted"}), 200
