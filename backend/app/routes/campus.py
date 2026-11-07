from flask import Blueprint, jsonify
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.decorators import role_required
from app.extensions import db
from app.models import CampusZone
from app.routes.common import error_response, json_object, required_text

campus_bp = Blueprint("campus_zones", __name__)


def serialize_zone(zone):
    return {
        "id": zone.id,
        "name": zone.name,
        "description": zone.description,
        "latitude": zone.latitude,
        "longitude": zone.longitude,
        "radius_meters": zone.radius_meters,
    }


@campus_bp.get("")
def list_zones():
    zones = db.session.scalars(
        select(CampusZone).order_by(CampusZone.name)
    ).all()
    return jsonify(zones=[serialize_zone(zone) for zone in zones]), 200


@campus_bp.post("")
@role_required("admin")
def create_zone():
    data, error = json_object()
    if error:
        return error
    name, error = required_text(data, "name", "Zone name", 120)
    if error:
        return error_response(error, 400)
    try:
        latitude = float(data["latitude"])
        longitude = float(data["longitude"])
        radius = float(data.get("radius_meters", 100))
    except (KeyError, TypeError, ValueError):
        return error_response("Valid latitude and longitude are required.", 400)
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180 or radius <= 0:
        return error_response("Zone coordinates or radius are out of range.", 400)
    description = data.get("description")
    if description is not None and (
        not isinstance(description, str) or len(description.strip()) > 500
    ):
        return error_response("Zone description must be 500 characters or fewer.", 400)

    zone = CampusZone(
        name=name,
        description=description.strip() if description else None,
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius,
    )
    db.session.add(zone)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("A campus zone with this name already exists.", 409)
    return jsonify(zone=serialize_zone(zone)), 201
