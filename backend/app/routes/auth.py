import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import User

auth_bp = Blueprint("auth", __name__)
VALID_ROLES = {"student", "health_personnel", "admin"}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def _json_object():
    if not request.is_json:
        return None, (jsonify(error="Content-Type must be application/json."), 400)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify(error="Request body must be a JSON object."), 400)

    return data, None


def _serialize_user(user):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "responder_approved": user.responder_approved,
    }


@auth_bp.post("/register")
def register():
    data, error_response = _json_object()
    if error_response:
        return error_response

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "student")

    if not isinstance(full_name, str) or not full_name.strip():
        return jsonify(error="Full name is required."), 400
    full_name = full_name.strip()
    if len(full_name) > 120:
        return jsonify(error="Full name must be 120 characters or fewer."), 400

    if not isinstance(email, str) or not email.strip():
        return jsonify(error="A valid email address is required."), 400
    email = email.strip().lower()
    if len(email) > 255 or not EMAIL_PATTERN.fullmatch(email):
        return jsonify(error="A valid email address is required."), 400

    if not isinstance(password, str) or not password:
        return jsonify(error="Password is required."), 400
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify(
            error=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        ), 400
    if len(password) > MAX_PASSWORD_LENGTH:
        return jsonify(
            error=f"Password must be {MAX_PASSWORD_LENGTH} characters or fewer."
        ), 400

    if not isinstance(role, str) or role not in VALID_ROLES:
        return jsonify(error="Role must be student, health_personnel, or admin."), 400
    if role != "student":
        return jsonify(
            error="Public registration is limited to the student role."
        ), 403

    user = User(full_name=full_name, email=email, role="student")
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="An account with this email already exists."), 409

    return jsonify(user=_serialize_user(user)), 201


@auth_bp.post("/login")
def login():
    data, error_response = _json_object()
    if error_response:
        return error_response

    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not email.strip():
        return jsonify(error="A valid email address is required."), 400
    email = email.strip().lower()
    if len(email) > 255 or not EMAIL_PATTERN.fullmatch(email):
        return jsonify(error="A valid email address is required."), 400
    if not isinstance(password, str) or not password:
        return jsonify(error="Password is required."), 400

    user = db.session.scalar(db.select(User).where(User.email == email))
    if user is None or not user.check_password(password):
        return jsonify(error="Invalid email or password."), 401

    access_token = create_access_token(identity=str(user.id))
    return jsonify(
        access_token=access_token,
        token_type="Bearer",
        user=_serialize_user(user),
    ), 200


@auth_bp.get("/me")
@jwt_required()
def get_me():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify(error="Invalid authentication token."), 401

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="User account no longer exists."), 401

    return jsonify(user=_serialize_user(user)), 200


@auth_bp.patch("/me")
@jwt_required()
def update_me():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify(error="Invalid authentication token."), 401
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="User account no longer exists."), 401

    data, error_response = _json_object()
    if error_response:
        return error_response
    full_name = data.get("full_name")
    if not isinstance(full_name, str) or not full_name.strip():
        return jsonify(error="Full name is required."), 400
    full_name = full_name.strip()
    if len(full_name) > 120:
        return jsonify(error="Full name must be 120 characters or fewer."), 400

    user.full_name = full_name
    db.session.commit()
    return jsonify(user=_serialize_user(user)), 200


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify(error="Invalid authentication token."), 401
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="User account no longer exists."), 401

    data, error_response = _json_object()
    if error_response:
        return error_response
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    if not isinstance(current_password, str) or not current_password:
        return jsonify(error="Current password is required."), 400
    if not user.check_password(current_password):
        return jsonify(error="Current password is incorrect."), 401
    if not isinstance(new_password, str) or len(new_password) < MIN_PASSWORD_LENGTH:
        return jsonify(
            error=f"New password must be at least {MIN_PASSWORD_LENGTH} characters long."
        ), 400
    if len(new_password) > MAX_PASSWORD_LENGTH:
        return jsonify(
            error=f"New password must be {MAX_PASSWORD_LENGTH} characters or fewer."
        ), 400

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify(message="Password updated successfully."), 200
