# RankSheet.com Deployment Checklist

**Generated:** 2024-12-18
**Purpose:** Pre-deployment verification after security and data integrity fixes

## Critical Security Fixes Applied

### Phase 1: Security Hardening ✅

- [x] **Credential Exposure**: Removed `.env` from repository
- [x] **IP Whitelist**: Enabled admin endpoint IP filtering
- [x] **Debug Endpoints**: Disabled in production (returns 404)
- [x] **Strict Environment**: Enabled validation for production secrets
- [x] **Idempotency Keys**: Enhanced with request context (method, path, IP)

### Phase 2: Data Integrity Fixes ✅

- [x] **Compensating Transactions**: Keyword+RankSheet updates with rollback
- [x] **Advisory Lock Timeout**: 30s acquire + 5min statement timeout
- [x] **ASIN Cache Validation**: Zod schema validation for cached data
- [x] **Scoring Safety**: NaN/Infinity防护 with safeDivide
- [x] **Job Queue Race**: Atomic INSERT ... ON CONFLICT pattern
- [x] **Worker CPU Spin**: 1s delay when queue empty + 100ms between jobs

## Pre-Deployment Checklist

### 1. Credential Rotation (CRITICAL - See SECURITY_ALERT.md)

- [ ] Generate new `PAYLOAD_SECRET` (openssl rand -base64 32)
- [ ] Generate new `JOB_TOKEN` (openssl rand -base64 32)
- [ ] Generate new `IP_HASH_SALT` (openssl rand -base64 32)
- [ ] Rotate PostgreSQL password
- [ ] Rotate `FASTAPI_KEY` (contact provider)
- [ ] Rotate `EXPRESS_API_KEY` (contact provider)

### 2. Environment Configuration

**CMS (apps/cms/.env)**

```bash
# Core
NODE_ENV=production
SITE_URL=https://cms.ranksheet.com
LOG_LEVEL=info

# Security (MUST rotate - see SECURITY_ALERT.md)
PAYLOAD_SECRET=<NEW_SECRET_FROM_STEP_1>
JOB_TOKEN=<NEW_TOKEN_FROM_STEP_1>
IP_HASH_SALT=<NEW_SALT_FROM_STEP_1>

# Database (update password)
DATABASE_URI=postgresql://postgres:<NEW_PASSWORD>@supabase-db:5432/postgres?schema=ranksheet

# APIs (update keys)
FASTAPI_KEY=<NEW_KEY_FROM_PROVIDER>
EXPRESS_API_KEY=<NEW_KEY_FROM_PROVIDER>

# Security enforcement
RS_STRICT_ENV=1
ADMIN_IP_WHITELIST=107.174.42.198  # REQUIRED for production

# Optional
REDIS_URL=redis://redis:6379
```

- [ ] All secrets rotated from SECURITY_ALERT.md
- [ ] `RS_STRICT_ENV=1` enabled
- [ ] `ADMIN_IP_WHITELIST` set to server IP
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` or `warn`
- [ ] No `dev_` prefixed values

### 3. Database Verification

```bash
# Connect to PostgreSQL
psql -h supabase-db -U postgres -d postgres

# Verify schema exists
\dt ranksheet.*

# Verify tables
SELECT table_name FROM information_schema.tables WHERE table_schema='ranksheet';

# Check job_runs table
SELECT COUNT(*) FROM ranksheet.job_runs WHERE status='RUNNING' AND started_at < NOW() - interval '1 hour';
# Should be 0 (no stale jobs)
```

- [ ] Schema `ranksheet` exists
- [ ] Tables `keywords`, `rank-sheets`, `job_runs` present
- [ ] No stale RUNNING jobs older than 1 hour

### 4. Application Health Checks

```bash
# Build CMS
cd apps/cms
pnpm install
pnpm build

# Verify build artifacts
ls -la .next/standalone
ls -la .next/static

# Test start (Ctrl+C after verification)
NODE_ENV=production pnpm start
```

- [ ] Build completes without errors
- [ ] `.next/standalone` directory exists
- [ ] Application starts successfully

### 5. Docker Deployment

```bash
cd /opt/docker-projects/payload-clusters/ranksheet

# Update environment in docker-compose.prod.yml or external secrets
# DO NOT store secrets in compose file

# Build image
docker-compose -f docker-compose.prod.yml build cms

# Deploy
docker-compose -f docker-compose.prod.yml up -d cms

# Verify
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs cms --tail=50
```

- [ ] Docker image builds successfully
- [ ] Container starts and stays running
- [ ] No error logs in startup

### 6. Endpoint Testing

```bash
# Test public API (no auth required)
curl -s https://cms.ranksheet.com/api/public/keywords | jq '.ok'
# Should return: true

# Test admin API (requires token + IP whitelist)
# FROM WHITELISTED IP ONLY
curl -X POST https://cms.ranksheet.com/api/admin/refresh/test-keyword \
  -H "x-job-token: <YOUR_JOB_TOKEN>" \
  -H "Content-Type: application/json"
# Should return: { "ok": true, "jobId": "..." }

# Test admin API from non-whitelisted IP
# FROM NON-WHITELISTED IP
curl -X POST https://cms.ranksheet.com/api/admin/refresh/test-keyword \
  -H "x-job-token: <YOUR_JOB_TOKEN>"
# Should return: 403 Forbidden

# Test debug endpoint (should be 404 in production)
curl -s https://cms.ranksheet.com/api/admin/debug/env \
  -H "x-job-token: <YOUR_JOB_TOKEN>"
# Should return: 404 Not Found
```

- [ ] Public API accessible
- [ ] Admin API requires valid token
- [ ] Admin API blocks non-whitelisted IPs
- [ ] Debug endpoints return 404

### 7. Cron Job Configuration

Update cron job to call refresh endpoint:

```bash
# Add to crontab (runs every 6 hours)
0 */6 * * * curl -X POST https://cms.ranksheet.com/api/admin/refresh-all \
  -H "x-job-token: <YOUR_JOB_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 3}' \
  >> /var/log/ranksheet-refresh.log 2>&1
```

- [ ] Cron job configured with new `JOB_TOKEN`
- [ ] Log file writable
- [ ] Test manual execution

### 8. Monitoring Setup

```bash
# Check advisory locks
SELECT objid, pid, granted FROM pg_locks WHERE locktype = 'advisory';

# Monitor job queue
SELECT status, COUNT(*) FROM ranksheet.job_runs GROUP BY status;

# Check for errors
SELECT id, job_name, status, detail FROM ranksheet.job_runs
WHERE status = 'FAILED'
ORDER BY queued_at DESC
LIMIT 10;
```

- [ ] Set up alerts for failed jobs
- [ ] Monitor advisory lock timeout warnings
- [ ] Track `cached_product_validation_failed` log entries
- [ ] Alert on `computed_metric_non_finite` errors

### 9. Rollback Plan

If issues occur:

```bash
# Immediate rollback
docker-compose -f docker-compose.prod.yml down cms
docker-compose -f docker-compose.prod.yml up -d cms-old

# Restore old credentials if needed
# (Keep old credentials in secure storage for 7 days)

# Check database state
psql -h supabase-db -U postgres -d postgres -c "\
  SELECT COUNT(*) FROM ranksheet.job_runs WHERE status='RUNNING'"

# Clean up stale jobs manually if needed
psql -h supabase-db -U postgres -d postgres -c "\
  UPDATE ranksheet.job_runs SET status='FAILED', finished_at=NOW() \
  WHERE status='RUNNING' AND started_at < NOW() - interval '1 hour'"
```

- [ ] Old Docker image tagged and saved
- [ ] Old credentials stored securely (encrypted)
- [ ] Rollback procedure tested in staging

### 10. Post-Deployment Verification

After 24 hours:

- [ ] No security incidents reported
- [ ] Job queue processing normally
- [ ] No advisory lock timeouts
- [ ] Refresh jobs completing successfully
- [ ] No NaN/Infinity errors in logs
- [ ] Cache validation failures < 0.1%
- [ ] Worker CPU usage < 20% when idle

### 11. Git History Cleanup (Optional but Recommended)

```bash
# Clean .env from Git history
cd /path/to/repo
git filter-repo --path apps/cms/.env --invert-paths

# Verify removal
git log --all --full-history -- apps/cms/.env
# Should be empty

# Force push (COORDINATE WITH TEAM FIRST)
git push origin --force --all
```

- [ ] Team notified of force push
- [ ] All developers re-clone repository
- [ ] CI/CD pipelines updated

## Emergency Contacts

- **DevOps**: [Contact Info]
- **Security**: [Contact Info]
- **Database Admin**: [Contact Info]

## Documentation References

- `SECURITY_ALERT.md` - Exposed credentials list
- `apps/cms/SECURITY.md` - Security best practices
- `apps/cms/CLAUDE.md` - Development guide
- `apps/cms/DEPLOYMENT.md` - Deployment procedures

---

**IMPORTANT**: Do not deploy until ALL items in sections 1-8 are checked.

**Last Updated**: 2024-12-18
