#!/bin/bash
# =============================================================================
# Setup .pgpass for passwordless PostgreSQL access (backup scripts)
# =============================================================================
# Run this once on the server to enable secure backup without password in scripts
# =============================================================================

PGPASS_FILE="$HOME/.pgpass"

# Default values (override with environment variables)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-evisa_prod}"
DB_USER="${DB_USER:-evisa_app}"
DB_PASS="${DB_PASS:-}"

if [ -z "$DB_PASS" ]; then
    echo "Error: DB_PASS environment variable is required"
    echo "Usage: DB_PASS='your_password' ./setup-pgpass.sh"
    exit 1
fi

# Create or append to .pgpass
echo "${DB_HOST}:${DB_PORT}:${DB_NAME}:${DB_USER}:${DB_PASS}" >> "${PGPASS_FILE}"

# Set correct permissions (required by PostgreSQL)
chmod 600 "${PGPASS_FILE}"

echo "Created/updated ${PGPASS_FILE}"
echo "PostgreSQL will now use this file for authentication"
echo ""
echo "Test with: psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c '\\conninfo'"
