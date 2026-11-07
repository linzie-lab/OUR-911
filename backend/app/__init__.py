from pathlib import Path

import click
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import select
from werkzeug.security import generate_password_hash

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.config import Config
from app.database import migrate_sqlite_schema
from app.extensions import db, jwt
from app import models
from app.routes.campus import campus_bp
from app.routes.damu import damu_bp
from app.routes.facilities import facilities_bp
from app.routes.auth import auth_bp
from app.routes.health import health_bp
from app.routes.incidents import incidents_bp
from app.routes.intelligence import intelligence_bp


def create_app(test_config=None):
    instance_path = Path(__file__).resolve().parent.parent / "instance"
    app = Flask(
        __name__,
        instance_path=str(instance_path),
        instance_relative_config=True,
    )
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        database_path = Path(app.instance_path, "our911.db").as_posix()
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{database_path}"

    db.init_app(app)
    jwt.init_app(app)

    @jwt.unauthorized_loader
    def missing_token(_reason):
        return jsonify(error="Authentication is required."), 401

    @jwt.invalid_token_loader
    def invalid_token(_reason):
        return jsonify(error="Authentication token is invalid."), 401

    @jwt.expired_token_loader
    def expired_token(_jwt_header, _jwt_payload):
        return jsonify(error="Authentication token has expired."), 401

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["CORS_ORIGINS"],
            }
        },
    )
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(incidents_bp, url_prefix="/api/incidents")
    app.register_blueprint(intelligence_bp, url_prefix="/api/intelligence")
    app.register_blueprint(damu_bp, url_prefix="/api/damu")
    app.register_blueprint(facilities_bp, url_prefix="/api/facilities")
    app.register_blueprint(campus_bp, url_prefix="/api/campus-zones")

    with app.app_context():
        db.create_all()
        migrate_sqlite_schema()

    @app.cli.command("create-user")
    def create_user_command():
        """Create or promote an account through a trusted operator prompt."""
        from app.models import User

        full_name = click.prompt("Full name").strip()
        email = click.prompt("Email").strip().lower()
        role = click.prompt(
            "Role",
            type=click.Choice(["admin", "health_personnel", "student"]),
        )
        password = click.prompt("Password", hide_input=True, confirmation_prompt=True)
        if not full_name or len(full_name) > 120 or len(email) > 255:
            raise click.ClickException("Name or email is invalid.")
        if len(password) < 8 or len(password) > 128:
            raise click.ClickException("Password must be 8–128 characters.")

        user = db.session.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(full_name=full_name, email=email, role=role)
            db.session.add(user)
        else:
            user.full_name = full_name
            user.role = role
        user.password_hash = generate_password_hash(password)
        db.session.commit()
        click.echo(f"Account {email} is now configured as {role}.")

    return app
