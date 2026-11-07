import json

from flask import Blueprint, jsonify, request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.auth.decorators import role_required
from app.extensions import db
from app.models import Facility
from app.routes.common import error_response, json_object, required_text

facilities_bp = Blueprint("facilities", __name__)


def serialize_facility(facility):
    try:
        services = json.loads(facility.services or "[]")
    except (TypeError, json.JSONDecodeError):
        services = []
    return {
        "id": facility.id,
        "name": facility.name,
        "facility_type": facility.facility_type,
        "address": facility.address,
        "phone": facility.phone,
        "latitude": facility.latitude,
        "longitude": facility.longitude,
        "services": services,
        "operating_hours": facility.operating_hours if facility.is_verified else None,
        "description": facility.description,
        "is_verified": facility.is_verified,
    }


def apply_facility_fields(facility, data, partial=False):
    required_fields = {
        "name": ("name", "Facility name", 160),
        "facility_type": ("facility_type", "Facility type", 64),
        "address": ("address", "Address", 255),
    }
    for field, (key, label, maximum) in required_fields.items():
        if partial and key not in data:
            continue
        value, error = required_text(data, key, label, maximum)
        if error:
            return error
        setattr(facility, field, value)

    for key, maximum in (
        ("phone", 32),
        ("operating_hours", 255),
        ("description", 5000),
    ):
        if key in data:
            value = data[key]
            if value is not None and (
                not isinstance(value, str) or len(value.strip()) > maximum
            ):
                return f"{key.replace('_', ' ').capitalize()} is invalid or too long."
            setattr(facility, key, value.strip() if value else None)

    if "services" in data:
        services = data["services"]
        if not isinstance(services, list) or any(
            not isinstance(service, str) or not service.strip() or len(service) > 80
            for service in services
        ):
            return "Services must be a list of non-empty strings up to 80 characters."
        facility.services = json.dumps([service.strip() for service in services])

    for coordinate, bounds in (("latitude", (-90, 90)), ("longitude", (-180, 180))):
        if coordinate in data:
            try:
                value = float(data[coordinate])
            except (TypeError, ValueError):
                return f"{coordinate.capitalize()} must be a valid number."
            if not bounds[0] <= value <= bounds[1]:
                return f"{coordinate.capitalize()} is out of range."
            setattr(facility, coordinate, value)

    if "is_verified" in data:
        if not isinstance(data["is_verified"], bool):
            return "is_verified must be true or false."
        facility.is_verified = data["is_verified"]
    return None


@facilities_bp.get("")
def list_facilities():
    statement = select(Facility).where(Facility.is_active.is_(True))
    search = request.args.get("search", "").strip()
    facility_type = request.args.get("type", "").strip()
    if search:
        statement = statement.where(Facility.name.ilike(f"%{search[:100]}%"))
    if facility_type:
        statement = statement.where(Facility.facility_type == facility_type[:64])
    facilities = db.session.scalars(
        statement.order_by(Facility.name).limit(100)
    ).all()
    return jsonify(facilities=[serialize_facility(item) for item in facilities]), 200


@facilities_bp.get("/summary")
def facility_summary():
    count = db.session.scalar(
        select(func.count(Facility.id)).where(Facility.is_active.is_(True))
    )
    return jsonify(registered_facilities=count or 0), 200


@facilities_bp.get("/<int:facility_id>")
def get_facility(facility_id):
    facility = db.session.get(Facility, facility_id)
    if facility is None or not facility.is_active:
        return error_response("Facility was not found.", 404)
    return jsonify(facility=serialize_facility(facility)), 200


@facilities_bp.post("")
@role_required("admin")
def create_facility():
    data, error = json_object()
    if error:
        return error
    facility = Facility()
    error = apply_facility_fields(facility, data)
    if error:
        return error_response(error, 400)
    db.session.add(facility)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("A facility with this name already exists.", 409)
    return jsonify(facility=serialize_facility(facility)), 201


@facilities_bp.patch("/<int:facility_id>")
@role_required("admin")
def update_facility(facility_id):
    facility = db.session.get(Facility, facility_id)
    if facility is None:
        return error_response("Facility was not found.", 404)
    data, error = json_object()
    if error:
        return error
    error = apply_facility_fields(facility, data, partial=True)
    if error:
        return error_response(error, 400)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("A facility with this name already exists.", 409)
    return jsonify(facility=serialize_facility(facility)), 200


@facilities_bp.delete("/<int:facility_id>")
@role_required("admin")
def deactivate_facility(facility_id):
    facility = db.session.get(Facility, facility_id)
    if facility is None:
        return error_response("Facility was not found.", 404)
    facility.is_active = False
    db.session.commit()
    return jsonify(message="Facility removed from the directory."), 200
