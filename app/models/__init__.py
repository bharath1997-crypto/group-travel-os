"""
app/models/__init__.py — Model registry

CRITICAL FOR ALEMBIC:
    Alembic detects schema changes by importing models before autogenerate runs.
    If a model is NOT imported here, alembic revision --autogenerate will not
    see it and will NOT generate the migration for that table.

RULE:
    Every time you create a new model file, add its import here immediately.
    Do this before running any alembic commands.

CURRENT MODELS:
    Uncomment each line as you build the corresponding step.
"""

# Step 6  — Uncomment when you create app/models/user.py
from app.models.user import User

# Step 10 — Uncomment when you create app/models/group.py
# from app.models.group import Group, GroupMember

# Step 13 — Uncomment when you create app/models/trip.py
# from app.models.trip import Trip

# Step 16 — Uncomment when you create app/models/location.py
# from app.models.location import Location, TripLocation

# Step 18 — Uncomment when you create app/models/poll.py
# from app.models.poll import Poll, PollOption, Vote

# Step 21 — Uncomment when you create app/models/expense.py
# from app.models.expense import Expense, ExpenseSplit

__all__: list[str] = ["User"]
