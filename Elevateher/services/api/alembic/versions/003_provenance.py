"""Alembic migration 003 — Phase 6 provenance + connectivity class.

This is a safety net for the provenance schema migration that lives in
`services/db/migrations/003_provenance.sql`. Originally only `001_initial.py`
existed; it executed all SQL files via a glob, but the live database container
never re-ran the initial migration.

Re-running `003_provenance.sql` is idempotent — every ALTER TABLE / CREATE INDEX
/ VIEW uses `IF NOT EXISTS` clauses, so this migration just guarantees the schema
is current on any fresh deployment even if a partial-already-applied state
exists.

down_revision: 001_initial
revision:      003_provenance
"""

from pathlib import Path

from sqlalchemy import text

from alembic import op

revision = "003_provenance"
down_revision = "001_initial"
branch_labels = None
depends_on = None

MIGRATIONS_DIR = Path(__file__).resolve().parents[4] / "services" / "db" / "migrations"


def upgrade() -> None:
    """Apply the provenance migration idempotently."""
    sql_file = MIGRATIONS_DIR / "003_provenance.sql"
    if not sql_file.exists():
        return
    connection = op.get_bind()
    # Split on bare semicolons; SQL is well-formed PostgreSQL DDL.
    for statement in _split_sql(sql_file.read_text(encoding="utf-8")):
        connection.execute(text(statement))


def downgrade() -> None:
    """No rollback — provenance schema is forward-only.

    A full downgrade would drop columns and views, breaking the impact
    ledger. The DOWN migration is intentionally a no-op so accidental rollbacks
    surface at the operator layer rather than silently corrupting data.
    """
    return


def _split_sql(content: str) -> list[str]:
    """Crude SQL splitter tolerant of comments + multi-line statements.

    Pure Python so we don't have to import the API-side sql_utils at migration time.
    """
    cleaned_lines: list[str] = []
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue
        cleaned_lines.append(line)
    text_clean = "\n".join(cleaned_lines)
    statements: list[str] = []
    buffer: list[str] = []
    for char in text_clean:
        buffer.append(char)
        if char == ";":
            stmt = "".join(buffer).strip()
            if stmt:
                statements.append(stmt)
            buffer = []
    if buffer and "".join(buffer).strip():
        statements.append("".join(buffer).strip())
    return statements
