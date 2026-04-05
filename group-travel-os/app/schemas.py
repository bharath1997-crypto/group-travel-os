from marshmallow import Schema, fields, validate


class TripSchema(Schema):
    id = fields.Int(dump_only=True)
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    destination = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    start_date = fields.Date(load_default=None)
    end_date = fields.Date(load_default=None)
    created_at = fields.DateTime(dump_only=True)


class MemberSchema(Schema):
    id = fields.Int(dump_only=True)
    trip_id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(load_default=None)
    joined_at = fields.DateTime(dump_only=True)


class ItineraryItemSchema(Schema):
    id = fields.Int(dump_only=True)
    trip_id = fields.Int(dump_only=True)
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    description = fields.Str(load_default=None)
    scheduled_at = fields.DateTime(load_default=None)
    location = fields.Str(load_default=None, validate=validate.Length(max=200))
    created_at = fields.DateTime(dump_only=True)


class ExpenseSchema(Schema):
    id = fields.Int(dump_only=True)
    trip_id = fields.Int(dump_only=True)
    paid_by = fields.Int(required=True)
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    amount = fields.Decimal(required=True, places=2, as_string=True)
    currency = fields.Str(load_default="USD", validate=validate.Length(max=10))
    created_at = fields.DateTime(dump_only=True)


class PollOptionSchema(Schema):
    id = fields.Int(dump_only=True)
    poll_id = fields.Int(dump_only=True)
    label = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    vote_count = fields.Int(dump_only=True)


class PollSchema(Schema):
    id = fields.Int(dump_only=True)
    trip_id = fields.Int(dump_only=True)
    question = fields.Str(required=True, validate=validate.Length(min=1, max=500))
    options = fields.List(fields.Nested(PollOptionSchema), load_default=[])
    created_at = fields.DateTime(dump_only=True)


class VoteSchema(Schema):
    option_id = fields.Int(required=True)
    member_id = fields.Int(required=True)
