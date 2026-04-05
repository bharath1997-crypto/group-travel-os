# Group Travel OS

A REST API for planning and managing group travel — trips, members, itineraries, shared expenses, and group polls/voting.

## Tech Stack

- **Python 3.10+**
- **Flask 3** — web framework
- **Flask-SQLAlchemy** — ORM (SQLite by default, swap to PostgreSQL for production)
- **Marshmallow** — request/response validation and serialisation

## Project Structure

```
group-travel-os/
├── app/
│   ├── __init__.py          # App factory
│   ├── models.py            # SQLAlchemy models (Trip, Member, Itinerary, Expense, Poll)
│   ├── routes/
│   │   ├── trips.py
│   │   ├── members.py
│   │   ├── itinerary.py
│   │   ├── expenses.py
│   │   └── polls.py
│   └── schemas.py           # Marshmallow schemas
├── tests/
│   └── test_trips.py
├── requirements.txt
├── config.py
├── run.py
└── README.md
```

## Setup

```bash
cd group-travel-os
python3 -m pip install -r requirements.txt
python3 run.py
```

The server starts at `http://localhost:5000`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FLASK_ENV` | `default` (development) | `development`, `testing`, or `production` |
| `SECRET_KEY` | `dev-secret-change-in-production` | Flask secret key |
| `DATABASE_URL` | SQLite file in project root | Production DB URL |
| `DEV_DATABASE_URL` | SQLite file in project root | Dev DB URL |

## API Endpoints

### Trips

| Method | Path | Description |
|---|---|---|
| `GET` | `/trips/` | List all trips |
| `POST` | `/trips/` | Create a trip |
| `GET` | `/trips/<id>` | Get a trip |
| `PUT` | `/trips/<id>` | Update a trip |
| `DELETE` | `/trips/<id>` | Delete a trip |

**Example — create a trip:**
```json
POST /trips/
{
  "title": "Summer Escape",
  "destination": "Paris",
  "start_date": "2026-07-01",
  "end_date": "2026-07-14"
}
```

### Members

| Method | Path | Description |
|---|---|---|
| `GET` | `/trips/<id>/members` | List members |
| `POST` | `/trips/<id>/members` | Add a member |
| `DELETE` | `/trips/<id>/members/<member_id>` | Remove a member |

### Itinerary

| Method | Path | Description |
|---|---|---|
| `GET` | `/trips/<id>/itinerary` | List itinerary items |
| `POST` | `/trips/<id>/itinerary` | Add an item |
| `PUT` | `/trips/<id>/itinerary/<item_id>` | Update an item |
| `DELETE` | `/trips/<id>/itinerary/<item_id>` | Delete an item |

### Expenses

| Method | Path | Description |
|---|---|---|
| `GET` | `/trips/<id>/expenses` | List expenses |
| `POST` | `/trips/<id>/expenses` | Log an expense |
| `DELETE` | `/trips/<id>/expenses/<expense_id>` | Delete an expense |

**Example — log an expense:**
```json
POST /trips/1/expenses
{
  "paid_by": 2,
  "title": "Hotel night 1",
  "amount": "120.00",
  "currency": "USD"
}
```

### Polls & Voting

| Method | Path | Description |
|---|---|---|
| `GET` | `/trips/<id>/polls` | List polls |
| `POST` | `/trips/<id>/polls` | Create a poll with options |
| `POST` | `/trips/<id>/polls/<poll_id>/vote` | Cast a vote |
| `DELETE` | `/trips/<id>/polls/<poll_id>` | Delete a poll |

**Example — create a poll:**
```json
POST /trips/1/polls
{
  "question": "Where should we eat tonight?",
  "options": [
    { "label": "Pizza place" },
    { "label": "Sushi bar" },
    { "label": "Tacos" }
  ]
}
```

**Example — vote:**
```json
POST /trips/1/polls/1/vote
{
  "option_id": 2,
  "member_id": 3
}
```

## Running Tests

```bash
cd group-travel-os
python3 -m pip install pytest
python3 -m pytest tests/ -v
```

## License

Unlicensed — internal prototype. Update as needed for your use.
