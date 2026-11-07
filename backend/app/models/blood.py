from app.extensions import db
from app.models.base import TimestampMixin


class BloodRequest(TimestampMixin, db.Model):
    __tablename__ = "blood_requests"
    __table_args__ = (
        db.CheckConstraint(
            "blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')",
            name="check_blood_requests_blood_type",
        ),
        db.CheckConstraint(
            "units_requested > 0",
            name="check_blood_requests_units",
        ),
        db.CheckConstraint(
            "status IN ('open', 'partially_fulfilled', 'fulfilled', 'cancelled')",
            name="check_blood_requests_status",
        ),
        db.CheckConstraint(
            "priority IN ('low', 'medium', 'high', 'critical')",
            name="check_blood_requests_priority",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    requested_by_id = db.Column(
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
    facility_name = db.Column(db.String(160))
    blood_type = db.Column(db.String(3), nullable=False)
    units_requested = db.Column(db.Integer, nullable=False)
    priority = db.Column(db.String(16), nullable=False, default="medium")
    status = db.Column(db.String(32), nullable=False, default="open")
    needed_by = db.Column(db.DateTime(timezone=True))
    contact_name = db.Column(db.String(120))
    contact_phone = db.Column(db.String(32))
    notes = db.Column(db.Text)

    requested_by = db.relationship("User", back_populates="blood_requests")
    facility = db.relationship("Facility", back_populates="blood_requests")
    donor_matches = db.relationship(
        "DonorMatch",
        back_populates="blood_request",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class DonorMatch(TimestampMixin, db.Model):
    __tablename__ = "donor_matches"
    __table_args__ = (
        db.UniqueConstraint(
            "donor_id",
            "blood_request_id",
            name="uq_donor_matches_donor_request",
        ),
        db.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')",
            name="check_donor_matches_status",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    donor_id = db.Column(
        db.Integer,
        db.ForeignKey("donors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blood_request_id = db.Column(
        db.Integer,
        db.ForeignKey("blood_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = db.Column(db.String(16), nullable=False, default="pending")
    matched_at = db.Column(db.DateTime(timezone=True))

    donor = db.relationship("Donor", back_populates="matches")
    blood_request = db.relationship(
        "BloodRequest",
        back_populates="donor_matches",
    )
