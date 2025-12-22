# RankSheet.com 运维快速参考

## 监控端点

```bash
# 基础健康检查
curl https://cms.ranksheet.com/api/healthz

# 深度检查 (含上游APIs)
curl https://cms.ranksheet.com/api/healthz?deep=1

# 就绪探针
curl https://cms.ranksheet.com/api/readyz
```

## 日志查看

```bash
# 实时日志
docker logs -f ranksheet-cms

# 格式化输出
docker logs ranksheet-cms | pnpm dlx pino-pretty

# 查找错误
docker logs ranksheet-cms | grep '"level":50'  # error
docker logs ranksheet-cms | grep '"level":60'  # fatal

# 按请求ID追踪
docker logs ranksheet-cms | grep 'requestId":"<uuid>"'
```

## Redis 监控

```bash
# 使用监控脚本
cd apps/cms
./scripts/monitor/redis-stats.sh

# 手动检查
docker exec -it ranksheet-cms-redis redis-cli INFO
docker exec -it ranksheet-cms-redis redis-cli INFO memory
docker exec -it ranksheet-cms-redis redis-cli INFO stats

# 缓存命中率
docker exec -it ranksheet-cms-redis redis-cli INFO stats | grep keyspace
```

## 测试和构建

```bash
# 单元测试
pnpm test                    # 所有测试
cd apps/cms && pnpm test     # CMS测试
pnpm test --coverage         # 带覆盖率

# 类型检查
pnpm typecheck

# Lint
pnpm lint

# 构建
pnpm build
```

## Docker 操作

```bash
# 开发环境
cd apps/cms
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml down

# 生产环境 (VPS)
cd apps/cms
make deploy    # 部署
make down      # 停止
make logs      # 查看日志
```

## 常见问题排查

### 1. 健康检查失败

```bash
# 检查数据库连接
docker exec ranksheet-cms node -e "const pg=require('pg');const pool=new pg.Pool({connectionString:process.env.DATABASE_URI});pool.query('SELECT 1').then(()=>console.log('OK')).catch(e=>console.error(e))"

# 检查Redis
docker exec ranksheet-cms-redis redis-cli ping

# 查看详细错误
curl https://cms.ranksheet.com/api/healthz?deep=1 | jq '.errors'
```

### 2. 高内存使用

```bash
# 检查Redis内存
docker exec ranksheet-cms-redis redis-cli INFO memory | grep used_memory_human

# 检查Node.js内存
docker stats ranksheet-cms

# 重启服务 (如需要)
docker restart ranksheet-cms
```

### 3. 上游API超时

```bash
# 测试FastAPI
curl -w "\nTime: %{time_total}s\n" https://fastapi.amzapi.io/health

# 测试Express
curl -w "\nTime: %{time_total}s\n" https://express.amzapi.io/health

# 检查深度健康检查
curl https://cms.ranksheet.com/api/healthz?deep=1 | jq '.checks'
```

## 环境变量验证

```bash
# 进入容器检查
docker exec ranksheet-cms env | grep -E "DATABASE_URI|REDIS_URL|SENTRY_DSN"

# 检查配置文件
docker exec ranksheet-cms cat /app/apps/cms/.env
```

## 性能基准

| 指标 | 正常范围 | 告警阈值 |
|------|----------|----------|
| 健康检查延迟 | <100ms | >500ms |
| 深度检查延迟 | <300ms | >1000ms |
| Redis 内存使用 | <80% | >90% |
| 缓存命中率 | >80% | <50% |
| 测试执行时间 | <200ms | >1000ms |

## 安全检查

```bash
# 验证HSTS
curl -I https://ranksheet.com | grep Strict-Transport-Security

# 验证CSP
curl -I https://ranksheet.com | grep Content-Security-Policy

# 验证CORS
curl -H "Origin: https://ranksheet.com" https://cms.ranksheet.com/api/public/keywords -I

# 依赖审计
pnpm audit --audit-level=high
```

## 备份和恢复

```bash
# Redis 数据备份
docker cp ranksheet-cms-redis:/data/appendonly.aof ./backup/redis-$(date +%Y%m%d).aof

# PostgreSQL 备份 (通过Supabase)
# 使用Supabase Studio或CLI

# 恢复Redis
docker cp ./backup/redis-20241218.aof ranksheet-cms-redis:/data/appendonly.aof
docker restart ranksheet-cms-redis
```

## 联系信息

- **文档**: `/INFRASTRUCTURE_REPORT.md`
- **项目配置**: `/CLAUDE.md`
- **测试**: `apps/cms/src/lib/ranksheet/__tests__/`
- **监控脚本**: `apps/cms/scripts/monitor/`

---

**生成日期**: 2025-12-18
**版本**: Phase 4-6 完成
