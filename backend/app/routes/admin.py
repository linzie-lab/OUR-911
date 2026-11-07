import re

from flask import Blueprint, g, jsonify
from sqlalchemy import func, select

from app.auth.decorators import role_required
from app.extensions import db
from app.models import (
    BloodRequest,
    EmergencyContact,
    Facility,
    Incident,
    User,
)
from app.routes.common import error_response, json_object, required_text

admin_bp = Blueprint("admin", __name__)
contact_bp = Blueprint("emergency_contacts", __name__)
notification_bp = Blueprint("notifications", __name__)
CONTACT_CATEGORIES = {"police", "general", "ambulance", "fire", "facility"}
PHONE_PATTERN = re.compile(r"^[0-9+()\-\s]{3,32}$")


def serialize_contact(contact):
    return {
        "id": contact.id,
        "name": contact.name,
        "category": contact.category,
        "phone": contact.phone,
        "location": contact.location,
        "is_verified": contact.is_verified,
        "is_active": contact.is_active,
    }


def serialize_user(user):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "responder_approved": user.responder_approved,
        "created_at": user.created_at.isoformat(),
    }


def apply_contact_fields(contact, data, partial=False):
    for field, label, maximum in (
        ("name", "Contact name", 160),
        ("phone", "Phone number", 32),
    ):
        if partial and field not in data:
            continue
        value, error = required_text(data, field, label, maximum)
        if error:
            return error
        if field == "phone" and not PHONE_PATTERN.fullmatch(value):
            return "Enter a valid telephone number."
        setattr(contact, field, value)

    if "category" in data or not partial:
        category = data.get("category")
        if not isinstance(category, str) or category not in CONTACT_CATEGORIES:
            return "Select a valid emergency contact category."
        contact.category = category
    if "location" in data:
        location = data["location"]
        if location is not None and (
            not isinstance(location, str) or len(location.strip()) > 255
        ):
            return "Location must be 255 characters or fewer."
        contact.location = location.strip() if location else None
    if "is_verified" in data:
        if not isinstance(data["is_verified"], bool):
            return "is_verified must be true or false."
        contact.is_verified = data["is_verified"]
    if "is_active" in data:
        if not isinstance(data["is_active"], bool):
            return "is_active must be true or false."
        contact.is_active = data["is_active"]
    return None


@contact_bp.get("")
def list_public_contacts():
    contacts = db.session.scalars(
        select(EmergencyContact)
        .where(
            EmergencyContact.is_active.is_(True),
            EmergencyContact.is_verified.is_(True),
        )
        .order_by(EmergencyContact.category, EmergencyContact.name)
    ).all()
    return jsonify(contacts=[serialize_contact(contact) for contact in contacts]), 200


@admin_bp.get("/contacts")
@role_required("admin")
def list_all_contacts():
    contacts = db.session.scalars(
        select(EmergencyContact).order_by(EmergencyContact.category, EmergencyContact.name)
    ).all()
    return jsonify(contacts=[serialize_contact(contact) for contact in contacts]), 200


@admin_bp.post("/contacts")
@role_required("admin")
def create_contact():
    data, error = json_object()
    if error:
        return error
    contact = EmergencyContact()
    error = apply_contact_fields(contact, data)
    if error:
        return error_response(error, 400)
    db.session.add(contact)
    db.session.commit()
    return jsonify(contact=serialize_contact(contact)), 201


@admin_bp.patch("/contacts/<int:contact_id>")
@role_required("admin")
def update_contact(contact_id):
    contact = db.session.get(EmergencyContact, contact_id)
    if contact is None:
        return error_response("Emergency contact was not found.", 404)
    data, error = json_object()
    if error:
        return error
    error = apply_contact_fields(contact, data, partial=True)
    if error:
        return error_response(error, 400)
    db.session.commit()
    return jsonify(contact=serialize_contact(contact)), 200


@admin_bp.delete("/contacts/<int:contact_id>")
@role_required("admin")
def deactivate_contact(contact_id):
    contact = db.session.get(EmergencyContact, contact_id)
    if contact is None:
        return error_response("Emergency contact was not found.", 404)
    contact.is_active = False
    db.session.commit()
    return jsonify(message="Emergency contact removed."), 200


@admin_bp.get("/users")
@role_required("admin")
def list_users():
    users = db.session.scalars(
        select(User).order_by(User.created_at.desc()).limit(500)
    ).all()
    return jsonify(users=[serialize_user(user) for user in users]), 200


@admin_bp.patch("/users/<int:user_id>")
@role_required("admin")
def update_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return error_response("User was not found.", 404)
    data, error = json_object()
    if error:
        return error

    if "role" in data:
        role = data["role"]
        if role == "emergency_responder":
            role = "health_personnel"
        if role not in {"student", "health_personnel", "admin"}:
            return error_response(
                "Role must be student, emergency_responder, or admin.",
                400,
            )
        if user.id == g.current_user.id and role != "admin":
            return error_response("You cannot remove your own administrator role.", 400)
        user.role = role
        if role != "health_personnel":
            user.responder_approved = False
        elif role == "health_personnel":
            user.responder_approved = False

    if "responder_approved" in data:
        if not isinstance(data["responder_approved"], bool):
            return error_response("responder_approved must be true or false.", 400)
        if user.role != "health_personnel":
            return error_response(
                "Only emergency responder accounts can be approved.",
                400,
            )
        user.responder_approved = data["responder_approved"]

    db.session.commit()
    return jsonify(user=serialize_user(user)), 200


@admin_bp.get("/summary")
@role_required("admin")
def system_summary():
    return jsonify(
        summary={
            "users": db.session.scalar(select(func.count(User.id))) or 0,
            "responders_pending_approval": (
                db.session.scalar(
                    select(func.count(User.id)).where(
                        User.role == "health_personnel",
                        User.responder_approved.is_(False),
                    )
                )
                or 0
            ),
            "incidents": db.session.scalar(select(func.count(Incident.id))) or 0,
            "open_incidents": db.session.scalar(
                select(func.count(Incident.id)).where(
                    Incident.status.in_(("reported", "acknowledged", "in_progress"))
                )
            ) or 0,
            "facilities": db.session.scalar(
                select(func.count(Facility.id)).where(Facility.is_active.is_(True))
            ) or 0,
            "blood_requests": db.session.scalar(
                select(func.count(BloodRequest.id))
            ) or 0,
        }
    ), 200


@notification_bp.get("")
@role_required("student", "admin", "health_personnel")
def list_notifications():
    from app.models import Notification

    items = db.session.scalars(
        select(Notification)
        .where(Notification.user_id == g.current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()
    return jsonify(
        notifications=[
            {
                "id": item.id,
                "incident_id": item.incident_id,
                "title": item.title,
                "message": item.message,
                "is_read": item.is_read,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ]
    ), 200


@notification_bp.patch("/<int:notification_id>/read")
@role_required("student", "admin", "health_personnel")
def mark_notification_read(notification_id):
    from app.models import Notification

    item = db.session.get(Notification, notification_id)
    if item is None or item.user_id != g.current_user.id:
        return error_response("Notification was not found.", 404)
    item.is_read = True
    db.session.commit()
    return jsonify(message="Notification marked as read."), 200
