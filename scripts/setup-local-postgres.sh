#!/bin/bash
#
# Creates dev/test databases on a host-installed PostgreSQL (not Docker).
# Run from anywhere:
#   ./scripts/setup-local-postgres.sh
#
# Uses `backend/.env` (copies from `backend/.env.example` if missing).
# For Docker-based Postgres, use from repo root:
#   docker compose up -d postgres
#   docker compose --profile tools run --rm migrate

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend" || exit 1

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Hotel PMS — host PostgreSQL setup"
echo "===================================="
echo ""

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL client (psql) is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ psql found${NC}"

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found — copying from .env.example${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Update backend/.env with your credentials${NC}"
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true

DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-hotel_pms_dev}
DB_NAME_TEST=${DB_NAME_TEST:-hotel_pms_test}

echo ""
echo "Database configuration:"
echo "  Host: $DB_HOST  Port: $DB_PORT  User: $DB_USER"
echo "  Dev DB: $DB_NAME  Test DB: $DB_NAME_TEST"
echo ""

create_db_if_not_exists() {
    local db_name=$1
    if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo -e "${YELLOW}⚠️  Database '$db_name' already exists${NC}"
    else
        echo "Creating database '$db_name'..."
        if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $db_name;"; then
            echo -e "${GREEN}✅ Database '$db_name' created${NC}"
        else
            echo -e "${RED}❌ Failed to create database '$db_name'${NC}"
            return 1
        fi
    fi
}

echo "Creating databases..."
create_db_if_not_exists "$DB_NAME"
create_db_if_not_exists "$DB_NAME_TEST"

echo ""
echo "Running migrations..."
npm run db:migrate

echo -e "${GREEN}✅ Migrations complete${NC}"
echo ""
echo "Next: npm run dev  |  optional: npm run db:seed"
