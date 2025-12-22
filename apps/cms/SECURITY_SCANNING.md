# Security Scanning Guide

This document explains how to use the integrated security scanning tools (Hadolint and Trivy) for the RankSheet CMS application.

## Overview

The CMS includes two security scanning tools:

1. **Hadolint** - Dockerfile linter that checks for best practices and common mistakes
2. **Trivy** - Comprehensive vulnerability scanner for containers, filesystems, and dependencies

## Prerequisites

### Install Hadolint

```bash
# macOS (Homebrew)
brew install hadolint

# Linux (download binary)
wget -qO /usr/local/bin/hadolint https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64
chmod +x /usr/local/bin/hadolint

# Docker (no installation required)
docker pull hadolint/hadolint
```

### Install Trivy

```bash
# macOS (Homebrew)
brew install trivy

# Linux (Ubuntu/Debian)
sudo apt-get install wget apt-transport-https gnupg lsb-release
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy

# Docker (no installation required)
docker pull aquasec/trivy
```

## Usage

### Quick Start (Recommended)

Run all security scans before deployment:

```bash
cd apps/cms
make security-scan
```

This runs:
- Hadolint (Dockerfile linting)
- Trivy filesystem scan (dependencies, secrets, misconfigurations)

### Individual Scans

#### Hadolint (Dockerfile Linting)

```bash
# Using Makefile
make hadolint

# Direct command
hadolint --config .hadolint.yaml Dockerfile

# Using Docker
docker run --rm -i hadolint/hadolint < Dockerfile
```

**What it checks:**
- Dockerfile best practices
- Security vulnerabilities in Dockerfile instructions
- Optimization opportunities
- Common mistakes (missing --no-cache, untagged images, etc.)

**Configuration:** `.hadolint.yaml`

#### Trivy Filesystem Scan

```bash
# Using Makefile
make trivy-fs

# Direct command
trivy fs --config trivy.yaml --scanners vuln,secret,misconfig .

# Scan specific directory
trivy fs --config trivy.yaml src/

# Output as JSON
trivy fs --config trivy.yaml --format json --output report.json .
```

**What it scans:**
- NPM dependencies (package.json, pnpm-lock.yaml)
- Known vulnerabilities (CVEs)
- Exposed secrets (API keys, passwords in code)
- Infrastructure misconfigurations

**Configuration:** `trivy.yaml`

#### Trivy Image Scan

```bash
# Using Makefile (builds image first)
make trivy-image

# Direct command (requires image to be built first)
docker compose -f docker-compose.prod.yml build cms
trivy image --config trivy.yaml ranksheet-cms

# Scan with detailed output
trivy image --config trivy.yaml --format json --output image-report.json ranksheet-cms
```

**What it scans:**
- OS packages (Debian bookworm-slim)
- Node.js runtime vulnerabilities
- Installed npm packages
- Image layer analysis

## Configuration Files

### `.hadolint.yaml`

Controls Dockerfile linting behavior:

```yaml
ignored:
  - DL3008  # Pin versions in apt-get (not applicable)

trustedRegistries:
  - docker.io

failure-threshold: warning
```

**Customize:**
- Add rules to `ignored` to suppress false positives
- Change `failure-threshold` to `error` for stricter checks

### `trivy.yaml`

Controls Trivy scanning behavior:

```yaml
scan:
  severity:
    - CRITICAL
    - HIGH
    - MEDIUM

vulnerability:
  ignore-unfixed: false  # Report even if no fix available

exit-code: 1  # Fail on vulnerabilities
```

**Customize:**
- Adjust `severity` levels (add/remove LOW, UNKNOWN)
- Set `ignore-unfixed: true` to ignore unfixed vulnerabilities
- Change `exit-code: 0` to allow vulnerabilities without failing

### `.trivyignore`

Suppress specific CVEs that are:
- False positives
- Not applicable to your use case
- Awaiting upstream fixes

```
# Example:
CVE-2024-12345  # False positive in test dependencies
CVE-2024-67890  # Waiting for Node.js 20.x LTS patch
```

**Important:** Document why each CVE is ignored and review regularly!

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  hadolint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Hadolint
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: apps/cms/Dockerfile
          config: apps/cms/.hadolint.yaml
          failure-threshold: warning

  trivy-fs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'apps/cms'
          trivy-config: apps/cms/trivy.yaml
          format: 'sarif'
          output: 'trivy-fs-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-fs-results.sarif'

  trivy-image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          cd apps/cms
          docker compose -f docker-compose.prod.yml build cms

      - name: Run Trivy image scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'ranksheet-cms:latest'
          trivy-config: apps/cms/trivy.yaml
          format: 'sarif'
          output: 'trivy-image-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-image-results.sarif'
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
security-scan:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --no-cache curl make
    - curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    - wget -qO /usr/local/bin/hadolint https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64
    - chmod +x /usr/local/bin/hadolint
  script:
    - cd apps/cms
    - make security-scan
  artifacts:
    reports:
      container_scanning: trivy-report.json
```

## Pre-Deployment Checklist

Before deploying to production:

- [ ] Run `make security-scan` and fix all CRITICAL/HIGH issues
- [ ] Run `make trivy-image` after building production image
- [ ] Review `.trivyignore` - ensure all ignored CVEs are documented
- [ ] Check for exposed secrets (API keys, tokens)
- [ ] Verify Dockerfile follows best practices
- [ ] Update base image to latest security patch (node:20-bookworm-slim)
- [ ] Review dependency vulnerabilities in `pnpm-lock.yaml`

## Interpreting Results

### Hadolint Severity Levels

- **ERROR** - Must fix (breaks best practices or security)
- **WARNING** - Should fix (optimization or minor issue)
- **INFO** - Nice to fix (suggestions)

### Trivy Severity Levels

- **CRITICAL** - Immediate fix required (actively exploited vulnerabilities)
- **HIGH** - Fix before production deployment
- **MEDIUM** - Fix in next release
- **LOW** - Fix when convenient
- **UNKNOWN** - Needs manual review

### Exit Codes

- `0` - No issues found or only LOW severity
- `1` - Issues found matching severity threshold

## Common Issues and Fixes

### Issue: `DL3006: Always tag the version of an image explicitly`

**Fix:** Change `FROM node:20-bookworm-slim` to `FROM node:20.11.0-bookworm-slim`

### Issue: `CVE-XXXX in package Y`

**Fix:**
1. Check if fixed version available: `pnpm update Y`
2. If no fix, add to `.trivyignore` with justification
3. Monitor for patches

### Issue: Exposed secrets detected

**Fix:**
1. Remove hardcoded secrets from code
2. Use environment variables
3. Rotate compromised credentials immediately
4. Add pattern to `.gitignore`

### Issue: High vulnerability in base image

**Fix:**
1. Check for updated base image: `docker pull node:20-bookworm-slim`
2. Rebuild with latest tag
3. If no fix, consider alternative base image

## Monitoring and Alerting

### Automated Scanning Schedule

Recommendation: Scan at least weekly or on every deployment

```bash
# Add to crontab (weekly scan)
0 2 * * 0 cd /opt/docker-projects/payload-clusters/ranksheet/apps/cms && make security-scan > /var/log/ranksheet-security-scan.log 2>&1
```

### Slack/Discord Notifications

Integrate with CI/CD to send alerts on vulnerability detection:

```bash
#!/bin/bash
# scan-and-notify.sh

cd apps/cms
if ! make security-scan; then
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d '{"text":"🚨 Security scan failed for RankSheet CMS - check logs"}'
fi
```

## Resources

- [Hadolint Documentation](https://github.com/hadolint/hadolint)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CVE Database](https://cve.mitre.org/)

## Support

For issues or questions about security scanning:
1. Check this documentation first
2. Review tool documentation (Hadolint, Trivy)
3. Search GitHub issues for known problems
4. Open issue in project repository
