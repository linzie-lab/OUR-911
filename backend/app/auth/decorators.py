from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import User


def role_required(*allowed_roles):
    def decorator(view_function):
        @wraps(view_function)
        @jwt_required()
        def wrapped(*args, **kwargs):
            try:
                user_id = int(get_jwt_identity())
            except (TypeError, ValueError):
                return jsonify(error="Invalid authentication token."), 401

            user = db.session.get(User, user_id)
            if user is None:
                return jsonify(error="User account no longer exists."), 401
            if user.role not in allowed_roles:
                return jsonify(error="You are not authorized to access this resource."), 403

            g.current_user = user
            return view_function(*args, **kwargs)

        return wrapped

    return decorator


def responder_required(view_function):
    @wraps(view_function)
    @jwt_required()
    def wrapped(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify(error="Invalid authentication token."), 401

        user = db.session.get(User, user_id)
        if user is None:
            return jsonify(error="User account no longer exists."), 401
        if user.role != "admin" and (
            user.role != "health_personnel" or not user.responder_approved
        ):
            return jsonify(error="Approved emergency responder access is required."), 403

        g.current_user = user
        return view_function(*args, **kwargs)

    return wrapped
