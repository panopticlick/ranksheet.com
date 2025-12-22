# Security Scanning - Quick Reference

## Installation (One-Time Setup)

```bash
# macOS
brew install hadolint trivy

# Linux
wget -qO /usr/local/bin/hadolint https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64
chmod +x /usr/local/bin/hadolint
# Trivy: See https://aquasecurity.github.io/trivy/latest/getting-started/installation/
```

## Daily Commands

```bash
cd apps/cms

# Before any code commit
make security-scan

# Before deployment
make security-scan
make trivy-image  # Only if Docker image needs scanning
```

## Configuration Files

| File | Purpose |
|------|---------|
| `.hadolint.yaml` | Dockerfile linting rules |
| `trivy.yaml` | Vulnerability scan settings |
| `.trivyignore` | Suppress specific CVEs (document why!) |
| `Makefile` | Security scan commands |

## CI/CD

GitHub Actions automatically runs security scans:
- On every push to `main`
- On every pull request
- Weekly (Sunday 00:00 UTC)

See `.github/workflows/docker-security.yml`

## Severity Priority

1. **CRITICAL** → Fix immediately (production blocker)
2. **HIGH** → Fix before merge
3. **MEDIUM** → Fix in current sprint
4. **LOW** → Fix when convenient

## Common Commands

```bash
# Run all pre-deployment checks
make security-scan

# Scan Dockerfile only
make hadolint

# Scan dependencies/secrets/configs
make trivy-fs

# Scan built Docker image
make trivy-image

# Validate docker-compose config
make validate
```

## Ignoring Vulnerabilities

Only ignore CVEs when:
- ✅ False positive (doesn't affect our code)
- ✅ No fix available (awaiting upstream patch)
- ✅ Not exploitable in our environment

Add to `.trivyignore`:
```
CVE-2024-12345  # Justification required here
```

**Never ignore without documentation!**

## Emergency Response

If a CRITICAL vulnerability is found in production:

1. **Assess impact** - Is our application affected?
2. **Check for fix** - Is a patched version available?
3. **Update dependencies** - `pnpm update <package>`
4. **Rebuild image** - `make deploy`
5. **Re-scan** - `make security-scan && make trivy-image`
6. **Deploy** - Push to production

## Documentation

Full details: See `SECURITY_SCANNING.md`

## Support Contacts

- Security team: [security@yourcompany.com]
- DevOps: [devops@yourcompany.com]
- On-call: [See PagerDuty rotation]
