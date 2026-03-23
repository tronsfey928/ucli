<p align="center">
  <img src="./assets/logo.svg" alt="OAS Gateway" width="480" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tronsfey/oas-server"><img src="https://img.shields.io/npm/v/@tronsfey/oas-server?label=%40tronsfey%2Foas-server&color=7c3aed" alt="oas-server version"/></a>
  <a href="https://www.npmjs.com/package/@tronsfey/oas-cli"><img src="https://img.shields.io/npm/v/@tronsfey/oas-cli?label=%40tronsfey%2Foas-cli&color=2563eb" alt="oas-cli version"/></a>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#chinese">中文</a>
</p>

---

<a id="english"></a>

## English

### What is OAS Gateway?

**OAS Gateway** is a centralized [OpenAPI Specification](https://swagger.io/specification/) management system built with a client/server architecture.

- The **server** (`@tronsfey/oas-server`) stores OpenAPI specs with **encrypted auth configs** (AES-256-GCM) and issues **group-scoped JWTs** (RS256).
- The **CLI** (`@tronsfey/oas-cli`) lets AI agents discover and invoke API operations **without ever seeing credentials** — auth is injected as environment variables at runtime.

### Architecture

```mermaid
graph TB
    subgraph Admin["🔐 Admin / DevOps"]
        ADM[curl / Admin Client]
    end

    subgraph Server["🖥️  @tronsfey/oas-server  ·  NestJS v11"]
        SVC["REST API\n(AdminGuard + GroupTokenGuard)"]
        ST[("Storage\nmemory · postgres · mysql")]
        CA[("Cache\nmemory · redis")]
        CR["Crypto\nAES-256-GCM · RS256 JWT"]
        SVC --- ST
        SVC --- CA
        SVC --- CR
    end

    subgraph Client["💻  @tronsfey/oas-cli  ·  Commander.js"]
        CLI[oas-cli]
        O2C["@tronsfey/openapi2cli\n(subprocess)"]
        CLI -->|"spawn with ENV creds"| O2C
    end

    subgraph APIs["🌐 Target APIs"]
        A1[Payments API]
        A2[Inventory API]
        A3["CRM / Other APIs"]
    end

    ADM -->|"X-Admin-Secret header"| SVC
    CLI -->|"Bearer JWT (group token)"| SVC
    SVC -.->|"OAS + decrypted auth  (TLS)"| CLI
    O2C -->|"HTTP + ENV-injected credentials"| A1
    O2C -->|"HTTP + ENV-injected credentials"| A2
    O2C -->|"HTTP + ENV-injected credentials"| A3
```

### Auth Flow

```mermaid
sequenceDiagram
    participant Admin
    participant Server as oas-server
    participant CLI as oas-cli
    participant API as Target API

    Admin->>Server: POST /admin/groups (X-Admin-Secret)
    Server-->>Admin: { groupId, name }

    Admin->>Server: POST /admin/groups/:id/tokens
    Server-->>Admin: JWT  ⚠️ shown once — store securely

    Admin->>Server: POST /admin/oas  { name, remoteUrl, authConfig }
    Server->>Server: Encrypt authConfig with AES-256-GCM
    Server-->>Admin: OAS entry created

    Note over CLI,Server: Later — agent runtime

    CLI->>Server: GET /api/v1/oas  (Bearer JWT)
    Server->>Server: Verify JWT · Decrypt authConfig
    Server-->>CLI: OAS spec + plain auth (TLS only)

    CLI->>CLI: Inject auth as ENV vars (never written to disk)
    CLI->>API: HTTP request via @tronsfey/openapi2cli subprocess
    API-->>CLI: Response (JSON / YAML / table)
```

### Repository Structure

```
fantastic-potato/
├── README.md                        # This file
├── CLAUDE.md                        # AI assistant guidance
├── assets/
│   └── logo.svg                     # Brand logo
├── package.json                     # pnpm workspace root
├── tsconfig.base.json               # Shared TS config
├── docker-compose.yml               # PostgreSQL + Redis for local dev
└── packages/
    ├── server/                      # @tronsfey/oas-server (NestJS v11)
    │   ├── src/
    │   │   ├── auth/                # AdminGuard + GroupTokenGuard
    │   │   ├── cache/               # Pluggable cache (memory | redis)
    │   │   ├── config/              # Joi-validated env vars
    │   │   ├── crypto/              # JwtService (RS256) + EncryptionService (AES-256-GCM)
    │   │   ├── groups/              # Group management
    │   │   ├── health/              # Liveness + readiness probes
    │   │   ├── metrics/             # Prometheus export
    │   │   ├── oas/                 # OAS CRUD (admin + client)
    │   │   ├── storage/             # Pluggable storage (memory | postgres | mysql)
    │   │   └── tokens/              # Token issuance + revocation
    │   └── test/e2e/                # Jest E2E tests (memory adapters)
    └── cli/                         # @tronsfey/oas-cli (Commander.js + tsup/ESM)
        ├── src/
        │   ├── commands/            # configure, services, run, refresh, help
        │   └── lib/                 # server-client, cache, oas-runner
        └── test/                    # Vitest unit tests
```

### Quick Start

**Step 1 — Start the server**

```bash
npm install -g @tronsfey/oas-server

# Generate a 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64-hex> oas-server
# → Listening on http://localhost:3000
```

**Step 2 — Register a service and issue a token**

```bash
# Create a group
GROUP=$(curl -s -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agents"}' | jq -r '.id')

# Issue a JWT (save this — shown once!)
JWT=$(curl -s -X POST http://localhost:3000/admin/groups/$GROUP/tokens \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-token"}' | jq -r '.token')

# Register an OAS entry
curl -s -X POST http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"$GROUP\",
    \"name\": \"petstore\",
    \"remoteUrl\": \"https://petstore3.swagger.io/api/v3/openapi.json\",
    \"authType\": \"none\",
    \"authConfig\": {\"type\":\"none\"}
  }"
```

**Step 3 — Use the CLI**

```bash
npm install -g @tronsfey/oas-cli

oas-cli configure --server http://localhost:3000 --token $JWT
oas-cli services list
oas-cli run --service petstore --operation getPetById --params '{"petId": 1}'
```

### Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@tronsfey/oas-server`](./packages/server) | NestJS server — storage, crypto, auth, REST API | [README](./packages/server/README.md) |
| [`@tronsfey/oas-cli`](./packages/cli) | Commander.js CLI — service discovery, operation runner | [README](./packages/cli/README.md) |

### Development

```bash
# Prerequisites: Node.js ≥ 18, pnpm ≥ 9
pnpm install

# Run all tests (no DB/Redis required — uses memory adapters)
pnpm test

# Type-check both packages
pnpm lint

# Start server in dev mode (hot-reload)
cd packages/server
ADMIN_SECRET=dev ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") pnpm dev
```

---

<a id="chinese"></a>

## 中文

### OAS Gateway 是什么？

**OAS Gateway** 是一个基于客户端/服务端架构的 [OpenAPI Specification](https://swagger.io/specification/) 集中管理系统。

- **服务端**（`@tronsfey/oas-server`）以 **AES-256-GCM** 加密存储 OpenAPI 规范及认证配置，并签发 **RS256 群组 JWT**。
- **CLI**（`@tronsfey/oas-cli`）让 AI 智能体无需接触凭据即可发现并调用 API 操作——认证信息在运行时以环境变量方式注入子进程，**永不落盘**。

### 架构图

```mermaid
graph TB
    subgraph Admin["🔐 管理员 / DevOps"]
        ADM[curl / 管理客户端]
    end

    subgraph Server["🖥️  @tronsfey/oas-server  ·  NestJS v11"]
        SVC["REST API\n(AdminGuard + GroupTokenGuard)"]
        ST[("存储层\nmemory · postgres · mysql")]
        CA[("缓存层\nmemory · redis")]
        CR["加密模块\nAES-256-GCM · RS256 JWT"]
        SVC --- ST
        SVC --- CA
        SVC --- CR
    end

    subgraph Client["💻  @tronsfey/oas-cli  ·  Commander.js"]
        CLI[oas-cli]
        O2C["@tronsfey/openapi2cli\n（子进程）"]
        CLI -->|"携带 ENV 凭据启动"| O2C
    end

    subgraph APIs["🌐 目标 API"]
        A1[支付 API]
        A2[库存 API]
        A3["CRM / 其他 API"]
    end

    ADM -->|"X-Admin-Secret 请求头"| SVC
    CLI -->|"Bearer JWT（群组令牌）"| SVC
    SVC -.->|"OAS 规范 + 解密后的认证信息（TLS）"| CLI
    O2C -->|"HTTP + ENV 注入凭据"| A1
    O2C -->|"HTTP + ENV 注入凭据"| A2
    O2C -->|"HTTP + ENV 注入凭据"| A3
```

### 认证流程

```mermaid
sequenceDiagram
    participant Admin as 管理员
    participant Server as oas-server
    participant CLI as oas-cli
    participant API as 目标 API

    Admin->>Server: POST /admin/groups（X-Admin-Secret）
    Server-->>Admin: { groupId, name }

    Admin->>Server: POST /admin/groups/:id/tokens
    Server-->>Admin: JWT  ⚠️ 仅显示一次，请妥善保存

    Admin->>Server: POST /admin/oas { name, remoteUrl, authConfig }
    Server->>Server: AES-256-GCM 加密 authConfig
    Server-->>Admin: OAS 条目创建成功

    Note over CLI,Server: 之后——智能体运行时

    CLI->>Server: GET /api/v1/oas（Bearer JWT）
    Server->>Server: 验证 JWT · 解密 authConfig
    Server-->>CLI: OAS 规范 + 明文认证信息（仅 TLS 传输）

    CLI->>CLI: 将认证信息注入 ENV 变量（不写入磁盘）
    CLI->>API: 通过 @tronsfey/openapi2cli 子进程发起 HTTP 请求
    API-->>CLI: 响应（JSON / YAML / 表格）
```

### 仓库结构

```
fantastic-potato/
├── README.md                        # 本文件
├── CLAUDE.md                        # AI 助手指南
├── assets/
│   └── logo.svg                     # 品牌 Logo
├── package.json                     # pnpm workspace 根配置
├── tsconfig.base.json               # 共享 TypeScript 配置
├── docker-compose.yml               # 本地开发用 PostgreSQL + Redis
└── packages/
    ├── server/                      # @tronsfey/oas-server（NestJS v11）
    │   ├── src/
    │   │   ├── auth/                # AdminGuard + GroupTokenGuard
    │   │   ├── cache/               # 可插拔缓存（memory | redis）
    │   │   ├── config/              # Joi 校验的环境变量
    │   │   ├── crypto/              # JwtService（RS256）+ EncryptionService（AES-256-GCM）
    │   │   ├── groups/              # 群组管理
    │   │   ├── health/              # 存活 + 就绪探针
    │   │   ├── metrics/             # Prometheus 指标导出
    │   │   ├── oas/                 # OAS CRUD（管理端 + 客户端）
    │   │   ├── storage/             # 可插拔存储（memory | postgres | mysql）
    │   │   └── tokens/              # 令牌签发 + 吊销
    │   └── test/e2e/                # Jest E2E 测试（内存适配器）
    └── cli/                         # @tronsfey/oas-cli（Commander.js + tsup/ESM）
        ├── src/
        │   ├── commands/            # configure、services、run、refresh、help
        │   └── lib/                 # server-client、cache、oas-runner
        └── test/                    # Vitest 单元测试
```

### 快速开始

**第一步 — 启动服务端**

```bash
npm install -g @tronsfey/oas-server

# 生成 32 字节加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64位十六进制> oas-server
# → 监听 http://localhost:3000
```

**第二步 — 注册服务并签发令牌**

```bash
# 创建群组
GROUP=$(curl -s -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agents"}' | jq -r '.id')

# 签发 JWT（请妥善保存，仅显示一次！）
JWT=$(curl -s -X POST http://localhost:3000/admin/groups/$GROUP/tokens \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-token"}' | jq -r '.token')

# 注册 OAS 条目
curl -s -X POST http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"$GROUP\",
    \"name\": \"petstore\",
    \"remoteUrl\": \"https://petstore3.swagger.io/api/v3/openapi.json\",
    \"authType\": \"none\",
    \"authConfig\": {\"type\":\"none\"}
  }"
```

**第三步 — 使用 CLI**

```bash
npm install -g @tronsfey/oas-cli

oas-cli configure --server http://localhost:3000 --token $JWT
oas-cli services list
oas-cli run --service petstore --operation getPetById --params '{"petId": 1}'
```

### 子包说明

| 包名 | 描述 | 文档 |
|------|------|------|
| [`@tronsfey/oas-server`](./packages/server) | NestJS 服务端——存储、加密、认证、REST API | [README](./packages/server/README.md) |
| [`@tronsfey/oas-cli`](./packages/cli) | Commander.js CLI——服务发现、操作执行 | [README](./packages/cli/README.md) |

### 开发

```bash
# 前置条件：Node.js ≥ 18，pnpm ≥ 9
pnpm install

# 运行全部测试（无需 DB/Redis，使用内存适配器）
pnpm test

# 类型检查两个包
pnpm lint

# 服务端开发模式（热重载）
cd packages/server
ADMIN_SECRET=dev ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") pnpm dev
```
