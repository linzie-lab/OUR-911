from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models.base import TimestampMixin


class User(TimestampMixin, db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.CheckConstraint(
            "role IN ('student', 'admin', 'health_personnel')",
            name="check_users_role",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(32), nullable=False, default="student")

    authored_guides = db.relationship(
        "FirstAidGuide",
        back_populates="author",
    )
    reported_incidents = db.relationship(
        "Incident",
        back_populates="reporter",
        foreign_keys="Incident.reporter_id",
    )
    incident_updates = db.relationship(
        "IncidentUpdate",
        back_populates="updated_by",
    )
    donor_profile = db.relationship(
        "Donor",
        back_populates="user",
        uselist=False,
    )
    blood_requests = db.relationship(
        "BloodRequest",
        back_populates="requested_by",
    )

    def set_password(self, password):
        if not password:
            raise ValueError("Password must not be empty.")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
