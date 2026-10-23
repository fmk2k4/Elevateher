import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool, text

from alembic import context
from sql_utils import split_sql_statements

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def get_database_url():
    return (
        os.getenv("DATABASE_URL_SYNC")
        or os.getenv("DATABASE_URL")
        or config.get_main_option("sqlalchemy.url")
    )


def run_migrations_offline():
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_sync(_apply_sql_migrations)


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_database_url()
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            _apply_sql_migrations(connection)


def _apply_sql_migrations(connection):
    migrations = ROOT / "services" / "db" / "migrations"
    for path in sorted(migrations.glob("*.sql")):
        for statement in split_sql_statements(path.read_text(encoding="utf-8")):
            connection.execute(text(statement))


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
