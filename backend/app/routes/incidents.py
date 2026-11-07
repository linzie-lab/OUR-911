from flask import Blueprint, g, jsonify, request
from sqlalchemy import and_, or_, select

from app.auth.decorators import responder_required, role_required
from app.extensions import db
from app.models import CampusZone, Incident, IncidentUpdate, Notification, User
from app.routes.common import error_response, json_object, required_text

incidents_bp = Blueprint("incidents", __name__)
INCIDENT_CATEGORIES = {
    "medical_emergency",
    "injury",
    "sudden_illness",
    "mental_health_concern",
    "accident",
    "fire",
    "security_emergency",
    "other",
}
SEVERITIES = {"low", "medium", "high", "critical"}
API_STATUSES = {
    "submitted",
    "under_review",
    "pending",
    "accepted",
    "responding",
    "resolved",
}
DB_STATUSES = {
    "submitted": "reported",
    "under_review": "in_progress",
    "pending": "reported",
    "accepted": "acknowledged",
    "responding": "in_progress",
    "resolved": "resolved",
}
LEGACY_STATUSES = {
    "reported": "submitted",
    "acknowledged": "under_review",
    "in_progress": "under_review",
    "resolved": "resolved",
    "cancelled": "resolved",
}
RESPONSE_STATUSES = {
    "reported": "pending",
    "acknowledged": "accepted",
    "in_progress": "responding",
    "resolved": "resolved",
    "cancelled": "rejected",
}


def serialize_incident(
    incident,
    include_contact=False,
    include_reporter=False,
):
    updates = [
        {
            "id": update.id,
            "status": update.status,
            "message": update.message,
            "created_at": update.created_at.isoformat(),
        }
        for update in incident.updates
    ]
    result = {
        "id": incident.id,
        "category": incident.incident_type,
        "description": incident.description,
        "location": incident.location_description,
        "severity": incident.priority,
        "status": LEGACY_STATUSES.get(incident.status, "submitted"),
        "response_status": RESPONSE_STATUSES.get(incident.status, "pending"),
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "history": updates,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "assigned_responder": (
            {
                "id": incident.assigned_responder.id,
                "name": incident.assigned_responder.full_name,
            }
            if incident.assigned_responder
            else None
        ),
    }
    if include_contact:
        result["contact_info"] = incident.contact_info
    if include_reporter and incident.reporter is not None:
        result["reporter"] = {
            "id": incident.reporter.id,
            "name": incident.reporter.full_name,
            "email": incident.reporter.email,
        }
    return result


@incidents_bp.get("")
@role_required("student", "admin", "health_personnel")
def list_incidents():
    statement = select(Incident).order_by(Incident.created_at.desc())
    is_staff = g.current_user.role == "admin" or (
        g.current_user.role == "health_personnel"
        and g.current_user.responder_approved
    )
    if not is_staff:
        statement = statement.where(Incident.reporter_id == g.current_user.id)

    category = request.args.get("category")
    severity = request.args.get("severity")
    status = request.args.get("status")
    if category:
        if category not in INCIDENT_CATEGORIES:
            return error_response("Select a valid incident category filter.", 400)
        statement = statement.where(Incident.incident_type == category)
    if severity:
        if severity not in SEVERITIES:
            return error_response("Select a valid severity filter.", 400)
        statement = statement.where(Incident.priority == severity)
    if status:
        if status not in DB_STATUSES:
            return error_response("Select a valid status filter.", 400)
        statement = statement.where(Incident.status == DB_STATUSES[status])
    incidents = db.session.scalars(statement.limit(100)).all()
    return jsonify(incidents=[
        serialize_incident(
            incident,
            include_contact=is_staff or incident.reporter_id == g.current_user.id,
            include_reporter=is_staff,
        )
        for incident in incidents
    ]), 200


@incidents_bp.get("/mine")
@role_required("student", "admin", "health_personnel")
def list_my_incidents():
    incidents = db.session.scalars(
        select(Incident)
        .where(Incident.reporter_id == g.current_user.id)
        .order_by(Incident.created_at.desc())
        .limit(100)
    ).all()
    return jsonify(
        incidents=[
            serialize_incident(incident, include_contact=True)
            for incident in incidents
        ]
    ), 200


def _create_incident(reporter_id):
    data, error = json_object()
    if error:
        return error

    category, error = required_text(data, "category", "Emergency type", 80)
    if error:
        return error_response(error, 400)
    if category not in INCIDENT_CATEGORIES:
        return error_response("Select a valid incident category.", 400)
    description, error = required_text(data, "description", "Description", 5000)
    if error:
        return error_response(error, 400)
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    if (latitude is None) != (longitude is None):
        return error_response("Provide both GPS coordinates or neither.", 400)
    if latitude is not None:
        try:
            if isinstance(latitude, bool) or isinstance(longitude, bool):
                raise ValueError
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            return error_response("GPS coordinates must be valid numbers.", 400)
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            return error_response("GPS coordinates are outside valid ranges.", 400)
    location = data.get("location")
    if location is None or (isinstance(location, str) and not location.strip()):
        if latitude is None:
            return error_response(
                "Campus location is required when GPS location is unavailable.",
                400,
            )
        location = "GPS location provided"
    elif not isinstance(location, str) or len(location.strip()) > 255:
        return error_response("Campus location is invalid or too long.", 400)
    else:
        location = location.strip()
    severity = data.get("severity", "medium")
    if not isinstance(severity, str) or severity not in SEVERITIES:
        return error_response("Severity must be low, medium, high, or critical.", 400)
    contact = data.get("contact_info")
    if contact is not None and (
        not isinstance(contact, str) or len(contact.strip()) > 120
    ):
        return error_response("Contact information must be 120 characters or fewer.", 400)

    zone_id = data.get("zone_id")
    if zone_id is not None:
        try:
            zone_id = int(zone_id)
        except (TypeError, ValueError):
            return error_response("Campus zone is invalid.", 400)
        if db.session.get(CampusZone, zone_id) is None:
            return error_response("Campus zone was not found.", 400)

    incident = Incident(
        reporter_id=reporter_id,
        zone_id=zone_id,
        incident_type=category,
        description=description,
        location_description=location,
        contact_info=contact.strip() if contact else None,
        priority=severity,
        status="reported",
        latitude=latitude,
        longitude=longitude,
    )
    incident.updates.append(
        IncidentUpdate(status="submitted", message="Incident report submitted.")
    )
    db.session.add(incident)
    responders = db.session.scalars(
        select(User).where(
            or_(
                User.role == "admin",
                and_(
                    User.role == "health_personnel",
                    User.responder_approved.is_(True),
                ),
            )
        )
    ).all()
    for responder in responders:
        db.session.add(
            Notification(
                user_id=responder.id,
                incident=incident,
                title="New emergency report",
                message=f"{category.replace('_', ' ').title()} reported at {location}.",
            )
        )
    db.session.commit()
    return jsonify(incident=serialize_incident(incident, include_contact=True)), 201


@incidents_bp.post("")
@role_required("student", "admin", "health_personnel")
def create_incident():
    return _create_incident(g.current_user.id)


@incidents_bp.post("/guest")
def create_guest_incident():
    response, status = _create_incident(None)
    if status == 201:
        return jsonify(
            message=(
                "Your report was submitted. Staff can review it, but guest "
                "reports cannot be viewed or tracked from this device."
            ),
            report_id=response.json["incident"]["id"],
        ), status
    return response, status


@incidents_bp.get("/<int:incident_id>")
@role_required("student", "admin", "health_personnel")
def get_incident(incident_id):
    incident = db.session.get(Incident, incident_id)
    if incident is None:
        return error_response("Incident was not found.", 404)
    is_staff = g.current_user.role == "admin" or (
        g.current_user.role == "health_personnel"
        and g.current_user.responder_approved
    )
    if not is_staff and incident.reporter_id != g.current_user.id:
        return error_response("You are not authorized to view this incident.", 403)
    return jsonify(
        incident=serialize_incident(
            incident,
            include_contact=True,
            include_reporter=is_staff,
        )
    ), 200


@incidents_bp.patch("/<int:incident_id>/status")
@responder_required
def update_incident_status(incident_id):
    incident = db.session.get(Incident, incident_id)
    if incident is None:
        return error_response("Incident was not found.", 404)
    data, error = json_object()
    if error:
        return error

    status = data.get("status")
    if not isinstance(status, str) or status not in API_STATUSES:
        return error_response(
            "Status must be pending, accepted, responding, or resolved.",
            400,
        )
    message = data.get("message", f"Status changed to {status.replace('_', ' ')}.")
    if not isinstance(message, str) or not message.strip() or len(message) > 1000:
        return error_response("Update message must be 1–1000 characters.", 400)

    if (
        g.current_user.role != "admin"
        and incident.assigned_responder_id != g.current_user.id
    ):
        return error_response(
            "Only the assigned responder can update this incident.",
            403,
        )
    incident.status = DB_STATUSES[status]
    incident.updates.append(
        IncidentUpdate(
            updated_by_id=g.current_user.id,
            status=status,
            message=message.strip(),
        )
    )
    if incident.reporter_id is not None:
        db.session.add(
            Notification(
                user_id=incident.reporter_id,
                incident=incident,
                title="Incident status updated",
                message=f"Your report is now {status.replace('_', ' ')}.",
            )
        )
    db.session.commit()
    return jsonify(
        incident=serialize_incident(
            incident,
            include_contact=True,
            include_reporter=True,
        )
    ), 200


@incidents_bp.get("/queue")
@responder_required
def responder_queue():
    active_statuses = Incident.status.in_(("reported", "acknowledged", "in_progress"))
    statement = select(Incident).where(
        or_(active_statuses, Incident.assigned_responder_id == g.current_user.id)
    )
    if g.current_user.role != "admin":
        statement = statement.where(
            or_(
                Incident.assigned_responder_id.is_(None),
                Incident.assigned_responder_id == g.current_user.id,
            )
        )
    incidents = db.session.scalars(
        statement.order_by(Incident.created_at.desc()).limit(200)
    ).all()
    return jsonify(
        incidents=[
            serialize_incident(
                incident,
                include_contact=True,
                include_reporter=True,
            )
            for incident in incidents
        ]
    ), 200


@incidents_bp.post("/<int:incident_id>/accept")
@responder_required
def accept_incident(incident_id):
    incident = db.session.get(Incident, incident_id)
    if incident is None:
        return error_response("Incident was not found.", 404)
    if incident.status != "reported":
        return error_response("Only pending incidents can be accepted.", 409)
    if (
        incident.assigned_responder_id not in (None, g.current_user.id)
        and g.current_user.role != "admin"
    ):
        return error_response("This incident is assigned to another responder.", 409)
    if g.current_user.role != "admin":
        incident.assigned_responder_id = g.current_user.id
    incident.status = "acknowledged"
    incident.updates.append(
        IncidentUpdate(
            updated_by_id=g.current_user.id,
            status="accepted",
            message="Incident accepted by an emergency responder.",
        )
    )
    if incident.reporter_id is not None:
        db.session.add(
            Notification(
                user_id=incident.reporter_id,
                incident=incident,
                title="Responder accepted your report",
                message="An emergency responder has accepted your incident.",
            )
        )
    db.session.commit()
    return jsonify(
        incident=serialize_incident(
            incident,
            include_contact=True,
            include_reporter=True,
        )
    ), 200


@incidents_bp.post("/<int:incident_id>/reject")
@responder_required
def reject_incident(incident_id):
    incident = db.session.get(Incident, incident_id)
    if incident is None:
        return error_response("Incident was not found.", 404)
    if incident.status not in ("reported", "acknowledged"):
        return error_response("This incident can no longer be rejected.", 409)
    if g.current_user.role != "admin" and incident.assigned_responder_id not in (
        None,
        g.current_user.id,
    ):
        return error_response("This incident is assigned to another responder.", 403)
    data, error = json_object()
    if error:
        return error
    reason, message_error = required_text(data, "reason", "Rejection reason", 1000)
    if message_error:
        return error_response(message_error, 400)
    incident.status = "cancelled"
    incident.updates.append(
        IncidentUpdate(
            updated_by_id=g.current_user.id,
            status="rejected",
            message=reason,
        )
    )
    if incident.reporter_id is not None:
        db.session.add(
            Notification(
                user_id=incident.reporter_id,
                incident=incident,
                title="Incident report closed",
                message=(
                    "A responder reviewed your report. Contact emergency "
                    "services if you still need help."
                ),
            )
        )
    db.session.commit()
    return jsonify(
        incident=serialize_incident(
            incident,
            include_contact=True,
            include_reporter=True,
        )
    ), 200


@incidents_bp.post("/<int:incident_id>/assign")
@role_required("admin")
def assign_incident(incident_id):
    incident = db.session.get(Incident, incident_id)
    if incident is None:
        return error_response("Incident was not found.", 404)
    data, error = json_object()
    if error:
        return error
    responder_id = data.get("responder_id")
    if isinstance(responder_id, bool):
        return error_response("Responder id is invalid.", 400)
    try:
        responder_id = int(responder_id)
    except (TypeError, ValueError):
        return error_response("Responder id is required.", 400)
    responder = db.session.get(User, responder_id)
    if (
        responder is None
        or responder.role != "health_personnel"
        or not responder.responder_approved
    ):
        return error_response("Choose an approved emergency responder.", 400)
    incident.assigned_responder_id = responder.id
    incident.updates.append(
        IncidentUpdate(
            updated_by_id=g.current_user.id,
            status=RESPONSE_STATUSES.get(incident.status, "pending"),
            message=f"Incident assigned to {responder.full_name}.",
        )
    )
    db.session.add(
        Notification(
            user_id=responder.id,
            incident=incident,
            title="Incident assigned to you",
            message=f"You have been assigned incident OUR-{incident.id}.",
        )
    )
    db.session.commit()
    return jsonify(
        incident=serialize_incident(
            incident,
            include_contact=True,
            include_reporter=True,
        )
    ), 200
