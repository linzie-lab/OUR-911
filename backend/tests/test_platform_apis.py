import unittest

from flask_jwt_extended import create_access_token
from sqlalchemy import inspect

from app import create_app
from app.database import migrate_incident_reporters_nullable, migrate_sqlite_schema
from app.extensions import db
from app.models import User


class PlatformApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "JWT_SECRET_KEY": "test-key-with-more-than-thirty-two-bytes",
            }
        )
        self.client = self.app.test_client()
        with self.app.app_context():
            self.student = self._add_user(
                "student@example.test",
                "student",
                "Test Student",
            )
            self.other_student = self._add_user(
                "other@example.test",
                "student",
                "Other Student",
            )
            self.admin = self._add_user(
                "admin@example.test",
                "admin",
                "Test Admin",
            )
            self.health_worker = self._add_user(
                "health@example.test",
                "health_personnel",
                "Health Worker",
            )
            self.student_token = self._token(self.student.id)
            self.other_token = self._token(self.other_student.id)
            self.admin_token = self._token(self.admin.id)
            self.health_token = self._token(self.health_worker.id)

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

    @staticmethod
    def _add_user(email, role, name):
        user = User(
            email=email,
            role=role,
            full_name=name,
            responder_approved=role == "health_personnel",
        )
        user.set_password("test-password-123")
        db.session.add(user)
        db.session.commit()
        return user

    @staticmethod
    def _token(user_id):
        return create_access_token(identity=str(user_id))

    @staticmethod
    def _auth(token):
        return {"Authorization": f"Bearer {token}"}

    def _report_incident(self, token=None, **values):
        payload = {
            "category": "injury",
            "description": "A student has a minor injury.",
            "location": "Library",
            "severity": "medium",
        }
        payload.update(values)
        return self.client.post(
            "/api/incidents",
            json=payload,
            headers=self._auth(token) if token else {},
        )

    def test_incident_submission_is_private_and_admin_can_update_history(self):
        created = self._report_incident(
            self.student_token,
            severity="critical",
            contact_info="student contact",
        )
        self.assertEqual(created.status_code, 201)
        incident = created.get_json()["incident"]
        self.assertEqual(incident["status"], "submitted")
        self.assertNotIn("reporter", incident)

        own_list = self.client.get(
            "/api/incidents",
            headers=self._auth(self.student_token),
        )
        self.assertEqual(len(own_list.get_json()["incidents"]), 1)
        own_dashboard_reports = self.client.get(
            "/api/incidents/mine",
            headers=self._auth(self.student_token),
        )
        self.assertEqual(len(own_dashboard_reports.get_json()["incidents"]), 1)
        own_detail = self.client.get(
            f"/api/incidents/{incident['id']}",
            headers=self._auth(self.student_token),
        )
        self.assertEqual(own_detail.status_code, 200)
        self.assertEqual(
            own_detail.get_json()["incident"]["contact_info"],
            "student contact",
        )
        invalid_filter = self.client.get(
            "/api/incidents?severity=urgent",
            headers=self._auth(self.student_token),
        )
        self.assertEqual(invalid_filter.status_code, 400)
        self.assertEqual(
            self.client.get(
                "/api/incidents",
                headers=self._auth(self.other_token),
            ).get_json()["incidents"],
            [],
        )
        self.assertEqual(
            self.client.get(
                f"/api/incidents/{incident['id']}",
                headers=self._auth(self.other_token),
            ).status_code,
            403,
        )

        accepted = self.client.post(
            f"/api/incidents/{incident['id']}/accept",
            headers=self._auth(self.health_token),
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.get_json()["incident"]["response_status"], "accepted")

        updated = self.client.patch(
            f"/api/incidents/{incident['id']}/status",
            json={"status": "responding", "message": "Responder is on the way."},
            headers=self._auth(self.health_token),
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["incident"]["status"], "under_review")
        self.assertEqual(updated.get_json()["incident"]["response_status"], "responding")
        self.assertEqual(len(updated.get_json()["incident"]["history"]), 3)

        resolved = self.client.patch(
            f"/api/incidents/{incident['id']}/status",
            json={"status": "resolved"},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(resolved.get_json()["incident"]["status"], "resolved")
        staff_list = self.client.get(
            "/api/incidents?severity=critical",
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(staff_list.get_json()["incidents"][0]["reporter"]["email"],
                         "student@example.test")

    def test_incident_validation_and_authentication(self):
        self.assertEqual(self._report_incident().status_code, 401)
        invalid = self._report_incident(self.student_token, category="not-a-category")
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("error", invalid.get_json())

    def test_guest_incidents_are_persisted_but_not_publicly_retrievable(self):
        created = self.client.post(
            "/api/incidents/guest",
            json={
                "category": "sudden_illness",
                "description": "A guest report for staff review.",
                "location": "Student Center",
                "severity": "high",
                "contact_info": "555-0123",
            },
        )
        self.assertEqual(created.status_code, 201)
        report_id = created.get_json()["report_id"]
        self.assertNotIn("incident", created.get_json())
        self.assertEqual(self.client.get("/api/incidents").status_code, 401)
        self.assertEqual(
            self.client.get(
                "/api/incidents/mine",
                headers=self._auth(self.student_token),
            ).get_json()["incidents"],
            [],
        )
        self.assertEqual(
            self.client.get(
                f"/api/incidents/{report_id}",
                headers=self._auth(self.student_token),
            ).status_code,
            403,
        )
        staff_reports = self.client.get(
            "/api/incidents",
            headers=self._auth(self.health_token),
        ).get_json()["incidents"]
        self.assertEqual(len(staff_reports), 1)
        self.assertNotIn("reporter", staff_reports[0])
        self.assertEqual(staff_reports[0]["contact_info"], "555-0123")

    def test_sos_coordinates_responder_approval_and_private_notifications(self):
        created = self._report_incident(
            self.student_token,
            category="fire",
            description="Smoke reported in the science building.",
            location="Science building, north entrance",
            latitude=-1.2864,
            longitude=36.8172,
            severity="critical",
        )
        self.assertEqual(created.status_code, 201)
        incident_id = created.get_json()["incident"]["id"]
        self.assertEqual(created.get_json()["incident"]["response_status"], "pending")

        queue = self.client.get(
            "/api/incidents/queue",
            headers=self._auth(self.health_token),
        )
        queued_incident = queue.get_json()["incidents"][0]
        self.assertEqual(queued_incident["latitude"], -1.2864)
        self.assertEqual(queued_incident["longitude"], 36.8172)
        self.assertEqual(queued_incident["reporter"]["id"], self.student.id)

        accepted = self.client.post(
            f"/api/incidents/{incident_id}/accept",
            headers=self._auth(self.health_token),
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.get_json()["incident"]["response_status"], "accepted")
        notifications = self.client.get(
            "/api/notifications",
            headers=self._auth(self.student_token),
        ).get_json()["notifications"]
        self.assertTrue(any("accepted" in item["message"] for item in notifications))

    def test_unapproved_responder_is_blocked_and_admin_can_approve(self):
        with self.app.app_context():
            responder = User(
                full_name="Pending Responder",
                email="pending-responder@example.test",
                role="health_personnel",
                responder_approved=False,
            )
            responder.set_password("test-password-123")
            db.session.add(responder)
            db.session.commit()
            responder_token = self._token(responder.id)
            responder_id = responder.id

        self.assertEqual(
            self.client.get(
                "/api/incidents/queue",
                headers=self._auth(responder_token),
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                "/api/damu/admin/donors",
                headers=self._auth(responder_token),
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                "/api/intelligence/summary",
                headers=self._auth(responder_token),
            ).status_code,
            403,
        )
        approval = self.client.patch(
            f"/api/admin/users/{responder_id}",
            json={"responder_approved": True},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(approval.status_code, 200)
        self.assertTrue(approval.get_json()["user"]["responder_approved"])
        self.assertEqual(
            self.client.get(
                "/api/incidents/queue",
                headers=self._auth(responder_token),
            ).status_code,
            200,
        )

    def test_only_verified_emergency_contacts_are_public(self):
        default_contacts = self.client.get("/api/emergency-contacts")
        self.assertEqual(default_contacts.status_code, 200)
        self.assertEqual(
            {contact["phone"] for contact in default_contacts.get_json()["contacts"]},
            {"999", "112"},
        )
        created = self.client.post(
            "/api/admin/contacts",
            json={
                "name": "Campus ambulance",
                "category": "ambulance",
                "phone": "+254700000000",
            },
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(created.status_code, 201)
        contact_id = created.get_json()["contact"]["id"]
        self.assertEqual(
            len(self.client.get("/api/emergency-contacts").get_json()["contacts"]),
            2,
        )
        verified = self.client.patch(
            f"/api/admin/contacts/{contact_id}",
            json={"is_verified": True},
            headers=self._auth(self.admin_token),
        )
        self.assertTrue(verified.get_json()["contact"]["is_verified"])
        self.assertEqual(
            len(self.client.get("/api/emergency-contacts").get_json()["contacts"]),
            3,
        )
        self.assertEqual(
            self.client.get(
                "/api/admin/contacts",
                headers=self._auth(self.student_token),
            ).status_code,
            403,
        )

    def test_admin_assignment_and_responder_rejection_are_audited(self):
        created = self._report_incident(self.student_token)
        incident_id = created.get_json()["incident"]["id"]
        assigned = self.client.post(
            f"/api/incidents/{incident_id}/assign",
            json={"responder_id": self.health_worker.id},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(assigned.status_code, 200)
        self.assertEqual(
            assigned.get_json()["incident"]["assigned_responder"]["id"],
            self.health_worker.id,
        )

        rejected = self.client.post(
            f"/api/incidents/{incident_id}/reject",
            json={"reason": "Duplicate report; responder contacted the reporter."},
            headers=self._auth(self.health_token),
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.get_json()["incident"]["response_status"], "rejected")
        self.assertEqual(
            rejected.get_json()["incident"]["history"][-1]["message"],
            "Duplicate report; responder contacted the reporter.",
        )
        responder_notifications = self.client.get(
            "/api/notifications",
            headers=self._auth(self.health_token),
        ).get_json()["notifications"]
        self.assertTrue(
            any(item["title"] == "Incident assigned to you" for item in responder_notifications)
        )

    def test_public_summary_endpoints_return_live_database_counts(self):
        self.assertEqual(
            self.client.get("/api/facilities/summary").get_json(),
            {"registered_facilities": 0},
        )
        self.assertEqual(
            self.client.get("/api/damu/summary").get_json(),
            {"available_donors": 0},
        )
        self.client.post(
            "/api/damu/donors",
            json={"blood_type": "O+", "phone": "555-0101", "location": "West"},
            headers=self._auth(self.student_token),
        )
        self.assertEqual(
            self.client.get("/api/damu/summary").get_json()["available_donors"],
            1,
        )
        self.client.post(
            "/api/facilities",
            json={
                "name": "Counted Clinic",
                "facility_type": "clinic",
                "address": "Campus",
            },
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(
            self.client.get("/api/facilities/summary").get_json()["registered_facilities"],
            1,
        )

    def test_intelligence_requires_staff_and_uses_aggregate_data(self):
        self._report_incident(
            self.student_token,
            category="medical_emergency",
            description="Private incident text.",
            location="North Hall",
            severity="critical",
        )
        self.assertEqual(self.client.get("/api/intelligence/summary").status_code, 401)
        self.assertEqual(
            self.client.get(
                "/api/intelligence/summary",
                headers=self._auth(self.student_token),
            ).status_code,
            403,
        )

        response = self.client.get(
            "/api/intelligence/summary",
            headers=self._auth(self.admin_token),
        )
        summary = response.get_json()["summary"]
        self.assertEqual(summary["total_incidents"], 1)
        self.assertEqual(summary["critical_incidents"], 1)
        self.assertEqual(summary["categories"], [
            {"category": "medical_emergency", "count": 1}
        ])
        self.assertEqual(summary["frequent_locations"][0]["location"], "North Hall")
        self.assertNotIn("Private incident text.", response.get_data(as_text=True))
        self.assertNotIn("student@example.test", response.get_data(as_text=True))

    def test_facility_search_admin_crud_and_unverified_label(self):
        payload = {
            "name": "Campus Health Center",
            "facility_type": "clinic",
            "address": "Campus building A",
            "phone": "555-0100",
            "services": ["First aid", "Nurse consultation"],
            "operating_hours": "Weekdays, 9 AM to 5 PM",
            "description": "Demonstration facility record.",
        }
        self.assertEqual(
            self.client.post("/api/facilities", json=payload).status_code,
            401,
        )
        created = self.client.post(
            "/api/facilities",
            json=payload,
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(created.status_code, 201)
        facility = created.get_json()["facility"]
        self.assertFalse(facility["is_verified"])

        searched = self.client.get("/api/facilities?search=health&type=clinic")
        self.assertEqual(len(searched.get_json()["facilities"]), 1)
        self.assertEqual(
            self.client.get("/api/facilities?search=missing").get_json()["facilities"],
            [],
        )
        detail = self.client.get(f"/api/facilities/{facility['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertIsNone(detail.get_json()["facility"]["operating_hours"])
        updated = self.client.patch(
            f"/api/facilities/{facility['id']}",
            json={"is_verified": True},
            headers=self._auth(self.admin_token),
        )
        self.assertTrue(updated.get_json()["facility"]["is_verified"])
        self.assertEqual(
            updated.get_json()["facility"]["operating_hours"],
            "Weekdays, 9 AM to 5 PM",
        )
        deleted = self.client.delete(
            f"/api/facilities/{facility['id']}",
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get("/api/facilities").get_json()["facilities"], [])

    def test_damu_donor_privacy_request_and_match_workflow(self):
        donor_response = self.client.post(
            "/api/damu/donors",
            json={
                "blood_type": "O+",
                "phone": "555-0101",
                "location": "North Campus",
                "is_available": True,
            },
            headers=self._auth(self.student_token),
        )
        self.assertEqual(donor_response.status_code, 200)
        profile = self.client.get(
            "/api/damu/donors/me",
            headers=self._auth(self.student_token),
        )
        self.assertEqual(profile.get_json()["donor"]["phone"], "555-0101")
        unavailable = self.client.patch(
            "/api/damu/donors/me",
            json={"is_available": False},
            headers=self._auth(self.student_token),
        )
        self.assertFalse(unavailable.get_json()["donor"]["is_available"])
        available = self.client.patch(
            "/api/damu/donors/me",
            json={"is_available": True},
            headers=self._auth(self.student_token),
        )
        self.assertTrue(available.get_json()["donor"]["is_available"])
        self.assertEqual(
            self.client.get("/api/damu/admin/donors").status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                "/api/damu/admin/donors",
                headers=self._auth(self.other_token),
            ).status_code,
            403,
        )
        staff_donors = self.client.get(
            "/api/damu/admin/donors?blood_type=O%2B",
            headers=self._auth(self.health_token),
        )
        self.assertEqual(staff_donors.get_json()["donors"][0]["phone"], "555-0101")

        request_response = self.client.post(
            "/api/damu/requests",
            json={
                "blood_type": "O+",
                "units_requested": 2,
                "priority": "high",
                "facility_name": "Regional Hospital",
                "contact_name": "Authorized Contact",
                "contact_phone": "555-0199",
            },
            headers=self._auth(self.other_token),
        )
        self.assertEqual(request_response.status_code, 201)
        request_id = request_response.get_json()["request"]["id"]
        self.assertEqual(
            self.client.get(
                "/api/damu/requests",
                headers=self._auth(self.student_token),
            ).get_json()["requests"],
            [],
        )
        owner_requests = self.client.get(
            "/api/damu/requests",
            headers=self._auth(self.other_token),
        )
        self.assertEqual(
            owner_requests.get_json()["requests"][0]["contact_phone"],
            "555-0199",
        )

        matches = self.client.get(
            f"/api/damu/requests/{request_id}/matches?location=North",
            headers=self._auth(self.health_token),
        )
        self.assertEqual(len(matches.get_json()["donors"]), 1)
        self.assertEqual(matches.get_json()["donors"][0]["phone"], "555-0101")
        self.assertIn("not a compatibility", matches.get_json()["notice"])

        matched = self.client.post(
            f"/api/damu/requests/{request_id}/matches",
            json={"donor_id": donor_response.get_json()["donor"]["id"]},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(matched.status_code, 201)
        staff_requests = self.client.get(
            "/api/damu/requests",
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(
            staff_requests.get_json()["requests"][0]["donor_matches"][0]["status"],
            "pending",
        )
        outcome = self.client.patch(
            f"/api/damu/matches/{matched.get_json()['match']['id']}",
            json={"status": "completed"},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(outcome.get_json()["match"]["status"], "completed")

        status = self.client.patch(
            f"/api/damu/requests/{request_id}/status",
            json={"status": "fulfilled"},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(status.get_json()["request"]["status"], "fulfilled")

    def test_campus_zones_are_listed_and_admin_managed(self):
        self.assertEqual(self.client.get("/api/campus-zones").get_json()["zones"], [])
        denied = self.client.post(
            "/api/campus-zones",
            json={"name": "Library", "latitude": 1, "longitude": 2},
            headers=self._auth(self.student_token),
        )
        self.assertEqual(denied.status_code, 403)
        created = self.client.post(
            "/api/campus-zones",
            json={"name": "Library", "latitude": 1, "longitude": 2},
            headers=self._auth(self.admin_token),
        )
        self.assertEqual(created.status_code, 201)

    def test_existing_sqlite_schema_receives_additive_columns(self):
        with self.app.app_context():
            db.session.execute(db.text("ALTER TABLE donors DROP COLUMN location"))
            db.session.commit()
            migrate_sqlite_schema()
            columns = {
                column["name"]
                for column in inspect(db.engine).get_columns("donors")
            }
            self.assertIn("location", columns)

    def test_nullable_guest_report_migration_preserves_incident_history(self):
        with self.app.app_context():
            db.session.execute(db.text("DROP TABLE incidents"))
            db.session.execute(
                db.text(
                    """
                    CREATE TABLE incidents (
                        id INTEGER NOT NULL PRIMARY KEY,
                        reporter_id INTEGER NOT NULL REFERENCES users(id),
                        facility_id INTEGER REFERENCES facilities(id),
                        zone_id INTEGER REFERENCES campus_zones(id),
                        incident_type VARCHAR(80) NOT NULL,
                        description TEXT NOT NULL,
                        location_description VARCHAR(255),
                        contact_info VARCHAR(120),
                        status VARCHAR(32) NOT NULL,
                        priority VARCHAR(16) NOT NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        CONSTRAINT check_incidents_status CHECK (
                            status IN ('reported', 'acknowledged', 'in_progress', 'resolved', 'cancelled')
                        ),
                        CONSTRAINT check_incidents_priority CHECK (
                            priority IN ('low', 'medium', 'high', 'critical')
                        )
                    )
                    """
                )
            )
            db.session.execute(
                db.text(
                    """
                    INSERT INTO incidents (
                        id, reporter_id, incident_type, description,
                        location_description, contact_info, status, priority,
                        created_at, updated_at
                    ) VALUES (
                        41, :reporter_id, 'injury', 'Preserve this report',
                        'Library', '555-0190', 'in_progress', 'high',
                        '2025-01-01 10:00:00', '2025-01-01 10:05:00'
                    )
                    """
                ),
                {"reporter_id": self.student.id},
            )
            db.session.execute(
                db.text(
                    """
                    INSERT INTO incident_updates (
                        incident_id, updated_by_id, status, message,
                        created_at, updated_at
                    ) VALUES (
                        41, :updated_by_id, 'under_review', 'Staff review started',
                        '2025-01-01 10:05:00', '2025-01-01 10:05:00'
                    )
                    """
                ),
                {"updated_by_id": self.health_worker.id},
            )
            db.session.commit()

            migrate_incident_reporters_nullable()
            column_info = inspect(db.engine).get_columns("incidents")
            reporter = next(column for column in column_info if column["name"] == "reporter_id")
            self.assertTrue(reporter["nullable"])
            row = db.session.execute(
                db.text("SELECT reporter_id, description FROM incidents WHERE id=41")
            ).one()
            self.assertEqual(row.reporter_id, self.student.id)
            self.assertEqual(row.description, "Preserve this report")
            update = db.session.execute(
                db.text("SELECT message FROM incident_updates WHERE incident_id=41")
            ).scalar_one()
            self.assertEqual(update, "Staff review started")

    def test_create_user_command_prompts_for_privileged_role(self):
        runner = self.app.test_cli_runner()
        result = runner.invoke(
            args=["create-user"],
            input=(
                "CLI Administrator\n"
                "cli-admin@example.test\n"
                "admin\n"
                "strong-password-123\n"
                "strong-password-123\n"
            ),
        )
        self.assertEqual(result.exit_code, 0, result.output)
        with self.app.app_context():
            user = db.session.scalar(
                db.select(User).where(User.email == "cli-admin@example.test")
            )
            self.assertIsNotNone(user)
            self.assertEqual(user.role, "admin")
            self.assertTrue(user.check_password("strong-password-123"))

    def test_empty_health_intelligence_has_real_zero_counts(self):
        response = self.client.get(
            "/api/intelligence/summary",
            headers=self._auth(self.admin_token),
        )
        summary = response.get_json()["summary"]
        self.assertEqual(summary["total_incidents"], 0)
        self.assertEqual(summary["categories"], [])
        self.assertEqual(summary["frequent_locations"], [])
        self.assertTrue(all(item["count"] == 0 for item in summary["trend"]))


if __name__ == "__main__":
    unittest.main()
