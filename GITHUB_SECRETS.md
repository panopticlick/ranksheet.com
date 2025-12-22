# GitHub Secrets 配置指南

本文档说明如何配置 RankSheet.com 项目所需的 GitHub Secrets，以实现自动化 CI/CD 部署。

## 概述

RankSheet.com 使用 GitHub Actions 实现自动化部署：
- **前端 (apps/web)** → Cloudflare Pages
- **后端 (apps/cms)** → VPS Docker (107.174.42.198)

所有敏感信息（API tokens, SSH keys, 环境变量）都通过 GitHub Secrets 安全存储。

---

## 前端部署所需的 Secrets

前端部署到 Cloudflare Pages，需要以下 Secrets：

### 1. `CLOUDFLARE_ACCOUNT_ID`

**用途**: Cloudflare 账户 ID
**获取方法**:
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择任意网站，URL 中的账户 ID 即为所需值
3. 或在右侧栏查看 "Account ID"

**示例值**: `your-cloudflare-account-id`

### 2. `CLOUDFLARE_API_TOKEN`

**用途**: Cloudflare API 访问令牌
**权限要求**:
- Account: Cloudflare Pages (Edit)
- Account: Account Settings (Read)

**获取方法**:
1. 访问 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 使用 "Edit Cloudflare Workers" 模板或自定义权限
4. 复制生成的 token（只显示一次）

**验证命令**:
```bash
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/tokens/verify" \
  -H "Authorization: Bearer <API_TOKEN>"
```

### 3. `CMS_PUBLIC_URL`

**用途**: CMS 后端 API 地址
**值**: `https://cms.ranksheet.com`

### 4. `SITE_URL`

**用途**: 前端网站地址
**值**: `https://ranksheet.com`

---

## 后端部署所需的 Secrets

后端部署到 VPS Docker，需要以下 Secrets：

### 1. `VPS_SSH_HOST`

**用途**: VPS 服务器 IP 地址
**值**: `107.174.42.198`

### 2. `VPS_SSH_USER`

**用途**: SSH 登录用户名
**值**: `root`

### 3. `VPS_SSH_KEY`

**用途**: SSH 私钥（用于无密码登录）
**格式**: PEM 格式的 RSA/ED25519 私钥

**生成方法**:

#### 方式一：生成新的 SSH 密钥对（推荐）

```bash
# 1. 在本地生成新的 SSH 密钥对
ssh-keygen -t ed25519 -C "github-actions@ranksheet.com" -f ~/.ssh/ranksheet_deploy
# 按提示设置（建议不设置密码短语）

# 2. 复制公钥到 VPS 服务器
ssh-copy-id -i ~/.ssh/ranksheet_deploy.pub root@107.174.42.198

# 3. 验证 SSH 连接
ssh -i ~/.ssh/ranksheet_deploy root@107.174.42.198 "echo 'Connection successful'"

# 4. 复制私钥内容（整个文件）
cat ~/.ssh/ranksheet_deploy
```

#### 方式二：使用现有的 SSH 私钥

如果已经有可用的 SSH 私钥：
```bash
cat ~/.ssh/id_rsa  # 或 ~/.ssh/id_ed25519
```

**重要提示**:
- ✅ 必须包含完整的私钥，包括 `-----BEGIN ... PRIVATE KEY-----` 和 `-----END ... PRIVATE KEY-----`
- ✅ 保留所有换行符
- ❌ 不要删除任何字符或空格

**私钥示例**:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...（多行）...
AAAEC+example+key+content+here==
-----END OPENSSH PRIVATE KEY-----
```

### 4. `VPS_DEPLOY_PATH`

**用途**: VPS 上的项目部署路径
**值**: `/opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com`

---

## 如何添加 GitHub Secrets

### 方法一：通过 GitHub 网页界面

1. 打开仓库页面：`https://github.com/affiliateberry/ranksheet.com`
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 输入 Secret 名称和值
5. 点击 **Add secret**

### 方法二：使用 GitHub CLI

```bash
# 安装 GitHub CLI (如果尚未安装)
brew install gh  # macOS
# 或访问 https://cli.github.com 下载

# 登录 GitHub
gh auth login

# 添加 Secrets
gh secret set CLOUDFLARE_ACCOUNT_ID -b "your-cloudflare-account-id"
gh secret set CLOUDFLARE_API_TOKEN -b "your-cloudflare-api-token"
gh secret set CMS_PUBLIC_URL -b "https://cms.ranksheet.com"
gh secret set SITE_URL -b "https://ranksheet.com"
gh secret set VPS_SSH_HOST -b "107.174.42.198"
gh secret set VPS_SSH_USER -b "root"
gh secret set VPS_DEPLOY_PATH -b "/opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com"

# SSH 私钥（从文件读取）
gh secret set VPS_SSH_KEY < ~/.ssh/ranksheet_deploy
```

---

## Secrets 清单

在配置完成后，请确保以下所有 Secrets 都已添加：

### 前端部署 (4 个)
- [ ] `CLOUDFLARE_ACCOUNT_ID`
- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CMS_PUBLIC_URL`
- [ ] `SITE_URL`

### 后端部署 (4 个)
- [ ] `VPS_SSH_HOST`
- [ ] `VPS_SSH_USER`
- [ ] `VPS_SSH_KEY`
- [ ] `VPS_DEPLOY_PATH`

**总计**: 8 个 Secrets

---

## 验证配置

### 1. 验证 Cloudflare Token

```bash
curl "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/tokens/verify" \
  -H "Authorization: Bearer YOUR_CLOUDFLARE_API_TOKEN"
```

预期响应：
```json
{
  "result": {
    "status": "active"
  },
  "success": true
}
```

### 2. 验证 SSH 连接

```bash
ssh -i ~/.ssh/ranksheet_deploy root@107.174.42.198 "echo 'SSH connection successful'"
```

预期输出：`SSH connection successful`

### 3. 触发测试部署

配置完所有 Secrets 后，推送代码到 `main` 分支或手动触发 workflow：

1. 访问 **Actions** 页面
2. 选择 `Deploy Web to Cloudflare` 或 `Deploy CMS to VPS`
3. 点击 **Run workflow**
4. 选择 `main` 分支
5. 点击 **Run workflow**

---

## 安全最佳实践

1. **定期轮换密钥**
   - 建议每 90 天更换一次 Cloudflare API Token
   - 定期更换 SSH 密钥

2. **最小权限原则**
   - Cloudflare Token 只授予必要的权限
   - SSH 用户仅用于部署，不执行其他操作

3. **监控使用情况**
   - 在 Cloudflare Dashboard 查看 API Token 使用记录
   - 在 VPS 上检查 SSH 登录日志：`journalctl -u sshd | grep github-actions`

4. **立即撤销泄露的密钥**
   - 如果密钥泄露，立即在 GitHub 和 Cloudflare/VPS 上撤销
   - 生成新密钥并更新 GitHub Secrets

5. **分离环境**
   - 生产环境和开发环境使用不同的 API Token
   - 考虑为 staging 分支创建单独的 Secrets

---

## 故障排查

### 问题：前端部署失败

**错误**: `Error: Authentication error`

**解决方案**:
1. 验证 `CLOUDFLARE_API_TOKEN` 是否正确
2. 检查 Token 权限是否包含 "Cloudflare Pages (Edit)"
3. 确认 `CLOUDFLARE_ACCOUNT_ID` 匹配

### 问题：后端部署 SSH 连接失败

**错误**: `Permission denied (publickey)`

**解决方案**:
1. 确认 `VPS_SSH_KEY` 包含完整的私钥（包括头尾行）
2. 验证公钥已添加到 VPS：`cat ~/.ssh/authorized_keys`
3. 检查 VPS 防火墙是否允许 GitHub Actions IP 访问

### 问题：环境变量未生效

**错误**: 构建成功但运行时缺少环境变量

**解决方案**:
- 前端：确认 `CMS_PUBLIC_URL` 和 `SITE_URL` 已设置
- 后端：检查 VPS 上的 `.env` 文件是否存在且完整

---

## 相关文档

- [apps/web/DEPLOYMENT.md](apps/web/DEPLOYMENT.md) - 前端部署详细指南
- [apps/web/SECURITY_CHECKLIST.md](apps/web/SECURITY_CHECKLIST.md) - 安全检查清单
- [.github/workflows/deploy-web.yml](.github/workflows/deploy-web.yml) - 前端 CI/CD workflow
- [.github/workflows/deploy-cms.yml](.github/workflows/deploy-cms.yml) - 后端 CI/CD workflow

---

## 支持

如有问题，请：
1. 检查 GitHub Actions 日志：**Actions** → 选择失败的 workflow → 查看详细日志
2. 查阅故障排查部分
3. 提交 Issue：https://github.com/affiliateberry/ranksheet.com/issues

---

**最后更新**: 2024-12-22
**维护者**: affiliateberry
