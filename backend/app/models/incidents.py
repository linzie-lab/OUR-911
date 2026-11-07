from app.extensions import db
from app.models.base import TimestampMixin


class Incident(TimestampMixin, db.Model):
    __tablename__ = "incidents"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('reported', 'acknowledged', 'in_progress', 'resolved', 'cancelled')",
            name="check_incidents_status",
        ),
        db.CheckConstraint(
            "priority IN ('low', 'medium', 'high', 'critical')",
            name="check_incidents_priority",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    facility_id = db.Column(
        db.Integer,
        db.ForeignKey("facilities.id", ondelete="SET NULL"),
        nullable=True,
    )
    zone_id = db.Column(
        db.Integer,
        db.ForeignKey("campus_zones.id", ondelete="SET NULL"),
        nullable=True,
    )
    incident_type = db.Column(db.String(80), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location_description = db.Column(db.String(255))
    status = db.Column(db.String(32), nullable=False, default="reported")
    priority = db.Column(db.String(16), nullable=False, default="medium")

    reporter = db.relationship(
        "User",
        back_populates="reported_incidents",
        foreign_keys=[reporter_id],
    )
    facility = db.relationship("Facility", back_populates="incidents")
    zone = db.relationship("CampusZone", back_populates="incidents")
    updates = db.relationship(
        "IncidentUpdate",
        back_populates="incident",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="IncidentUpdate.created_at",
    )


class IncidentUpdate(TimestampMixin, db.Model):
    __tablename__ = "incident_updates"

    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(
        db.Integer,
        db.ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    updated_by_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status = db.Column(db.String(32), nullable=False)
    message = db.Column(db.Text, nullable=False)

    incident = db.relationship("Incident", back_populates="updates")
    updated_by = db.relationship("User", back_populates="incident_updates")
