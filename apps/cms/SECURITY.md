# Security Guidelines

## Credential Management Best Practices

### 🚨 Critical Rules

1. **NEVER commit real credentials to Git**
   - All `.env` files containing secrets are ignored by `.gitignore`
   - Only `.env.example` with FAKE values should be committed

2. **Generate strong secrets**
   ```bash
   # Generate 32-byte base64 secrets
   openssl rand -base64 32
   ```

3. **Rotate credentials immediately if exposed**
   - If credentials are accidentally committed, they MUST be rotated immediately
   - See `SECURITY_ALERT.md` for exposed credential checklist

### Environment Variables

#### Required Secrets (Production)

| Variable | Purpose | Generation Method |
|----------|---------|-------------------|
| `PAYLOAD_SECRET` | Payload CMS auth token signing | `openssl rand -base64 32` |
| `JOB_TOKEN` | Admin API authentication | `openssl rand -base64 32` |
| `IP_HASH_SALT` | IP hashing for privacy | `openssl rand -base64 32` |
| `DATABASE_URI` | PostgreSQL connection string | From infrastructure team |
| `FASTAPI_KEY` | ABA data API key | From upstream API provider |
| `EXPRESS_API_KEY` | Product API key | From upstream API provider |

#### Security Configuration

| Variable | Default | Production Recommendation |
|----------|---------|---------------------------|
| `RS_STRICT_ENV` | `0` | **Set to `1`** (enables strict validation) |
| `ADMIN_IP_WHITELIST` | empty | **Set to your server IPs** (e.g., `1.2.3.4,5.6.7.8`) |
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` or `warn` |

### Admin Endpoint Protection

Admin endpoints (`/api/admin/*`) require:
1. Valid `x-job-token` header matching `JOB_TOKEN` env var
2. Source IP in `ADMIN_IP_WHITELIST` (if configured)

**Configuration:**
```env
# Restrict admin access to specific IPs
ADMIN_IP_WHITELIST=107.174.42.198,10.0.0.1
```

**Testing:**
```bash
# This should succeed from whitelisted IP
curl -X POST https://cms.ranksheet.com/api/admin/refresh/test-keyword \
  -H "x-job-token: YOUR_JOB_TOKEN"

# This should fail (403) from non-whitelisted IP
curl -X POST https://cms.ranksheet.com/api/admin/refresh/test-keyword \
  -H "x-job-token: YOUR_JOB_TOKEN" \
  --interface 192.168.1.100
```

### Debug Endpoint Protection

Debug endpoints (`/api/admin/debug/*`) are protected by:
1. Disabled in production (`NODE_ENV=production` returns 404)
2. IP whitelist check (same as admin endpoints)
3. Limited information exposure (only boolean values, no raw secrets)

### Production Deployment Checklist

Before deploying to production:

- [ ] All secrets generated using secure random generator
- [ ] No `.env` file committed to Git
- [ ] `RS_STRICT_ENV=1` enabled
- [ ] `ADMIN_IP_WHITELIST` configured with server IPs only
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` or `warn` (not `debug`)
- [ ] Database credentials use strong passwords (>= 32 chars)
- [ ] All upstream API keys are production keys (not test/dev)
- [ ] PostgreSQL schema isolation enabled (`?schema=ranksheet`)

### Credential Rotation Procedure

If credentials are exposed:

1. **Immediate actions:**
   - Remove `.env` from Git history (see below)
   - Rotate all exposed secrets
   - Update production environment variables
   - Restart CMS application

2. **Git history cleanup:**
   ```bash
   # Use git-filter-repo (recommended)
   git filter-repo --path apps/cms/.env --invert-paths

   # Or use BFG Repo-Cleaner
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive

   # Force push (coordinate with team first!)
   git push origin --force --all
   ```

3. **Verification:**
   ```bash
   # Verify .env is not in history
   git log --all --full-history -- apps/cms/.env
   # Should return empty
   ```

### Security Monitoring

Monitor the following:
- Failed admin API authentication attempts
- Requests from non-whitelisted IPs
- Database connection errors (possible credential issues)
- Unusual job queue activity

### Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** open a public GitHub issue
2. Email security contact (configure in project)
3. Include details: affected versions, reproduction steps, impact assessment

### Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Payload CMS Security Best Practices](https://payloadcms.com/docs/security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

**Last Updated:** 2024-12-18
**Security Review Required:** Every 90 days
