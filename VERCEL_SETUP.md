# Vercel 部署配置指南

## ✅ 已完成
- 创建 Vercel 配置文件 (`apps/web/vercel.json`)
- 添加 GitHub Actions 自动部署工作流
- 移除 Cloudflare 相关依赖和配置
- 代码已推送到 GitHub

## 📋 需要配置的步骤

### 1. 登录 Vercel 并创建项目

访问 https://vercel.com/ 并登录（建议使用 GitHub 登录）

### 2. 导入 GitHub 仓库

1. 点击 "Add New..." → "Project"
2. 选择 `panopticlick/ranksheet.com` 仓库
3. 点击 "Import"

### 3. 配置项目设置

在项目配置页面：

**Framework Preset**: Next.js

**Root Directory**: `apps/web` (点击 "Edit" 修改)

**Build Command**: 保持默认或留空（使用 vercel.json 中的配置）

**Output Directory**: 保持默认 (`.next`)

**Install Command**: 保持默认或留空（使用 vercel.json 中的配置）

### 4. 配置环境变量

在 "Environment Variables" 部分添加以下变量：

#### Production 环境变量：
```
SITE_URL=https://ranksheet.com
CMS_PUBLIC_URL=https://cms.ranksheet.com
NODE_ENV=production
```

可选变量：
```
AMAZON_ASSOCIATE_TAG=你的亚马逊联盟标签
```

### 5. 部署

点击 "Deploy" 开始第一次部署

### 6. 配置自定义域名

部署成功后：

1. 进入项目的 Settings → Domains
2. 添加域名 `ranksheet.com` 和 `www.ranksheet.com`
3. 按照 Vercel 的提示配置 DNS：
   - A 记录：`@` → `76.76.21.21`
   - CNAME 记录：`www` → `cname.vercel-dns.com`

### 7. 获取 Vercel Token（用于 GitHub Actions）

1. 访问 https://vercel.com/account/tokens
2. 点击 "Create Token"
3. 名称：`GitHub Actions - RankSheet`
4. Scope: `Full Account`
5. 复制生成的 token

### 8. 配置 GitHub Secrets

访问 https://github.com/panopticlick/ranksheet.com/settings/secrets/actions

添加以下 Secret：

#### VERCEL_TOKEN
值：第7步复制的 token

#### VERCEL_ORG_ID
1. 在 Vercel 项目页面，进入 Settings → General
2. 复制 "Team ID" 或 "Personal Account ID"
3. 粘贴到 GitHub Secret

#### VERCEL_PROJECT_ID
1. 在同一页面复制 "Project ID"
2. 粘贴到 GitHub Secret

### 9. 更新现有 Secrets

确保以下 GitHub Secrets 已配置：
- ✅ SITE_URL (应该是 https://ranksheet.com)
- ✅ CMS_PUBLIC_URL (应该是 https://cms.ranksheet.com)

### 10. 触发自动部署

推送代码到 main 分支或手动触发工作流：
```bash
# 手动触发
gh workflow run "Deploy Web to Vercel" --ref main
```

## 🎯 验证部署

部署完成后访问：
- 生产环境：https://ranksheet.com
- Vercel 预览链接：在部署日志中可见

## 🔧 故障排查

### 构建失败
- 检查 Vercel 部署日志
- 确认 `apps/web` 作为 Root Directory
- 确认环境变量配置正确

### GitHub Actions 失败
- 检查 VERCEL_TOKEN、VERCEL_ORG_ID、VERCEL_PROJECT_ID 是否正确
- 确认 Vercel CLI 有权限访问项目

### 域名配置
- DNS 更改可能需要 24-48 小时生效
- 使用 `dig ranksheet.com` 检查 DNS 记录

## 📚 相关文档

- Vercel 文档：https://vercel.com/docs
- Next.js 部署：https://nextjs.org/docs/deployment
- GitHub Actions：https://docs.github.com/en/actions

## 🚀 后续优化

部署成功后可以考虑：
- 配置 Vercel Analytics
- 设置 Edge Functions (如果需要)
- 配置 Preview Deployments
- 启用 Vercel Speed Insights
