#!/bin/bash
# =============================================================================
# PostgreSQL Database Backup Script for E-Visa Portal
# =============================================================================
# Location: /var/www/evisa-backend/app/scripts/backup-database.sh
# Schedule: Daily via cron (recommended: 2:00 AM)
# Retention: 14 days by default
# =============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="/var/www/evisa-backend/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
LOG_FILE="/var/log/evisa/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_TODAY=$(date +"%Y-%m-%d")

# Database configuration (from environment or defaults)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-evisa_prod}"
DB_USER="${DB_USER:-evisa_app}"

# Backup file naming
BACKUP_FILENAME="evisa_prod_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Logging function
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Ensure backup directory exists
ensure_backup_dir() {
    if [ ! -d "${BACKUP_DIR}" ]; then
        mkdir -p "${BACKUP_DIR}" || error_exit "Failed to create backup directory: ${BACKUP_DIR}"
        log "INFO" "Created backup directory: ${BACKUP_DIR}"
    fi
}

# Ensure log directory exists
ensure_log_dir() {
    local log_dir=$(dirname "${LOG_FILE}")
    if [ ! -d "${log_dir}" ]; then
        mkdir -p "${log_dir}" || error_exit "Failed to create log directory: ${log_dir}"
    fi
}

# Perform database backup
perform_backup() {
    log "INFO" "Starting backup of database: ${DB_NAME}"
    log "INFO" "Backup file: ${BACKUP_PATH}"
    
    # Use pg_dump with compression
    # Password is expected from .pgpass file or PGPASSWORD environment variable
    if pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        2>> "${LOG_FILE}" | gzip > "${BACKUP_PATH}"; then
        
        local backup_size=$(du -h "${BACKUP_PATH}" | cut -f1)
        log "INFO" "Backup completed successfully. Size: ${backup_size}"
        return 0
    else
        error_exit "pg_dump failed for database: ${DB_NAME}"
    fi
}

# Verify backup integrity
verify_backup() {
    log "INFO" "Verifying backup integrity..."
    
    if [ ! -f "${BACKUP_PATH}" ]; then
        error_exit "Backup file not found: ${BACKUP_PATH}"
    fi
    
    local file_size=$(stat -f%z "${BACKUP_PATH}" 2>/dev/null || stat -c%s "${BACKUP_PATH}" 2>/dev/null)
    if [ "${file_size}" -lt 1000 ]; then
        error_exit "Backup file suspiciously small (${file_size} bytes). May be corrupted."
    fi
    
    # Test gzip integrity
    if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
        log "INFO" "Backup integrity verified (gzip OK)"
        return 0
    else
        error_exit "Backup file failed gzip integrity check"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=0
    while IFS= read -r -d '' old_backup; do
        rm -f "${old_backup}"
        log "INFO" "Deleted old backup: $(basename "${old_backup}")"
        ((deleted_count++))
    done < <(find "${BACKUP_DIR}" -name "evisa_prod_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -print0 2>/dev/null)
    
    log "INFO" "Cleanup complete. Deleted ${deleted_count} old backup(s)"
}

# List current backups
list_backups() {
    log "INFO" "Current backups in ${BACKUP_DIR}:"
    ls -lh "${BACKUP_DIR}"/evisa_prod_*.sql.gz 2>/dev/null | while read -r line; do
        log "INFO" "  ${line}"
    done || log "INFO" "  (no backups found)"
}

# Main execution
main() {
    log "INFO" "=============================================="
    log "INFO" "Database backup started"
    log "INFO" "=============================================="
    
    ensure_log_dir
    ensure_backup_dir
    perform_backup
    verify_backup
    cleanup_old_backups
    list_backups
    
    log "INFO" "=============================================="
    log "INFO" "Database backup completed successfully"
    log "INFO" "=============================================="
}

# Run main function
main "$@"
