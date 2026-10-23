from pathlib import Path

from sqlalchemy import text

from alembic import op
from sql_utils import split_sql_statements

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None

MIGRATIONS_DIR = Path(__file__).resolve().parents[4] / "services" / "db" / "migrations"


def _run_sql_file(path: Path) -> None:
    connection = op.get_bind()
    for statement in split_sql_statements(path.read_text(encoding="utf-8")):
        connection.execute(text(statement))


def upgrade():
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        _run_sql_file(path)


def downgrade():
    connection = op.get_bind()
    connection.execute(text("DROP VIEW IF EXISTS v_institution_cohort_summary"))
    connection.execute(text("DROP VIEW IF EXISTS v_sdg_impact_timeline"))
    connection.execute(text("DROP VIEW IF EXISTS v_active_matches"))
    connection.execute(text("DROP VIEW IF EXISTS v_mentor_leaderboard"))
    for table in [
        "notifications",
        "mentor_risk_snapshots",
        "safety_reports",
        "impact_events",
        "session_messages",
        "sessions",
        "matches",
        "mentor_profiles",
        "mentee_profiles",
        "guardian_consents",
        "user_passwords",
        "users",
        "institutions",
        "auth_verification_token",
        "app_auth_sessions",
        "auth_accounts",
        "auth_users",
    ]:
        connection.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
    for enum in [
        "verification_status",
        "safety_status",
        "safety_severity",
        "impact_event_type",
        "sdg_track",
        "session_channel",
        "match_status",
        "education_level",
        "user_role",
    ]:
        connection.execute(text(f"DROP TYPE IF EXISTS {enum}"))
