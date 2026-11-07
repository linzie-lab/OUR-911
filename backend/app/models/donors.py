from app.extensions import db
from app.models.base import TimestampMixin


class Donor(TimestampMixin, db.Model):
    __tablename__ = "donors"
    __table_args__ = (
        db.CheckConstraint(
            "blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')",
            name="check_donors_blood_type",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    blood_type = db.Column(db.String(3), nullable=False)
    phone = db.Column(db.String(32), nullable=False)
    location = db.Column(db.String(160))
    is_available = db.Column(db.Boolean, nullable=False, default=True)
    last_donation_at = db.Column(db.DateTime(timezone=True))

    user = db.relationship("User", back_populates="donor_profile")
    matches = db.relationship("DonorMatch", back_populates="donor")
