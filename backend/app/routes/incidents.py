from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from app.auth.decorators import role_required
from app.extensions import db
from app.models import CampusZone, Incident, IncidentUpdate
from app.routes.common import error_response, json_object, required_text

incidents_bp = Blueprint("incidents", __name__)
INCIDENT_CATEGORIES = {
    "medical_emergency",
    "injury",
    "sudden_illness",
    "mental_health_concern",
    "accident",
    "other",
}
SEVERITIES = {"low", "medium", "high", "critical"}
API_STATUSES = {"submitted", "under_review", "resolved"}
DB_STATUSES = {
    "submitted": "reported",
    "under_review": "in_progress",
    "resolved": "resolved",
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
        "status": {
            "reported": "submitted",
            "acknowledged": "under_review",
            "in_progress": "under_review",
            "resolved": "resolved",
            "cancelled": "resolved",
        }.get(incident.status, "submitted"),
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "history": updates,
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
    is_staff = g.current_user.role in {"admin", "health_personnel"}
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
            include_contact=True,
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

    category, error = required_text(data, "category", "Category", 80)
    if error:
        return error_response(error, 400)
    if category not in INCIDENT_CATEGORIES:
        return error_response("Select a valid incident category.", 400)
    description, error = required_text(data, "description", "Description", 5000)
    if error:
        return error_response(error, 400)
    location, error = required_text(data, "location", "Campus location", 255)
    if error:
        return error_response(error, 400)
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
    )
    incident.updates.append(
        IncidentUpdate(status="submitted", message="Incident report submitted.")
    )
    db.session.add(incident)
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
    is_staff = g.current_user.role in {"admin", "health_personnel"}
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
@role_required("admin", "health_personnel")
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
            "Status must be submitted, under_review, or resolved.",
            400,
        )
    message = data.get("message", f"Status changed to {status.replace('_', ' ')}.")
    if not isinstance(message, str) or not message.strip() or len(message) > 1000:
        return error_response("Update message must be 1–1000 characters.", 400)

    incident.status = DB_STATUSES[status]
    incident.updates.append(
        IncidentUpdate(
            updated_by_id=g.current_user.id,
            status=status,
            message=message.strip(),
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
