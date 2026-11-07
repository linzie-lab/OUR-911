from app.extensions import db
from app.models.base import TimestampMixin


class FirstAidGuide(TimestampMixin, db.Model):
    __tablename__ = "first_aid_guides"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    category = db.Column(db.String(80), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    author_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    author = db.relationship("User", back_populates="authored_guides")
