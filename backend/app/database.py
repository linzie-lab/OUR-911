from app.extensions import db


def migrate_incident_reporters_nullable():
    if db.engine.dialect.name != "sqlite":
        return

    connection = db.engine.raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        columns = cursor.execute("PRAGMA table_info(incidents)").fetchall()
        reporter = next((column for column in columns if column[1] == "reporter_id"), None)
        if reporter is None or reporter[3] == 0:
            return

        cursor.execute("BEGIN")
        cursor.execute(
            """
            CREATE TABLE incidents_new (
                id INTEGER NOT NULL PRIMARY KEY,
                reporter_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
                zone_id INTEGER REFERENCES campus_zones(id) ON DELETE SET NULL,
                incident_type VARCHAR(80) NOT NULL,
                description TEXT NOT NULL,
                location_description VARCHAR(255),
                contact_info VARCHAR(120),
                status VARCHAR(32) NOT NULL,
                priority VARCHAR(16) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                CONSTRAINT check_incidents_status CHECK (
                    status IN (
                        'reported', 'acknowledged', 'in_progress',
                        'resolved', 'cancelled'
                    )
                ),
                CONSTRAINT check_incidents_priority CHECK (
                    priority IN ('low', 'medium', 'high', 'critical')
                )
            )
            """
        )
        existing_names = {column[1] for column in columns}
        target_columns = [
            "id",
            "reporter_id",
            "facility_id",
            "zone_id",
            "incident_type",
            "description",
            "location_description",
            "contact_info",
            "status",
            "priority",
            "created_at",
            "updated_at",
        ]
        copy_columns = [name for name in target_columns if name in existing_names]
        names = ", ".join(copy_columns)
        cursor.execute(
            f"INSERT INTO incidents_new ({names}) SELECT {names} FROM incidents"
        )
        cursor.execute("DROP TABLE incidents")
        cursor.execute("ALTER TABLE incidents_new RENAME TO incidents")
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_incidents_reporter_id "
            "ON incidents (reporter_id)"
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        try:
            connection.cursor().execute("PRAGMA foreign_keys=ON")
        finally:
            connection.close()


SQLITE_ADDITIONS = {
    "incidents": {
        "contact_info": "VARCHAR(120)",
    },
    "donors": {
        "location": "VARCHAR(160)",
    },
    "blood_requests": {
        "facility_name": "VARCHAR(160)",
        "contact_name": "VARCHAR(120)",
        "contact_phone": "VARCHAR(32)",
    },
    "facilities": {
        "services": "TEXT NOT NULL DEFAULT '[]'",
        "operating_hours": "VARCHAR(255)",
        "description": "TEXT",
        "is_verified": "BOOLEAN NOT NULL DEFAULT 0",
    },
}


def migrate_sqlite_schema():
    if db.engine.dialect.name != "sqlite":
        return

    migrate_incident_reporters_nullable()
    with db.engine.begin() as connection:
        for table_name, additions in SQLITE_ADDITIONS.items():
            result = connection.exec_driver_sql(
                f"PRAGMA table_info({table_name})"
            )
            existing_columns = {row[1] for row in result}
            for column_name, definition in additions.items():
                if column_name not in existing_columns:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN {column_name} {definition}"
                    )
