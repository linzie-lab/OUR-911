from app.extensions import db
from app.models.base import TimestampMixin


class Facility(TimestampMixin, db.Model):
    __tablename__ = "facilities"
    __table_args__ = (
        db.CheckConstraint(
            "latitude IS NULL OR latitude BETWEEN -90 AND 90",
            name="check_facilities_latitude",
        ),
        db.CheckConstraint(
            "longitude IS NULL OR longitude BETWEEN -180 AND 180",
            name="check_facilities_longitude",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False, unique=True)
    facility_type = db.Column(db.String(64), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(32))
    services = db.Column(db.Text, nullable=False, default="[]")
    operating_hours = db.Column(db.String(255))
    description = db.Column(db.Text)
    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    incidents = db.relationship("Incident", back_populates="facility")
    blood_requests = db.relationship("BloodRequest", back_populates="facility")
