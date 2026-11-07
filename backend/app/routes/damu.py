from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.auth.decorators import role_required
from app.extensions import db
from app.models import BloodRequest, Donor, DonorMatch
from app.routes.common import error_response, json_object, required_text

damu_bp = Blueprint("damu", __name__)
BLOOD_TYPES = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}
REQUEST_STATUSES = {"open", "partially_fulfilled", "fulfilled", "cancelled"}
MATCH_STATUSES = {"pending", "accepted", "declined", "completed", "cancelled"}
PRIORITIES = {"low", "medium", "high", "critical"}


@damu_bp.get("/summary")
def public_summary():
    available_donors = db.session.scalar(
        select(func.count(Donor.id)).where(Donor.is_available.is_(True))
    )
    return jsonify(available_donors=available_donors or 0), 200


def serialize_donor(donor, include_contact=False):
    result = {
        "id": donor.id,
        "name": donor.user.full_name,
        "blood_type": donor.blood_type,
        "location": donor.location,
        "is_available": donor.is_available,
    }
    if include_contact:
        result["phone"] = donor.phone
    return result


def serialize_request(blood_request, include_private=False, include_staff=False):
    result = {
        "id": blood_request.id,
        "blood_type": blood_request.blood_type,
        "units_requested": blood_request.units_requested,
        "priority": blood_request.priority,
        "status": blood_request.status,
        "facility": blood_request.facility.name
        if blood_request.facility
        else blood_request.facility_name,
        "needed_by": (
            blood_request.needed_by.isoformat()
            if blood_request.needed_by
            else None
        ),
        "created_at": blood_request.created_at.isoformat(),
    }
    if include_private:
        result.update(
            contact_name=blood_request.contact_name,
            contact_phone=blood_request.contact_phone,
            notes=blood_request.notes,
            requested_by=blood_request.requested_by.full_name,
        )
    if include_staff:
        result["donor_matches"] = [
            {
                "id": match.id,
                "donor_id": match.donor_id,
                "donor_name": match.donor.user.full_name,
                "donor_phone": match.donor.phone,
                "status": match.status,
            }
            for match in blood_request.donor_matches
        ]
    return result


@damu_bp.get("/donors/me")
@role_required("student", "admin", "health_personnel")
def get_my_donor_profile():
    donor = db.session.scalar(
        select(Donor).where(Donor.user_id == g.current_user.id)
    )
    if donor is None:
        return jsonify(donor=None), 200
    return jsonify(donor=serialize_donor(donor, include_contact=True)), 200


@damu_bp.post("/donors")
@role_required("student", "admin", "health_personnel")
def register_donor():
    data, error = json_object()
    if error:
        return error
    blood_type = data.get("blood_type")
    if not isinstance(blood_type, str) or blood_type not in BLOOD_TYPES:
        return error_response("Select a valid blood group.", 400)
    phone, error = required_text(data, "phone", "Contact phone", 32)
    if error:
        return error_response(error, 400)
    location = data.get("location")
    if location is not None and (
        not isinstance(location, str) or len(location.strip()) > 160
    ):
        return error_response("Location must be 160 characters or fewer.", 400)
    available = data.get("is_available", True)
    if not isinstance(available, bool):
        return error_response("is_available must be true or false.", 400)

    donor = db.session.scalar(
        select(Donor).where(Donor.user_id == g.current_user.id)
    )
    if donor is None:
        donor = Donor(user_id=g.current_user.id)
        db.session.add(donor)
    donor.blood_type = blood_type
    donor.phone = phone
    donor.location = location.strip() if location else None
    donor.is_available = available
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("Could not save donor profile.", 409)
    return jsonify(donor=serialize_donor(donor, include_contact=True)), 200


@damu_bp.patch("/donors/me")
@role_required("student", "admin", "health_personnel")
def update_my_donor_profile():
    donor = db.session.scalar(
        select(Donor).where(Donor.user_id == g.current_user.id)
    )
    if donor is None:
        return error_response("Register a donor profile first.", 404)
    data, error = json_object()
    if error:
        return error
    if "is_available" in data:
        if not isinstance(data["is_available"], bool):
            return error_response("is_available must be true or false.", 400)
        donor.is_available = data["is_available"]
    if "phone" in data:
        phone, error = required_text(data, "phone", "Contact phone", 32)
        if error:
            return error_response(error, 400)
        donor.phone = phone
    if "location" in data:
        location = data["location"]
        if location is not None and (
            not isinstance(location, str) or len(location.strip()) > 160
        ):
            return error_response("Location must be 160 characters or fewer.", 400)
        donor.location = location.strip() if location else None
    if "blood_type" in data:
        if not isinstance(data["blood_type"], str) or data["blood_type"] not in BLOOD_TYPES:
            return error_response("Select a valid blood group.", 400)
        donor.blood_type = data["blood_type"]
    db.session.commit()
    return jsonify(donor=serialize_donor(donor, include_contact=True)), 200


@damu_bp.get("/admin/donors")
@role_required("admin", "health_personnel")
def list_donors():
    statement = select(Donor).join(Donor.user)
    blood_type = request.args.get("blood_type")
    location = request.args.get("location", "").strip()
    if blood_type:
        if blood_type not in BLOOD_TYPES:
            return error_response("Select a valid blood group.", 400)
        statement = statement.where(Donor.blood_type == blood_type)
    if location:
        statement = statement.where(Donor.location.ilike(f"%{location[:160]}%"))
    donors = db.session.scalars(
        statement.order_by(Donor.is_available.desc(), Donor.created_at.desc())
    ).all()
    return jsonify(donors=[
        serialize_donor(donor, include_contact=True)
        for donor in donors
    ]), 200


@damu_bp.post("/requests")
@role_required("student", "admin", "health_personnel")
def create_blood_request():
    data, error = json_object()
    if error:
        return error
    blood_type = data.get("blood_type")
    if not isinstance(blood_type, str) or blood_type not in BLOOD_TYPES:
        return error_response("Select a valid blood group.", 400)
    units = data.get("units_requested")
    if isinstance(units, bool) or not isinstance(units, int) or not 1 <= units <= 100:
        return error_response("Units requested must be an integer from 1 to 100.", 400)
    priority = data.get("priority", "medium")
    if not isinstance(priority, str) or priority not in PRIORITIES:
        return error_response("Select a valid urgency level.", 400)
    contact_name, error = required_text(data, "contact_name", "Contact name", 120)
    if error:
        return error_response(error, 400)
    contact_phone, error = required_text(data, "contact_phone", "Contact phone", 32)
    if error:
        return error_response(error, 400)
    facility_id = data.get("facility_id")
    facility_name = data.get("facility_name")
    if facility_id is not None:
        try:
            facility_id = int(facility_id)
        except (TypeError, ValueError):
            return error_response("Facility is invalid.", 400)
        from app.models import Facility

        facility = db.session.get(Facility, facility_id)
        if facility is None or not facility.is_active:
            return error_response("Facility was not found.", 404)
        facility_name = facility.name
    elif not isinstance(facility_name, str) or not facility_name.strip():
        return error_response("Hospital or collection facility is required.", 400)
    if facility_name and len(facility_name.strip()) > 160:
        return error_response("Facility name must be 160 characters or fewer.", 400)
    notes = data.get("notes")
    if notes is not None and (
        not isinstance(notes, str) or len(notes.strip()) > 2000
    ):
        return error_response("Notes must be 2000 characters or fewer.", 400)

    blood_request = BloodRequest(
        requested_by_id=g.current_user.id,
        facility_id=facility_id,
        facility_name=facility_name.strip() if facility_name else None,
        blood_type=blood_type,
        units_requested=units,
        priority=priority,
        contact_name=contact_name,
        contact_phone=contact_phone,
        notes=notes.strip() if notes else None,
        status="open",
    )
    db.session.add(blood_request)
    db.session.commit()
    return jsonify(request=serialize_request(blood_request, include_private=True)), 201


@damu_bp.get("/requests")
@role_required("student", "admin", "health_personnel")
def list_blood_requests():
    statement = select(BloodRequest).order_by(BloodRequest.created_at.desc())
    is_staff = g.current_user.role in {"admin", "health_personnel"}
    if not is_staff:
        statement = statement.where(
            BloodRequest.requested_by_id == g.current_user.id
        )
    requests = db.session.scalars(statement.limit(100)).all()
    return jsonify(requests=[
        serialize_request(
            item,
            include_private=is_staff or item.requested_by_id == g.current_user.id,
            include_staff=is_staff,
        )
        for item in requests
    ]), 200


@damu_bp.patch("/requests/<int:request_id>/status")
@role_required("admin", "health_personnel")
def update_request_status(request_id):
    blood_request = db.session.get(BloodRequest, request_id)
    if blood_request is None:
        return error_response("Blood request was not found.", 404)
    data, error = json_object()
    if error:
        return error
    status = data.get("status")
    if not isinstance(status, str) or status not in REQUEST_STATUSES:
        return error_response("Select a valid blood request status.", 400)
    blood_request.status = status
    db.session.commit()
    return jsonify(request=serialize_request(blood_request, include_private=True)), 200


@damu_bp.get("/requests/<int:request_id>/matches")
@role_required("admin", "health_personnel")
def find_donor_matches(request_id):
    blood_request = db.session.get(BloodRequest, request_id)
    if blood_request is None:
        return error_response("Blood request was not found.", 404)
    if blood_request.status not in {"open", "partially_fulfilled"}:
        return error_response("This request is no longer accepting coordination.", 409)
    statement = select(Donor).where(
        Donor.is_available.is_(True),
        Donor.blood_type == blood_request.blood_type,
    )
    location = request.args.get("location", "").strip()
    if location:
        statement = statement.where(Donor.location.ilike(f"%{location[:160]}%"))
    donors = db.session.scalars(
        statement.order_by(Donor.created_at.desc())
    ).all()
    return jsonify(
        request_id=blood_request.id,
        notice=(
            "Preliminary same-blood-group and location discovery only. "
            "This is not a compatibility assessment; qualified clinicians "
            "must make all transfusion decisions."
        ),
        donors=[serialize_donor(donor, include_contact=True) for donor in donors],
    ), 200


@damu_bp.post("/requests/<int:request_id>/matches")
@role_required("admin", "health_personnel")
def record_donor_match(request_id):
    blood_request = db.session.get(BloodRequest, request_id)
    if blood_request is None:
        return error_response("Blood request was not found.", 404)
    if blood_request.status not in {"open", "partially_fulfilled"}:
        return error_response("This request is no longer accepting coordination.", 409)
    data, error = json_object()
    if error:
        return error
    try:
        donor_id = int(data.get("donor_id"))
    except (TypeError, ValueError):
        return error_response("A valid donor_id is required.", 400)
    donor = db.session.get(Donor, donor_id)
    if donor is None or not donor.is_available:
        return error_response("Available donor was not found.", 404)
    if donor.blood_type != blood_request.blood_type:
        return error_response(
            "Donor and request blood groups must match for preliminary discovery.",
            400,
        )
    match = DonorMatch(
        donor_id=donor.id,
        blood_request_id=blood_request.id,
        status="pending",
        matched_at=datetime.now(timezone.utc),
    )
    db.session.add(match)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("This donor has already been matched to the request.", 409)
    return jsonify(match={
        "id": match.id,
        "donor_id": match.donor_id,
        "request_id": match.blood_request_id,
        "status": match.status,
    }), 201


@damu_bp.patch("/matches/<int:match_id>")
@role_required("admin", "health_personnel")
def update_match_outcome(match_id):
    match = db.session.get(DonorMatch, match_id)
    if match is None:
        return error_response("Donor match was not found.", 404)
    data, error = json_object()
    if error:
        return error
    status = data.get("status")
    if not isinstance(status, str) or status not in MATCH_STATUSES:
        return error_response("Select a valid match outcome.", 400)
    match.status = status
    if status in {"completed", "declined", "cancelled"}:
        match.donor.is_available = status != "completed"
    db.session.commit()
    return jsonify(match={
        "id": match.id,
        "donor_id": match.donor_id,
        "request_id": match.blood_request_id,
        "status": match.status,
    }), 200
