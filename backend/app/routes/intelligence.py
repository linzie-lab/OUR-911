from collections import Counter
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify
from sqlalchemy import select

from app.auth.decorators import responder_required
from app.extensions import db
from app.models import Incident

intelligence_bp = Blueprint("intelligence", __name__)


@intelligence_bp.get("/summary")
@responder_required
def summary():
    incidents = db.session.scalars(
        select(Incident).order_by(Incident.created_at.desc())
    ).all()
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    def as_utc(value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

    categories = Counter(incident.incident_type for incident in incidents)
    locations = Counter(
        incident.location_description.strip()
        for incident in incidents
        if incident.location_description and incident.location_description.strip()
    )
    daily = Counter()
    current_week = 0
    previous_week = 0
    for incident in incidents:
        created_at = as_utc(incident.created_at)
        if created_at >= week_ago:
            current_week += 1
        elif created_at >= two_weeks_ago:
            previous_week += 1
        if created_at >= now - timedelta(days=13):
            daily[created_at.date().isoformat()] += 1

    trend = [
        {
            "date": (now.date() - timedelta(days=offset)).isoformat(),
            "count": daily.get(
                (now.date() - timedelta(days=offset)).isoformat(),
                0,
            ),
        }
        for offset in range(13, -1, -1)
    ]
    unresolved_statuses = {"reported", "acknowledged", "in_progress"}
    recent = [
        {
            "id": incident.id,
            "category": incident.incident_type,
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
        }
        for incident in incidents[:8]
    ]

    return jsonify(
        summary={
            "total_incidents": len(incidents),
            "open_incidents": sum(
                incident.status in unresolved_statuses for incident in incidents
            ),
            "resolved_incidents": sum(
                incident.status == "resolved" for incident in incidents
            ),
            "critical_incidents": sum(
                incident.priority == "critical"
                and incident.status in unresolved_statuses
                for incident in incidents
            ),
            "categories": [
                {"category": category, "count": count}
                for category, count in sorted(
                    categories.items(), key=lambda item: (-item[1], item[0])
                )
            ],
            "trend": trend,
            "frequent_locations": [
                {"location": location, "count": count}
                for location, count in locations.most_common(8)
            ],
            "recent_incidents": recent,
            "risk_indicator": {
                "label": (
                    "Elevated activity"
                    if current_week > previous_week
                    else "Typical activity"
                    if current_week == previous_week
                    else "Lower activity"
                ),
                "current_7_days": current_week,
                "previous_7_days": previous_week,
                "basis": "Reported incident counts; not a clinical risk assessment.",
            },
        }
    ), 200
