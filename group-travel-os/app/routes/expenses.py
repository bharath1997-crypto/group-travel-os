from flask import Blueprint, request, jsonify
from .. import db
from ..models import Trip, Member, Expense
from ..schemas import ExpenseSchema
from marshmallow import ValidationError

expenses_bp = Blueprint("expenses", __name__)
expense_schema = ExpenseSchema()
expenses_schema = ExpenseSchema(many=True)


@expenses_bp.get("/<int:trip_id>/expenses")
def list_expenses(trip_id: int):
    db.get_or_404(Trip, trip_id)
    expenses = Expense.query.filter_by(trip_id=trip_id).order_by(Expense.created_at.desc()).all()
    return jsonify(expenses_schema.dump(expenses)), 200


@expenses_bp.post("/<int:trip_id>/expenses")
def add_expense(trip_id: int):
    db.get_or_404(Trip, trip_id)
    try:
        data = expense_schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 422

    paid_by = data.get("paid_by")
    if not Member.query.filter_by(id=paid_by, trip_id=trip_id).first():
        return jsonify({"errors": {"paid_by": ["Member not found in this trip"]}}), 422

    expense = Expense(trip_id=trip_id, **data)
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense_schema.dump(expense)), 201


@expenses_bp.delete("/<int:trip_id>/expenses/<int:expense_id>")
def delete_expense(trip_id: int, expense_id: int):
    expense = Expense.query.filter_by(id=expense_id, trip_id=trip_id).first_or_404()
    db.session.delete(expense)
    db.session.commit()
    return jsonify({"message": "Expense deleted"}), 200
