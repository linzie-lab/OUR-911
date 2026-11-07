from app.extensions import db
from app.models.base import TimestampMixin


class CampusZone(TimestampMixin, db.Model):
    __tablename__ = "campus_zones"
    __table_args__ = (
        db.CheckConstraint(
            "latitude BETWEEN -90 AND 90",
            name="check_campus_zones_latitude",
        ),
        db.CheckConstraint(
            "longitude BETWEEN -180 AND 180",
            name="check_campus_zones_longitude",
        ),
        db.CheckConstraint(
            "radius_meters > 0",
            name="check_campus_zones_radius",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    description = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    radius_meters = db.Column(db.Float, nullable=False, default=100)

    incidents = db.relationship("Incident", back_populates="zone")
