# 🚀 GitHub Actions CI/CD 快速设置指南

5 分钟配置 RankSheet.com 自动化部署。

---

## ✅ 前置条件

- GitHub 仓库已创建（推荐：`affiliateberry/ranksheet.com`）
- Cloudflare 账户（已有 account_id 和 API token）
- VPS 服务器 SSH 访问权限

---

## 📋 步骤一：配置 GitHub Secrets

### 方法 A：使用 GitHub CLI（推荐）

```bash
# 1. 安装并登录 GitHub CLI
brew install gh  # macOS
gh auth login

# 2. 配置所有 Secrets（一次性）
cd /path/to/ranksheet.com

# Cloudflare Secrets
gh secret set CLOUDFLARE_ACCOUNT_ID -b "your-cloudflare-account-id"
gh secret set CLOUDFLARE_API_TOKEN -b "your-cloudflare-api-token"
gh secret set CMS_PUBLIC_URL -b "https://cms.ranksheet.com"
gh secret set SITE_URL -b "https://ranksheet.com"

# VPS Secrets
gh secret set VPS_SSH_HOST -b "107.174.42.198"
gh secret set VPS_SSH_USER -b "root"
gh secret set VPS_DEPLOY_PATH -b "/opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com"

# SSH 私钥（从文件读取）
gh secret set VPS_SSH_KEY < ~/.ssh/ranksheet_deploy
```

### 方法 B：使用 GitHub 网页

1. 访问：`https://github.com/affiliateberry/ranksheet.com/settings/secrets/actions`
2. 点击 **New repository secret**
3. 逐个添加以下 8 个 Secrets：

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | `your-cloudflare-account-id` |
| `CLOUDFLARE_API_TOKEN` | `your-cloudflare-api-token` |
| `CMS_PUBLIC_URL` | `https://cms.ranksheet.com` |
| `SITE_URL` | `https://ranksheet.com` |
| `VPS_SSH_HOST` | `107.174.42.198` |
| `VPS_SSH_USER` | `root` |
| `VPS_DEPLOY_PATH` | `/opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com` |
| `VPS_SSH_KEY` | 完整的 SSH 私钥内容 |

**SSH 私钥获取**：
```bash
# 如果已有 SSH 密钥
cat ~/.ssh/id_rsa  # 或 ~/.ssh/id_ed25519

# 如果需要生成新密钥
ssh-keygen -t ed25519 -C "github-actions@ranksheet.com" -f ~/.ssh/ranksheet_deploy
ssh-copy-id -i ~/.ssh/ranksheet_deploy.pub root@107.174.42.198
cat ~/.ssh/ranksheet_deploy  # 复制整个输出
```

---

## 📋 步骤二：验证安全配置

```bash
# 运行安全检查脚本
cd apps/web
bash scripts/verify-security.sh
```

预期输出：
```
✅ wrangler.jsonc is properly ignored
✅ wrangler.jsonc.example uses placeholders
✅ No hardcoded credentials in source code
✅ .env files are properly ignored
✅ Template files are safe
Security verification passed!
```

---

## 📋 步骤三：推送到 GitHub

```bash
# 初始化 Git（如果尚未初始化）
git init
git branch -M main

# 添加远程仓库
git remote add origin https://github.com/affiliateberry/ranksheet.com.git

# 提交并推送
git add .
git commit -m "Initial commit with CI/CD configuration"
git push -u origin main
```

---

## 📋 步骤四：验证自动部署

推送后，GitHub Actions 将自动触发部署：

1. 访问：`https://github.com/affiliateberry/ranksheet.com/actions`
2. 查看运行中的 workflows：
   - ✅ **CI** - 代码检查（lint, test, security audit）
   - ✅ **Deploy Web to Cloudflare** - 前端部署（如果 `apps/web` 有变更）
   - ✅ **Deploy CMS to VPS** - 后端部署（如果 `apps/cms` 有变更）

3. 等待部署完成（约 10-15 分钟）

4. 验证部署成功：
   ```bash
   # 检查前端
   curl -I https://ranksheet.com

   # 检查后端
   curl https://cms.ranksheet.com/api/public/keywords
   ```

---

## 🎯 手动触发部署

如果需要手动触发部署（不推送代码）：

1. 访问：`https://github.com/affiliateberry/ranksheet.com/actions`
2. 选择 workflow：`Deploy Web to Cloudflare` 或 `Deploy CMS to VPS`
3. 点击 **Run workflow**
4. 选择分支：`main`
5. 点击 **Run workflow** 确认

---

## 🔍 监控和日志

### GitHub Actions 日志

- **实时查看**: Actions 页面 → 选择 workflow run → 查看各个 step
- **下载日志**: workflow run 页面 → 右上角 ⋮ → Download log archive

### Cloudflare Pages

- Dashboard: https://dash.cloudflare.com
- Pages → ranksheet 项目 → Deployments
- 查看每次部署的状态、日志、预览链接

### VPS 后端

```bash
# SSH 到 VPS
ssh root@107.174.42.198

# 查看容器状态
cd /opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com/apps/cms
docker compose -f docker-compose.prod.yml ps

# 查看实时日志
docker logs ranksheet-cms -f --tail 100
```

---

## ⚠️ 常见问题

### 问题 1：前端部署失败 - 认证错误

```
Error: Authentication error
```

**解决方案**：
1. 验证 `CLOUDFLARE_API_TOKEN` 是否正确
2. 检查 Token 权限：必须包含 "Cloudflare Pages (Edit)"
3. 重新生成 Token 并更新 Secret

### 问题 2：后端部署失败 - SSH 连接拒绝

```
Permission denied (publickey)
```

**解决方案**：
1. 确认 `VPS_SSH_KEY` 包含**完整私钥**（包括 `-----BEGIN...` 和 `-----END...` 行）
2. 验证公钥在 VPS 上：`ssh root@107.174.42.198 "cat ~/.ssh/authorized_keys"`
3. 测试本地 SSH 连接：`ssh -i ~/.ssh/ranksheet_deploy root@107.174.42.198`

### 问题 3：构建失败 - 类型错误

```
Type check failed
```

**解决方案**：
1. 本地运行 `pnpm typecheck` 找到错误
2. 修复类型错误后重新推送
3. 确保 `@ranksheet/shared` 包已构建

---

## 📚 下一步

配置完成后，建议：

1. **设置分支保护规则**
   - Settings → Branches → Add rule
   - 要求 CI 通过才能合并

2. **启用部署通知**
   - 配置 Slack/Discord webhook
   - 或使用 GitHub Notifications

3. **配置域名 DNS**（如果尚未配置）
   - `ranksheet.com` → Cloudflare Pages CNAME
   - `cms.ranksheet.com` → `107.174.42.198` A 记录

4. **阅读完整文档**
   - [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - 完整部署文档
   - [GITHUB_SECRETS.md](GITHUB_SECRETS.md) - Secrets 详细说明

---

## ✅ 完成检查清单

- [ ] 8 个 GitHub Secrets 已配置
- [ ] 安全检查脚本通过
- [ ] 代码已推送到 GitHub
- [ ] GitHub Actions workflows 成功运行
- [ ] 前端可访问 (https://ranksheet.com)
- [ ] 后端 API 可访问 (https://cms.ranksheet.com)
- [ ] 容器在 VPS 上正常运行

恭喜！🎉 你的 CI/CD 管道已配置完成！

---

**需要帮助？** 查看 [GITHUB_SECRETS.md](GITHUB_SECRETS.md) 或提交 Issue。
