import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import config

db = SQLAlchemy()


def create_app(config_name: str | None = None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    db.init_app(app)

    from .routes.trips import trips_bp
    from .routes.members import members_bp
    from .routes.itinerary import itinerary_bp
    from .routes.expenses import expenses_bp
    from .routes.polls import polls_bp

    app.register_blueprint(trips_bp, url_prefix="/trips")
    app.register_blueprint(members_bp, url_prefix="/trips")
    app.register_blueprint(itinerary_bp, url_prefix="/trips")
    app.register_blueprint(expenses_bp, url_prefix="/trips")
    app.register_blueprint(polls_bp, url_prefix="/trips")

    with app.app_context():
        db.create_all()

    return app
