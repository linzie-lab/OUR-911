from pathlib import Path

from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.extensions import db, jwt
from app.routes.health import health_bp


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        database_path = Path(app.instance_path, "our911.db").as_posix()
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{database_path}"

    db.init_app(app)
    jwt.init_app(app)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["CORS_ORIGINS"],
            }
        },
    )
    app.register_blueprint(health_bp, url_prefix="/api")

    return app
