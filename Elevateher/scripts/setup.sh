#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '[SETUP] %s\n' "$1"; }
ok() { printf '[  OK  ] %s\n' "$1"; }
warn() { printf '[ WARN ] %s\n' "$1"; }
fail() { printf '[ FAIL ] %s\n' "$1" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail 'Docker not found. Install Docker Desktop first.'
command -v python3 >/dev/null 2>&1 || fail 'Python 3 not found.'
command -v node >/dev/null 2>&1 || fail 'Node.js not found.'
command -v npm >/dev/null 2>&1 || fail 'npm not found.'

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
NODE_VERSION=$(node --version | cut -d'v' -f1)

[[ ${PYTHON_VERSION%.*} -ge 3 ]] && [[ ${PYTHON_VERSION#*.} -ge 11 ]] || fail "Python 3.11+ required. Got: $PYTHON_VERSION"
[[ $NODE_VERSION -ge 20 ]] || fail "Node.js 20+ required. Got: $NODE_VERSION"

if [ ! -f .env ]; then
  cp .env.example .env
  JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
  DASHBOARD_TOKEN=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/CHANGE_THIS_TO_A_RANDOM_256_BIT_SECRET/$JWT_SECRET/" .env
    sed -i '' "s/CHANGE_THIS_DASHBOARD_SERVICE_TOKEN/$DASHBOARD_TOKEN/" .env
  else
    sed -i "s/CHANGE_THIS_TO_A_RANDOM_256_BIT_SECRET/$JWT_SECRET/" .env
    sed -i "s/CHANGE_THIS_DASHBOARD_SERVICE_TOKEN/$DASHBOARD_TOKEN/" .env
  fi
  ok '.env created with generated secrets'
else
  warn '.env already exists, skipping secret generation'
fi

mkdir -p data/models data/datasets data/finetune/checkpoints infra/docker logs

if [ -d services/api ]; then
  log 'Installing API Python dependencies'
  python3 -m pip install --upgrade pip
  python3 -m pip install -r services/api/requirements.txt
fi

if [ -d apps/web ]; then
  log 'Installing web dependencies'
  (cd apps/web && npm ci)
fi

if [ -d apps/dashboard ]; then
  log 'Installing dashboard dependencies'
  (cd apps/dashboard && npm ci)
fi

log 'Starting Docker services'
docker compose -f infra/docker/docker-compose.yml up --build -d

log 'Running API migrations'
docker exec elevateher_api python scripts/apply_migrations.py || true

log 'Seeding demo data'
docker exec elevateher_api python scripts/seed_demo_data.py || true

echo ''
log 'Setup complete'
echo 'Web app: http://localhost:3000'
echo 'Dashboard: http://localhost:3001'
echo 'API docs: http://localhost:8000/docs'
echo 'Health: http://localhost:8000/health'
