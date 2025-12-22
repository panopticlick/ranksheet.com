#!/bin/bash
# Security verification script for RankSheet Web
# Run this before committing to Git or pushing to GitHub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 Running security verification checks..."
echo ""

FAILED=0

# Check 1: Verify wrangler.jsonc is git-ignored
echo "✓ Checking wrangler.jsonc is git-ignored..."
if git check-ignore -q apps/web/wrangler.jsonc 2>/dev/null || [ ! -d .git ]; then
    echo -e "${GREEN}  ✓ wrangler.jsonc is properly ignored${NC}"
else
    echo -e "${RED}  ✗ wrangler.jsonc is NOT git-ignored - DANGEROUS!${NC}"
    FAILED=1
fi

# Check 2: Verify wrangler.jsonc.example exists
echo "✓ Checking wrangler.jsonc.example exists..."
if [ -f "apps/web/wrangler.jsonc.example" ]; then
    echo -e "${GREEN}  ✓ Template file exists${NC}"
else
    echo -e "${RED}  ✗ wrangler.jsonc.example is missing${NC}"
    FAILED=1
fi

# Check 3: Check for hardcoded account IDs in source code
echo "✓ Scanning for hardcoded account IDs in source code..."
if grep -r "201945e73bc3a4f6f77de30504c0687f" apps/web/src/ 2>/dev/null; then
    echo -e "${RED}  ✗ Found hardcoded account ID in source code!${NC}"
    FAILED=1
else
    echo -e "${GREEN}  ✓ No hardcoded account IDs found${NC}"
fi

# Check 4: Check for hardcoded API tokens in source code
echo "✓ Scanning for hardcoded API tokens in source code..."
if grep -r "KpKjVIekR6VrPUddt7Q05TurkfP-iEBxJ2swX1ps" apps/web/src/ 2>/dev/null; then
    echo -e "${RED}  ✗ Found hardcoded API token in source code!${NC}"
    FAILED=1
else
    echo -e "${GREEN}  ✓ No hardcoded API tokens found${NC}"
fi

# Check 5: Verify .env files are git-ignored
echo "✓ Checking .env files are git-ignored..."
if git check-ignore -q apps/web/.env apps/web/.env.local 2>/dev/null || [ ! -d .git ]; then
    echo -e "${GREEN}  ✓ .env files are properly ignored${NC}"
else
    echo -e "${YELLOW}  ⚠ Warning: .env files may not be properly ignored${NC}"
fi

# Check 6: Verify wrangler.jsonc.example doesn't contain real credentials
echo "✓ Checking template file for real credentials..."
if grep -q "201945e73bc3a4f6f77de30504c0687f" apps/web/wrangler.jsonc.example 2>/dev/null; then
    echo -e "${RED}  ✗ Template contains real account ID!${NC}"
    FAILED=1
else
    echo -e "${GREEN}  ✓ Template uses placeholder values${NC}"
fi

# Check 7: Verify .dev.vars is git-ignored
echo "✓ Checking .dev.vars is git-ignored..."
if git check-ignore -q apps/web/.dev.vars 2>/dev/null || [ ! -d .git ]; then
    echo -e "${GREEN}  ✓ .dev.vars is properly ignored${NC}"
else
    echo -e "${YELLOW}  ⚠ Warning: .dev.vars may not be properly ignored${NC}"
fi

# Check 8: List all tracked files that might contain secrets
echo "✓ Scanning tracked files for sensitive patterns..."
if [ -d .git ]; then
    SENSITIVE_FILES=$(git ls-files | grep -E '(wrangler\.jsonc|\.env|\.dev\.vars)$' | grep -v '\.example$' || true)
    if [ -n "$SENSITIVE_FILES" ]; then
        echo -e "${RED}  ✗ Found tracked sensitive files:${NC}"
        echo "$SENSITIVE_FILES" | sed 's/^/    /'
        FAILED=1
    else
        echo -e "${GREEN}  ✓ No sensitive files are tracked${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Not a git repository, skipping${NC}"
fi

# Summary
echo ""
echo "================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All security checks passed!${NC}"
    echo "Safe to commit and push to GitHub."
    exit 0
else
    echo -e "${RED}✗ Security checks FAILED!${NC}"
    echo "Please fix the issues above before committing."
    echo ""
    echo "Common fixes:"
    echo "  1. Ensure .gitignore includes wrangler.jsonc and .env files"
    echo "  2. Remove hardcoded credentials from source code"
    echo "  3. Use environment variables for all secrets"
    echo "  4. Run 'git rm --cached <file>' to untrack sensitive files"
    exit 1
fi
