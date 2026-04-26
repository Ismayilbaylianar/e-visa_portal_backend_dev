# E-Visa Portal Backend - Operations Guide

## Server Overview

| Component | Details |
|-----------|---------|
| Server IP | 46.224.16.161 |
| SSH User | anar |
| App Path | /var/www/evisa-backend/app |
| Backup Path | /var/www/evisa-backend/backups |
| Upload Path | /var/www/evisa-backend/uploads |
| Log Path | /var/log/evisa |
| Node.js | v22.22.2 |
| PM2 | v6.0.14 |
| PostgreSQL | Local (evisa_prod) |
| Redis | Local (127.0.0.1:6379) |

---

## Quick Commands

### Application Management

```bash
# SSH to server
ssh -i ~/.ssh/hetzner_ed25519 anar@46.224.16.161

# Check app status
pm2 status

# Restart application
pm2 restart evisa-backend

# Stop application
pm2 stop evisa-backend

# Start application (using ecosystem file)
cd /var/www/evisa-backend/app
pm2 start ecosystem.config.js --env production

# Reload with zero downtime
pm2 reload evisa-backend

# View real-time logs
pm2 logs evisa-backend

# View last 100 lines of logs
pm2 logs evisa-backend --lines 100

# Clear logs
pm2 flush evisa-backend
```

### Health Checks

```bash
# Liveness check (from server)
curl http://127.0.0.1:3000/api/v1/system/health/live

# Readiness check (from server)
curl http://127.0.0.1:3000/api/v1/system/health/ready

# Public health check
curl http://46.224.16.161/api/v1/system/health/live

# Swagger docs
curl -I http://46.224.16.161/docs
```

### Service Management

```bash
# PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Redis
sudo systemctl status redis-server
sudo systemctl restart redis-server

# Nginx
sudo systemctl status nginx
sudo systemctl reload nginx
sudo nginx -t  # Test config before reload
```

---

## Log Locations

| Log Type | Location | Rotation |
|----------|----------|----------|
| App combined | /var/log/evisa/app.log | Daily, 14 days |
| App errors | /var/log/evisa/error.log | Daily, 14 days |
| App stdout | /var/log/evisa/out.log | Daily, 14 days |
| Backup log | /var/log/evisa/backup.log | Weekly, 8 weeks |
| Nginx access | /var/log/nginx/access.log | Daily (system) |
| Nginx error | /var/log/nginx/error.log | Daily (system) |
| PM2 daemon | ~/.pm2/pm2.log | PM2 managed |

### Viewing Logs

```bash
# Real-time app logs
pm2 logs evisa-backend

# Last 200 lines of app log
tail -200 /var/log/evisa/app.log

# Search for errors
grep -i error /var/log/evisa/error.log | tail -50

# Search for specific pattern
grep "OTP" /var/log/evisa/app.log | tail -20

# Nginx access logs
sudo tail -100 /var/log/nginx/access.log

# Watch logs in real-time
tail -f /var/log/evisa/app.log
```

---

## Database Backup

### Backup Script Location
```
/var/www/evisa-backend/app/scripts/backup-database.sh
```

### Backup Output Directory
```
/var/www/evisa-backend/backups/
```

### Backup Naming Convention
```
evisa_prod_YYYYMMDD_HHMMSS.sql.gz
```

### Manual Backup

```bash
# Run backup manually
cd /var/www/evisa-backend/app
PGPASSWORD='Wolvex*1385' DB_USER=evisa_app DB_NAME=evisa_prod ./scripts/backup-database.sh

# Or with .pgpass configured
./scripts/backup-database.sh
```

### Cron Schedule (Daily at 2:00 AM)

```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * * PGPASSWORD='Wolvex*1385' DB_USER=evisa_app DB_NAME=evisa_prod /var/www/evisa-backend/app/scripts/backup-database.sh >> /var/log/evisa/backup.log 2>&1
```

### Restore from Backup

```bash
# 1. Stop application
pm2 stop evisa-backend

# 2. List available backups
ls -la /var/www/evisa-backend/backups/

# 3. Restore (replace BACKUP_FILE with actual filename)
gunzip -c /var/www/evisa-backend/backups/evisa_prod_20260426_020000.sql.gz | \
  PGPASSWORD='Wolvex*1385' psql -h localhost -U evisa_app -d evisa_prod

# 4. Restart application
pm2 start evisa-backend

# 5. Verify health
curl http://127.0.0.1:3000/api/v1/system/health/ready
```

### Backup Retention
- Default: 14 days
- Can be changed via `BACKUP_RETENTION_DAYS` environment variable

---

## Email Configuration

### Current Mode
```
EMAIL_PROVIDER=console
```

Emails are logged to console/app log, not actually sent.

### Environment Variables for SMTP

When ready to enable real SMTP:

```env
# Required for SMTP mode
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=E-Visa Portal

# Optional OTP settings
OTP_EXPIRY_MINUTES=10
OTP_LENGTH=6
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_ATTEMPTS_PER_HOUR=10
```

### Safe SMTP Rollout Steps

1. **Preparation Phase**
   ```bash
   # Verify current email logs work
   grep "ConsoleEmailProvider" /var/log/evisa/app.log | tail -5
   ```

2. **Add SMTP credentials to .env** (do NOT change EMAIL_PROVIDER yet)
   ```bash
   # Edit .env
   nano /var/www/evisa-backend/app/.env
   
   # Add SMTP vars but keep EMAIL_PROVIDER=console
   ```

3. **Test SMTP with admin endpoint** (requires authentication)
   ```bash
   # Login as admin first to get JWT token
   TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"super@visa.com","password":"super123"}' | jq -r '.data.accessToken')
   
   # Test email (temporarily set EMAIL_PROVIDER=smtp in .env, restart, then test)
   curl -X POST http://127.0.0.1:3000/api/v1/admin/email/test \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"to":"your-test-email@example.com"}'
   ```

4. **Switch to SMTP mode**
   ```bash
   # Edit .env
   nano /var/www/evisa-backend/app/.env
   # Change: EMAIL_PROVIDER=smtp
   
   # Restart app
   pm2 restart evisa-backend
   
   # Verify startup
   pm2 logs evisa-backend --lines 20
   ```

5. **Verify email sending works**
   ```bash
   # Check email config status
   curl -X GET http://127.0.0.1:3000/api/v1/admin/email/status \
     -H "Authorization: Bearer $TOKEN"
   ```

### Rollback to Console Mode

```bash
# Edit .env
nano /var/www/evisa-backend/app/.env
# Change: EMAIL_PROVIDER=console

# Restart
pm2 restart evisa-backend
```

---

## Email Operational Verification

### Test Checklist

#### 1. OTP Email Test
```bash
# Trigger OTP send
curl -X POST http://46.224.16.161/api/v1/portal/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check logs for email send attempt
grep "sendOtpEmail" /var/log/evisa/app.log | tail -5

# In console mode, look for:
# [ConsoleEmailProvider] Would send email to: test@example.com
```

#### 2. Check EmailLog Table
```bash
# Connect to database
PGPASSWORD='Wolvex*1385' psql -h localhost -U evisa_app -d evisa_prod

# Query recent email logs
SELECT id, template_key, recipient, provider, status, error_message, created_at 
FROM email_logs 
ORDER BY created_at DESC 
LIMIT 10;

# Exit
\q
```

#### 3. Admin Test Email (Requires Auth)
```bash
# Get admin token
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"super@visa.com","password":"super123"}' | jq -r '.data.accessToken')

# Send test email
curl -X POST http://127.0.0.1:3000/api/v1/admin/email/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'

# Check email status
curl -X GET http://127.0.0.1:3000/api/v1/admin/email/status \
  -H "Authorization: Bearer $TOKEN"

# Check email statistics
curl -X GET http://127.0.0.1:3000/api/v1/admin/email/statistics \
  -H "Authorization: Bearer $TOKEN"

# Check recent failures
curl -X GET http://127.0.0.1:3000/api/v1/admin/email/failures \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Notification Email Test
```bash
# Check notification table for EMAIL channel
PGPASSWORD='Wolvex*1385' psql -h localhost -U evisa_app -d evisa_prod -c \
  "SELECT id, channel, template_key, recipient, status, provider, error_message, created_at 
   FROM notifications 
   WHERE channel = 'EMAIL' 
   ORDER BY created_at DESC 
   LIMIT 10;"
```

### Expected Behavior

| Mode | Log Output | EmailLog Status | Actual Send |
|------|------------|-----------------|-------------|
| console | "[ConsoleEmailProvider] Would send..." | SENT | No |
| smtp (success) | "[SmtpEmailProvider] Email sent..." | SENT | Yes |
| smtp (failure) | "[SmtpEmailProvider] Failed to send..." | FAILED | No |

### Failure Path Verification

To test failure handling:
1. Set invalid SMTP credentials
2. Trigger OTP send
3. Verify:
   - OTP record is still created
   - EmailLog shows FAILED status
   - Error message is logged
   - API returns appropriate error

---

## Deployment Updates

### Standard Update Process

```bash
# SSH to server
ssh -i ~/.ssh/hetzner_ed25519 anar@46.224.16.161

# Navigate to app directory
cd /var/www/evisa-backend/app

# Pull latest code
git pull origin main

# Install dependencies (if package.json changed)
npm ci

# Regenerate Prisma client (if schema changed)
npx prisma generate

# Run migrations (if schema changed)
npx prisma db push

# Rebuild application
npm run build

# Reload with zero downtime
pm2 reload evisa-backend

# Verify health
curl http://127.0.0.1:3000/api/v1/system/health/ready
```

### Emergency Rollback

```bash
# Revert to previous commit
git log --oneline -5  # Find commit to revert to
git checkout <commit-hash>

# Rebuild and restart
npm run build
pm2 restart evisa-backend
```

---

## PM2 Process Management

### Current Configuration
- Process name: `evisa-backend`
- Mode: fork (single instance)
- Auto-restart: enabled
- Max memory: 500MB (triggers restart)
- Max restarts: 10 (with backoff)

### Using Ecosystem File

```bash
# Start with ecosystem file
pm2 start ecosystem.config.js --env production

# Reload with ecosystem file
pm2 reload ecosystem.config.js --env production

# Delete and restart fresh
pm2 delete evisa-backend
pm2 start ecosystem.config.js --env production
```

### Startup Persistence

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Verify saved processes
pm2 resurrect --help
```

---

## Monitoring (Basic)

### Resource Usage

```bash
# PM2 monitoring dashboard
pm2 monit

# Memory usage
pm2 info evisa-backend | grep memory

# CPU usage
top -p $(pm2 pid evisa-backend)
```

### Database Size

```bash
PGPASSWORD='Wolvex*1385' psql -h localhost -U evisa_app -d evisa_prod -c \
  "SELECT pg_size_pretty(pg_database_size('evisa_prod'));"
```

### Disk Usage

```bash
# Overall disk usage
df -h /

# App directory size
du -sh /var/www/evisa-backend/

# Log directory size
du -sh /var/log/evisa/

# Backup directory size
du -sh /var/www/evisa-backend/backups/
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs evisa-backend --lines 100

# Check if port is in use
lsof -i :3000

# Check Node.js version
node -v

# Check environment variables
cat /var/www/evisa-backend/app/.env
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
PGPASSWORD='Wolvex*1385' psql -h localhost -U evisa_app -d evisa_prod -c '\conninfo'

# Check PostgreSQL service
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -50 /var/log/postgresql/postgresql-*-main.log
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check Redis service
sudo systemctl status redis-server
```

### Nginx Issues

```bash
# Test config
sudo nginx -t

# Check logs
sudo tail -50 /var/log/nginx/error.log

# Reload after config changes
sudo systemctl reload nginx
```

---

## Future Work

The following items are planned but not yet implemented:

| Item | Status | Notes |
|------|--------|-------|
| Domain/SSL | Pending | Will use Let's Encrypt |
| S3 File Storage | Pending | For document uploads |
| Background Workers | Pending | For async job processing |
| Full Monitoring | Pending | Prometheus/Grafana or similar |
| Payment Provider | Pending | Currently mock mode |
| Rate Limiting | Pending | Nginx or app-level |
| CDN | Pending | For static assets |
| CI/CD Pipeline | Pending | GitHub Actions |

---

## Emergency Contacts / Escalation

| Issue | First Response |
|-------|---------------|
| App down | Check PM2 status, restart if needed |
| DB connection | Check PostgreSQL service |
| High memory | Restart app with `pm2 restart` |
| Disk full | Check logs, clean old backups |
| Security incident | Stop app, investigate logs |

---

*Last updated: 2026-04-26*
