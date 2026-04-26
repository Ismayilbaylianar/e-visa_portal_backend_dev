# E-Visa Portal Backend - Storage Architecture

## Overview

The storage layer provides a provider-agnostic abstraction for file storage operations. This allows the application to seamlessly switch between local filesystem storage and S3-compatible object storage without changing business logic.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DocumentsService                              │
│  (Business logic, validation, authorization)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     StorageService                               │
│  (Filename generation, checksum, upload orchestration)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   StorageProvider                                │
│                    (Interface)                                   │
└─────────────────────────────────────────────────────────────────┘
              ┌───────────┴───────────┐
              ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐
│  LocalStorageProvider │   │   S3StorageProvider  │
│  (Filesystem)         │   │   (S3-compatible)    │
└──────────────────────┘   └──────────────────────┘
```

## Providers

### Local Storage Provider

Stores files on the local filesystem. Suitable for:
- Development environments
- Single-server deployments
- Small-scale applications

**Pros:**
- Simple setup
- No external dependencies
- Low latency

**Cons:**
- Not scalable across multiple servers
- Requires disk management
- No built-in redundancy

### S3 Storage Provider (Scaffold)

Stores files in S3-compatible object storage. Suitable for:
- Production deployments
- Multi-server environments
- Cloud-native applications

Supports:
- AWS S3
- MinIO
- DigitalOcean Spaces
- Wasabi
- Any S3-compatible service

**Note:** The S3 provider is scaffolded but requires `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages to be fully functional.

## Configuration

### Environment Variables

```bash
# Provider selection
STORAGE_PROVIDER=local  # 'local' or 's3'

# Local storage
STORAGE_LOCAL_PATH=/var/www/evisa-backend/uploads
STORAGE_LOCAL_BASE_URL=http://46.224.16.161

# S3 storage (required when STORAGE_PROVIDER=s3)
STORAGE_S3_BUCKET=evisa-documents
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY_ID=your-access-key
STORAGE_S3_SECRET_ACCESS_KEY=your-secret-key

# S3 optional settings
STORAGE_S3_ENDPOINT=https://s3.example.com  # For non-AWS S3
STORAGE_S3_PUBLIC_URL=https://cdn.example.com
STORAGE_S3_FORCE_PATH_STYLE=false  # true for MinIO

# File validation
STORAGE_MAX_FILE_SIZE=10485760  # 10MB in bytes
STORAGE_ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png,image/gif,image/webp
STORAGE_ALLOWED_EXTENSIONS=.pdf,.jpg,.jpeg,.png,.gif,.webp
```

## File Validation

### Allowed MIME Types (Default)
- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

### Allowed Extensions (Default)
- `.pdf`
- `.jpg`, `.jpeg`
- `.png`
- `.gif`
- `.webp`

### Size Limit
- Default: 10MB (10485760 bytes)
- Configurable via `STORAGE_MAX_FILE_SIZE`

## Security

### Path Traversal Protection
- All paths are sanitized to prevent `../` attacks
- Filenames are normalized before use

### Safe Filename Generation
- Unique filenames generated using timestamp + random bytes
- Original filename preserved in database for display
- Extension validated against allowlist

### Checksum Verification
- MD5 checksum calculated on upload
- Stored in database for integrity verification
- Admin endpoint available to verify file integrity

### Access Control
- Portal users can only access their own documents
- Admin users have unrestricted access
- Soft-deleted documents are not accessible

## Database Schema

### Document Model Fields

| Field | Type | Description |
|-------|------|-------------|
| `originalFileName` | String | User's original filename |
| `storageFileName` | String | Generated safe filename |
| `storagePath` | String | Directory path (legacy) |
| `storageKey` | String | Full storage key |
| `storageProvider` | String | Provider name (local/s3) |
| `mimeType` | String | Content type |
| `fileSize` | Int | Size in bytes |
| `checksum` | String | MD5 hash |

## API Endpoints

### Portal Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portal/applicants/:id/documents` | List documents |
| POST | `/portal/documents/upload` | Upload document |
| GET | `/portal/documents/:id` | Get document info |
| GET | `/portal/documents/:id/download` | Download file |
| GET | `/portal/documents/:id/url` | Get signed URL |
| DELETE | `/portal/documents/:id` | Soft delete |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/documents/:id` | Get document info |
| GET | `/admin/documents/:id/download` | Download file |
| PATCH | `/admin/documents/:id/review` | Review document |
| GET | `/admin/documents/:id/verify` | Verify integrity |
| DELETE | `/admin/documents/:id/hard` | Hard delete |

## Local Storage Directory Structure

```
/var/www/evisa-backend/uploads/
├── documents/
│   ├── {applicantId}/
│   │   ├── 1714123456789_abc123def456.pdf
│   │   ├── 1714123456789_abc123def456.pdf.meta.json
│   │   └── ...
│   └── ...
└── ...
```

## Future S3 Switch Plan

### Prerequisites
1. Install AWS SDK packages:
   ```bash
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```
2. Create S3 bucket with appropriate permissions
3. Configure IAM credentials

### Migration Steps

1. **Preparation**
   ```bash
   # Add S3 credentials to .env (do NOT change STORAGE_PROVIDER yet)
   STORAGE_S3_BUCKET=evisa-documents
   STORAGE_S3_REGION=eu-central-1
   STORAGE_S3_ACCESS_KEY_ID=xxx
   STORAGE_S3_SECRET_ACCESS_KEY=xxx
   ```

2. **Complete S3 Provider Implementation**
   - Uncomment S3Client initialization in `s3-storage.provider.ts`
   - Implement all methods using AWS SDK

3. **Sync Existing Files (if any)**
   ```bash
   # Use aws-cli or s3cmd to sync local files to S3
   aws s3 sync /var/www/evisa-backend/uploads s3://evisa-documents/
   ```

4. **Switch Provider**
   ```bash
   # Update .env
   STORAGE_PROVIDER=s3
   
   # Restart app
   pm2 restart evisa-backend
   ```

5. **Verification**
   - Test upload
   - Test download
   - Test signed URLs
   - Verify integrity

6. **Cleanup (after validation)**
   ```bash
   # Optionally remove local files after confirming S3 works
   ```

## Troubleshooting

### File Not Found
```bash
# Check if file exists in storage
ls -la /var/www/evisa-backend/uploads/documents/{applicantId}/

# Check database record
psql -c "SELECT storage_key, storage_path, storage_file_name FROM documents WHERE id='xxx';"
```

### Permission Issues
```bash
# Verify directory permissions
ls -la /var/www/evisa-backend/uploads/
# Should be owned by app user (anar)

# Fix if needed
chown -R anar:anar /var/www/evisa-backend/uploads/
chmod -R 755 /var/www/evisa-backend/uploads/
```

### Checksum Mismatch
```bash
# Verify file integrity via admin endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/admin/documents/{id}/verify
```

## Monitoring

### Disk Usage (Local)
```bash
du -sh /var/www/evisa-backend/uploads/
du -sh /var/www/evisa-backend/uploads/documents/
```

### Document Statistics
```sql
-- Total documents by status
SELECT review_status, COUNT(*) FROM documents GROUP BY review_status;

-- Storage by provider
SELECT storage_provider, COUNT(*), SUM(file_size) FROM documents GROUP BY storage_provider;

-- Documents without checksum
SELECT COUNT(*) FROM documents WHERE checksum IS NULL;
```

---

*Last updated: 2026-04-26*
