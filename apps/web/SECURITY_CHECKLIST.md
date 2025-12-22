# Security Checklist for GitHub Publication

This checklist ensures sensitive information is not committed to the public repository.

## Pre-commit Security Checks

### 1. Configuration Files

- [ ] `wrangler.jsonc` is git-ignored (contains account_id)
- [ ] `wrangler.jsonc.example` uses placeholder values only
- [ ] `.env` and `.env.local` are git-ignored
- [ ] `.dev.vars` is git-ignored (Cloudflare local development secrets)

### 2. Credentials Audit

Search for potential secrets in code:

```bash
# Check for hardcoded account IDs
grep -r "201945e73bc3a4f6f77de30504c0687f" apps/web/

# Check for hardcoded API tokens
grep -r "KpKjVIekR6VrPUddt7Q05TurkfP-iEBxJ2swX1ps" apps/web/

# Check for common secret patterns
grep -rE "(api[_-]?key|api[_-]?token|secret|password)" apps/web/src/ --include="*.ts" --include="*.tsx"
```

### 3. Environment Variables

Verify all sensitive values are loaded from environment, not hardcoded:

```bash
# Should find NO hardcoded values in source code
grep -r "CLOUDFLARE_ACCOUNT_ID" apps/web/src/
grep -r "CLOUDFLARE_API_TOKEN" apps/web/src/
```

### 4. Git History Check

Before first push, ensure no secrets were ever committed:

```bash
# Search entire git history for account ID
git log -p -S "201945e73bc3a4f6f77de30504c0687f"

# Search entire git history for API token
git log -p -S "KpKjVIekR6VrPUddt7Q05TurkfP-iEBxJ2swX1ps"
```

If secrets are found in history, use `git filter-branch` or BFG Repo-Cleaner before pushing.

## Files That Should NEVER Be Committed

```
apps/web/wrangler.jsonc         # Contains account_id
apps/web/.dev.vars              # Local development secrets
apps/web/.env                   # Environment variables
apps/web/.env.local             # Local overrides
apps/web/.env.production.local  # Production secrets
apps/web/.wrangler/             # Wrangler cache
apps/web/.open-next/            # Build output (may contain env vars)
```

## Files That SHOULD Be Committed

```
apps/web/wrangler.jsonc.example  # Template with placeholders
apps/web/.env.example            # Template with placeholders
apps/web/DEPLOYMENT.md           # Deployment instructions
apps/web/SECURITY_CHECKLIST.md   # This file
```

## CI/CD Security

If using GitHub Actions or other CI/CD:

1. Store secrets in repository secrets (Settings > Secrets and variables > Actions)
2. Use environment variables in workflow:
   ```yaml
   env:
     CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
     CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
   ```
3. Never log secrets in CI output
4. Use `::add-mask::` to hide values in GitHub Actions logs

## Emergency: Secret Leaked

If a secret is accidentally committed:

1. **Immediately revoke** the leaked credential in Cloudflare Dashboard
2. Generate new API token/account access
3. Remove from git history:
   ```bash
   # Using BFG Repo-Cleaner (recommended)
   bfg --replace-text secrets.txt

   # Or using git filter-branch
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch apps/web/wrangler.jsonc' \
     --prune-empty --tag-name-filter cat -- --all
   ```
4. Force push (if not yet public): `git push origin --force --all`
5. Update all team members to pull the cleaned history

## Regular Security Audits

Run these checks periodically:

```bash
# Check .gitignore is working
git status --ignored

# List all tracked files (verify no secrets)
git ls-files

# Check for accidentally staged files
git diff --cached --name-only
```

## Contact

If you discover a security issue, contact: security@ranksheet.com
