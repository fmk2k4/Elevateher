import os
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, text

API_ROOT = Path(__file__).resolve().parents[3] / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from sql_utils import split_sql_statements

config = context.config
database_url = (
    os.environ.get("DATABASE_URL_SYNC")
    or os.environ.get("DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
)
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_offline():
    for statement in _load_sql_statements():
        print(statement.rstrip(";"))


def run_migrations_online():
    engine = create_engine(config.get_main_option("sqlalchemy.url"))
    with engine.begin() as connection:
        for statement in _load_sql_statements():
            connection.execute(text(statement))


def _load_sql_statements():
    migrations = Path(__file__).resolve().parent
    for path in sorted(migrations.glob("*.sql")):
        for statement in split_sql_statements(path.read_text(encoding="utf-8")):
            yield statement


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
