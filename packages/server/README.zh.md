<h1 align="center">ucli server</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ucli/server"><img src="https://img.shields.io/npm/v/@ucli/server?color=7c3aed" alt="npm version"/></a>
  <img src="https://img.shields.io/badge/NestJS-v11-e0234e" alt="NestJS"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
</p>

<p align="center">
  <a href="./README.md">English</a> | 中文
</p>

---

## 概述

`@ucli/server` 是 ucli 的服务端组件，提供：

- **加密 OAS 存储** — OpenAPI 规范及认证配置以 AES-256-GCM 静态加密
- **群组级 JWT 签发** — RS256 签名令牌，控制客户端可访问的规范范围
- **令牌吊销** — 基于 JTI 的缓存黑名单机制
- **可插拔后端** — 通过环境变量切换存储（memory / PostgreSQL / MySQL）和缓存（memory / Redis）
- **可观测性** — Pino 结构化 JSON 日志、Prometheus 指标、健康/就绪探针
- **分布式追踪** — OpenTelemetry 自动埋点（HTTP、Express、PG、Redis），默认开启

## 架构图

```mermaid
graph TB
    subgraph AppModule["AppModule（应用模块）"]
        direction TB
        Config["ConfigModule\n（Joi 校验环境变量）"]
        Auth["AuthModule\nAdminGuard · GroupTokenGuard"]
        Crypto["CryptoModule\nJwtService (RS256)\nEncryptionService (AES-256-GCM)"]

        subgraph Storage["StorageModule.forRoot()（存储模块）"]
            Mem1["MemoryGroupRepo\nMemoryTokenRepo\nMemoryOASRepo"]
            DB1["TypeORM 仓库\n(postgres · mysql)"]
        end

        subgraph Cache["CacheModule.forRoot()（缓存模块）"]
            Mem2["MemoryCacheAdapter"]
            Redis["RedisCacheAdapter\n(ioredis)"]
        end

        Groups["GroupsModule\nPOST/GET /admin/groups"]
        Tokens["TokensModule\n令牌签发 + 吊销"]
        OAS["OASModule\n管理端 CRUD + 客户端读取"]
        Health["HealthModule\n存活 · 就绪探针"]
        Metrics["MetricsModule\nPrometheus 指标"]
    end

    Config --> Auth
    Config --> Storage
    Config --> Cache
    Crypto --> Tokens
    Crypto --> OAS
    Storage --> Groups
    Storage --> Tokens
    Storage --> OAS
    Cache --> Auth
    Groups --> Tokens
    Groups --> OAS
```

## 安装

```bash
npm install -g @ucli/server
# 或
pnpm add -g @ucli/server
```

## 快速开始（内存模式，无需 DB/Redis）

```bash
# 1. 生成 32 字节加密密钥
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. 启动服务器
ADMIN_SECRET=my-secret ENCRYPTION_KEY=$ENCRYPTION_KEY ucli-server

# 服务启动于 http://localhost:3000
# Swagger UI: http://localhost:3000/api/docs
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `ADMIN_SECRET` | **是** | — | `X-Admin-Secret` 请求头的值（≥ 8 字符） |
| `ENCRYPTION_KEY` | **是** | — | 64 位十六进制（32 字节），用于 AES-256-GCM |
| `PORT` | 否 | `3000` | HTTP 监听端口 |
| `HOST` | 否 | `0.0.0.0` | HTTP 监听主机 |
| `DB_TYPE` | 否 | `memory` | `memory` \| `postgres` \| `mysql` |
| `DATABASE_URL` | 使用 DB 时 | — | 数据库连接 URL |
| `CACHE_TYPE` | 否 | `memory` | `memory` \| `redis` |
| `REDIS_URL` | 使用 redis 时 | — | Redis 连接 URL |
| `JWT_PRIVATE_KEY` | 生产环境 | 自动生成 | Base64 编码的 PKCS8 PEM |
| `JWT_PUBLIC_KEY` | 生产环境 | 自动生成 | Base64 编码的 SPKI PEM |
| `JWT_DEFAULT_TTL` | 否 | `86400` | 令牌有效期（秒），`0` 表示永不过期 |
| `LOG_LEVEL` | 否 | `info` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `SWAGGER_ENABLED` | 否 | `true` | 设为 `false` 可在生产环境关闭 `/api/docs` |

## 存储后端

| `DB_TYPE` | 驱动 | 说明 |
|-----------|------|------|
| `memory` | — | 默认。无持久化，重启后数据丢失。 |
| `postgres` | `pg` | PostgreSQL 12+ |
| `mysql` | `mysql2` | MySQL 5.7+ / MariaDB 10.3+ |

首次运行时自动建表。

```bash
# PostgreSQL
DB_TYPE=postgres \
DATABASE_URL=postgresql://user:pass@host:5432/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> ucli-server

# MySQL
DB_TYPE=mysql \
DATABASE_URL=mysql://user:pass@host:3306/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> ucli-server
```

## 缓存后端

| `CACHE_TYPE` | 说明 |
|--------------|------|
| `memory` | 默认。进程内 TTL 缓存，重启后失效。 |
| `redis` | Redis 6+（ioredis），支持多实例共享。 |

```bash
CACHE_TYPE=redis REDIS_URL=redis://:password@host:6379 \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> ucli-server
```

## 生产部署

生成持久化 RS256 密钥对，使令牌在重启后仍然有效：

```bash
node -e "
const { generateKeyPairSync } = require('crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
console.log('JWT_PRIVATE_KEY=' + Buffer.from(privateKey.export({ type:'pkcs8', format:'pem' })).toString('base64'));
console.log('JWT_PUBLIC_KEY=' + Buffer.from(publicKey.export({ type:'spki', format:'pem' })).toString('base64'));
"
```

使用仓库根目录的 `docker-compose.yml` 启动 PostgreSQL + Redis：

```bash
docker-compose up -d
DB_TYPE=postgres CACHE_TYPE=redis \
DATABASE_URL=postgresql://oas_gateway:changeme@localhost:5432/oas_gateway \
REDIS_URL=redis://:changeme@localhost:6379 \
JWT_PRIVATE_KEY=<base64-pem> JWT_PUBLIC_KEY=<base64-pem> \
ADMIN_SECRET=<强密码> ENCRYPTION_KEY=<64位hex> \
ucli-server
```

## 管理 API 参考

所有管理端点均需要 `X-Admin-Secret: <ADMIN_SECRET>` 请求头。

### 群组管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/admin/groups` | 创建群组 |
| `GET` | `/admin/groups` | 列出所有群组 |

```bash
# 创建群组
curl -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"production","description":"生产环境智能体群组"}'
# → { "id": "uuid", "name": "production", "description": "..." }

# 列出群组
curl http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret"
```

### 令牌管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/admin/groups/:id/tokens` | 为群组签发 JWT |
| `DELETE` | `/admin/tokens/:id` | 吊销令牌 |

```bash
# 签发令牌（返回的 JWT 仅显示一次，请妥善保存！）
curl -X POST http://localhost:3000/admin/groups/<group-id>/tokens \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-token","ttlSec":86400}'
# → { "id": "jti-uuid", "token": "eyJ..." }

# 吊销令牌
curl -X DELETE http://localhost:3000/admin/tokens/<jti-uuid> \
  -H "X-Admin-Secret: my-secret"
```

### OAS 条目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/admin/oas` | 注册 OAS 条目 |
| `GET` | `/admin/oas` | 列出所有 OAS 条目 |
| `PUT` | `/admin/oas/:id` | 更新 OAS 条目 |
| `DELETE` | `/admin/oas/:id` | 删除 OAS 条目 |

```bash
# 注册 OAS 条目
curl -X POST http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "<group-id>",
    "name": "payments",
    "remoteUrl": "https://api.example.com/openapi.json",
    "authType": "bearer",
    "authConfig": {"type":"bearer","token":"<api-token>"},
    "cacheTtl": 3600
  }'

# 列出所有条目
curl http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret"

# 更新条目
curl -X PUT http://localhost:3000/admin/oas/<oas-id> \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"cacheTtl": 7200}'

# 删除条目
curl -X DELETE http://localhost:3000/admin/oas/<oas-id> \
  -H "X-Admin-Secret: my-secret"
```

## 客户端 API 参考

客户端端点需要 `Authorization: Bearer <group-jwt>`。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/oas` | 列出当前令牌群组可访问的 OAS 条目 |
| `GET` | `/api/v1/oas/:name` | 获取单个 OAS 条目（含解密认证信息） |

## 认证类型

| `authType` | `authConfig` 结构 |
|------------|------------------|
| `none` | `{ "type": "none" }` |
| `bearer` | `{ "type": "bearer", "token": "..." }` |
| `api_key` | `{ "type": "api_key", "key": "...", "in": "header\|query", "name": "X-API-Key" }` |
| `basic` | `{ "type": "basic", "username": "...", "password": "..." }` |
| `oauth2_cc` | `{ "type": "oauth2_cc", "tokenUrl": "...", "clientId": "...", "clientSecret": "...", "scopes": [] }` |

认证配置在存储前以 AES-256-GCM 加密，仅在请求处理时在内存中解密。

## OpenTelemetry 分布式追踪

分布式追踪**默认开启**。OTEL SDK 自动埋点 HTTP、Express、PostgreSQL 和 Redis，无需修改任何业务代码。

### 与 Prometheus 的关系（不冲突）

| 关注点 | 技术 | 方式 |
|--------|------|------|
| 指标采集（Scrape） | `prom-client` | `GET /metrics` 被动拉取 |
| 分布式追踪（Trace） | OpenTelemetry | OTLP 主动推送到采集器 |

两者完全独立，互不干扰。Prometheus 照常抓取 `/metrics`；OTEL 将 Span 推送到你的追踪后端。

### OTEL 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OTEL_ENABLED` | `true` | 设为 `false` 完全禁用 |
| `OTEL_SERVICE_NAME` | `ucli-server` | 所有 Span 上的服务名标签 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | 采集器 URL（如 `http://otel-collector:4318`）。不填则本地丢弃（no-op） |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | 采集器认证头（如 `Authorization=Bearer token`） |
| `OTEL_PROPAGATORS` | `tracecontext,baggage` | W3C 上下文传播（标准） |
| `OTEL_TRACES_SAMPLER` | `parentbased_always_on` | 采样策略 |

### 本地快速体验（使用 Jaeger）

```bash
# 启动 Jaeger all-in-one（支持 OTLP + 自带 UI）
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest

# 启动 ucli-server 并开启追踪
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64位hex> ucli-server

# 打开 Jaeger UI
open http://localhost:16686
```

### 禁用 OTEL

```bash
OTEL_ENABLED=false ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64位hex> ucli-server
```

## 管理后台

安装 npm 包后，`/admin-ui` 路径自动提供内置 Web 管理界面，功能包括：

- **仪表板** — 统计概览（分组数、OAS 条目数、有效 Token 数）
- **分组管理** — 创建和删除分组
- **OAS 条目管理** — 注册、编辑和删除 OAS 条目及其认证配置
- **Token 管理** — 按分组签发 JWT Token（签发后一次性显示）、查看状态、吊销

管理界面自动从 npm 包内附带的 `dist/admin-ui/` 目录提供服务，无需额外配置，启动服务后打开 `http://localhost:3000/admin-ui` 即可访问。

也可以通过环境变量指定自定义目录：

```bash
ADMIN_UI_PATH=/path/to/custom/dist ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> ucli-server
```

## 健康检查与可观测性

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/health` | `GET` | 存活探针，始终返回 `200 OK` |
| `/api/v1/ready` | `GET` | 就绪探针，检查存储和缓存适配器 |
| `/metrics` | `GET` | Prometheus 指标（默认 IP 限制） |
| `/api/docs` | `GET` | Swagger UI（`SWAGGER_ENABLED=false` 可关闭） |
| `/api/openapi.json` | `GET` | OpenAPI 3.0 JSON 规范 |
| `/admin-ui` | `GET` | 管理后台 |

## 安全模型

- **静态加密**：`authConfig` 字段以 AES-256-GCM（256 位密钥，每条记录随机 IV）加密
- **传输安全**：解密后的认证信息仅通过 TLS 传输给已认证的 CLI 客户端
- **JWT 安全**：RS256 签名，通过缓存黑名单追踪 JTI 实现吊销
- **管理认证**：`X-Admin-Secret` 请求头通过常量时间比较验证
- **不落日志**：认证配置永不写入日志或错误消息
