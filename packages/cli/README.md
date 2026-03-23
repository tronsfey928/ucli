<h1 align="center">ucli</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ucli/cli"><img src="https://img.shields.io/npm/v/@ucli/cli?color=2563eb" alt="npm version"/></a>
  <img src="https://img.shields.io/badge/Commander.js-ESM-38bdf8" alt="Commander.js"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
</p>

<p align="center">
  English | <a href="./README.zh.md">中文</a>
</p>

---

## Overview

`@ucli/cli` is the client component of ucli. It gives AI agents (and humans) a simple interface to:

- **Discover** OpenAPI services registered on a ucli server
- **Execute** API operations without ever handling credentials directly
- **Cache** specs locally to reduce round-trips
- **Invoke** MCP server tools via `ucli mcp run`

Auth credentials (bearer tokens, API keys, OAuth2 secrets, MCP headers/env) are stored encrypted on the server and injected at runtime — they are **never written to disk** or visible in process listings.

## How It Works

```mermaid
sequenceDiagram
    participant Agent as AI Agent / User
    participant CLI as ucli
    participant Server as ucli-server
    participant Cache as Local Cache
    participant API as Target API

    Agent->>CLI: ucli configure --server URL --token JWT
    CLI->>CLI: Save config (OS config dir)

    Agent->>CLI: ucli services list
    CLI->>Cache: Check local cache (TTL)
    alt Cache miss
        CLI->>Server: GET /api/v1/oas  (Bearer JWT)
        Server-->>CLI: [ { name, description, ... } ]
        CLI->>Cache: Write cache entry
    end
    Cache-->>CLI: OAS list
    CLI-->>Agent: Table / JSON output

    Agent->>CLI: ucli run --service payments --operation createPayment --params '{...}'
    CLI->>Server: GET /api/v1/oas/payments  (Bearer JWT)
    Server-->>CLI: OAS spec + decrypted authConfig (TLS)
    CLI->>CLI: Inject authConfig as ENV vars
    CLI->>API: spawn @tronsfey/openapi2cli (ENV: auth creds)
    API-->>CLI: HTTP response
    CLI-->>Agent: Formatted output (JSON / table / YAML)

    Agent->>CLI: ucli mcp run my-server get_weather --city Beijing
    CLI->>Server: GET /api/v1/mcp/my-server (Bearer JWT)
    Server-->>CLI: McpEntry + decrypted authConfig (TLS)
    CLI->>CLI: Inject auth as headers/env into mcp2cli config
    CLI->>MCP: @tronsfey/mcp2cli (programmatic, no subprocess)
    MCP-->>CLI: Tool result (JSON)
    CLI-->>Agent: Output
```

## Installation

```bash
npm install -g @ucli/cli
# or
pnpm add -g @ucli/cli
```

## Quick Start

```bash
# 1. Configure (get server URL and JWT from your admin)
ucli configure --server http://localhost:3000 --token <group-jwt>

# 2. List available services
ucli services list

# 3. Inspect a service's operations
ucli services info payments

# 4. Run an operation
ucli run --service payments --operation getPetById --params '{"petId": 42}'
```

## Command Reference

### `configure`

Store the server URL and group JWT locally.

```bash
ucli configure --server <url> --token <jwt>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--server` | Yes | ucli server URL (e.g. `https://gateway.example.com`) |
| `--token` | Yes | Group JWT issued by the server admin |

Config is stored in the OS-appropriate config directory:
- Linux/macOS: `~/.config/ucli/`
- Windows: `%APPDATA%\ucli\`

---

### `services list`

List all OpenAPI services available to your group.

```bash
ucli services list [--format table|json|yaml] [--refresh]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--format` | `table` | Output format: `table`, `json`, or `yaml` |
| `--refresh` | `false` | Bypass local cache and fetch fresh from server |

**Example output (table):**

```
NAME         DESCRIPTION              CACHE TTL
payments     Payments service API     3600s
inventory    Inventory management     1800s
crm          CRM operations           7200s
```

**Example output (json):**

```json
[
  { "name": "payments", "description": "Payments service API", "cacheTtl": 3600 },
  { "name": "inventory", "description": "Inventory management", "cacheTtl": 1800 }
]
```

---

### `services info <name>`

Show detailed information about a specific service, including its available operations.

```bash
ucli services info <service-name> [--format table|json|yaml]
```

| Argument/Flag | Description |
|---------------|-------------|
| `<name>` | Service name from `services list` |
| `--format` | Output format (`table` default) |

---

### `run`

Execute a single API operation defined in an OpenAPI spec.

```bash
ucli run --service <name> --operation <operationId> [options]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--service` | Yes | Service name (from `services list`) |
| `--operation` | Yes | `operationId` from the OpenAPI spec |
| `--params` | No | JSON string of parameters (path, query, body merged) |
| `--format` | No | Output format: `json` (default), `table`, `yaml` |
| `--query` | No | JMESPath expression to filter the response |

**Examples:**

```bash
# GET with path parameter
ucli run --service petstore --operation getPetById \
  --params '{"petId": 42}'

# POST with body
ucli run --service payments --operation createPayment \
  --params '{"amount": 100, "currency": "USD", "recipient": "acct_123"}' \
  --format json

# GET with query parameter + JMESPath filter
ucli run --service inventory --operation listProducts \
  --params '{"category": "electronics", "limit": 10}' \
  --query 'items[?price < `50`].name'

# POST with data from file
ucli run --service crm --operation createContact \
  --params "@./contact.json"
```

---

### `mcp list`

List all MCP servers available to your group.

```bash
ucli mcp list [--format table|json|yaml]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--format` | `table` | Output format: `table`, `json`, or `yaml` |

---

### `mcp tools <server>`

List tools available on a specific MCP server.

```bash
ucli mcp tools <server-name> [--format table|json]
```

| Argument/Flag | Description |
|---------------|-------------|
| `<server-name>` | MCP server name from `mcp list` |
| `--format` | Output format (`table` default) |

---

### `mcp run <server> <tool> [args...]`

Execute a tool on an MCP server.

```bash
ucli mcp run <server-name> <tool-name> [args...]
```

Args are passed as `key=value` pairs and converted to a JSON object.

**Examples:**

```bash
# Call a weather tool
ucli mcp run weather get_forecast location="New York" units=metric

# Call a search tool
ucli mcp run search-server web_search query="ucli MCP" limit=5
```

---

### `refresh`

Force-refresh the local OAS cache from the server.

```bash
ucli refresh [--service <name>]
```

| Flag | Description |
|------|-------------|
| `--service` | Refresh only a specific service (omit to refresh all) |

---

### `help`

Show available commands and AI agent usage instructions.

```bash
ucli help
```

## Configuration

Config is managed via the `configure` command. Values are stored in the OS config dir using [conf](https://github.com/sindresorhus/conf).

| Key | Description |
|-----|-------------|
| `serverUrl` | ucli server URL |
| `token` | Group JWT for authenticating with the server |

## Caching

- OAS entries are cached locally as JSON files in the OS temp dir (`ucli/` subdirectory)
- Cache TTL per entry is set by the server admin via the `cacheTtl` field (seconds)
- Expired entries are automatically re-fetched on next access
- Force a refresh: `ucli refresh` or use `--refresh` flag on `services list`

## Auth Handling

Credentials are **never exposed** to the agent or written to disk:

1. CLI fetches the OAS entry from the server over TLS (includes decrypted `authConfig`)
2. `authConfig` is passed as **environment variables** to the `@tronsfey/openapi2cli` subprocess
3. The subprocess uses the credentials to call the target API
4. The in-memory `authConfig` is discarded after the subprocess exits

This means credentials never appear in:
- Process listings (`ps aux`)
- Shell history
- Log files
- The agent's context window

For MCP servers, auth (`http_headers` or `env`) is injected directly into the `@tronsfey/mcp2cli` programmatic config — it is **never passed as CLI arguments** (which would be visible in `ps`).

## For AI Agents

The recommended workflow for AI agents using `ucli` as a skill:

```bash
# Step 1: Discover available services
ucli services list --format json

# Step 2: Inspect a service to see available operations
ucli services info <service-name> --format json

# Step 3: Execute an operation
ucli run --service <name> --operation <operationId> \
  --params '{ ... }' --format json

# Step 4: Filter results with JMESPath
ucli run --service inventory --operation listProducts \
  --query 'items[?inStock == `true`] | [0:5]'

# Step 5: Chain operations (use output from one as input to another)
PRODUCT_ID=$(ucli run --service inventory --operation listProducts \
  --query 'items[0].id' | tr -d '"')
ucli run --service orders --operation createOrder \
  --params "{\"productId\": \"$PRODUCT_ID\", \"quantity\": 1}"
```

**Tips for agents:**
- Always run `services list` first to discover what's available
- Use `--format json` for programmatic parsing
- Use `--query` with JMESPath to extract specific fields
- Check pagination fields (`nextPage`, `totalCount`) for list operations
- If a service seems stale, run `ucli refresh --service <name>`

## Error Reference

| Error | Likely Cause | Resolution |
|-------|-------------|------------|
| `Unauthorized (401)` | JWT expired or revoked | Get a new token from the admin |
| `Service not found` | Service name misspelled or not in group | Run `services list` to see available services |
| `Operation not found` | Invalid `operationId` | Run `services info <name>` to see valid operations |
| `MCP server not found` | Server name misspelled or not in group | Run `ucli mcp list` to see available servers |
| `Tool not found` | Invalid tool name | Run `ucli mcp tools <server>` to see available tools |
| `Connection refused` | Server not running or wrong URL | Check server URL with `ucli configure` |
| `Cache error` | Temp dir permissions issue | Run `ucli refresh` to reset cache |
