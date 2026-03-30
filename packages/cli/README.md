<h1 align="center">ucli</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@tronsfey/ucli"><img src="https://img.shields.io/npm/v/@tronsfey/ucli?color=2563eb" alt="npm version"/></a>
  <img src="https://img.shields.io/badge/Commander.js-ESM-38bdf8" alt="Commander.js"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
</p>

<p align="center">
  English | <a href="./README.zh.md">中文</a>
</p>

---

## Overview

`@tronsfey/ucli` is the client component of ucli. It gives AI agents (and humans) a simple interface to:

- **Discover** OpenAPI services registered on a ucli server
- **Execute** API operations without ever handling credentials directly
- **Cache** specs locally to reduce round-trips
- **Invoke** MCP server tools via `ucli mcp <server> invoketool <tool>`

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

    Agent->>CLI: ucli listoas
    CLI->>Cache: Check local cache (TTL)
    alt Cache miss
        CLI->>Server: GET /api/v1/oas  (Bearer JWT)
        Server-->>CLI: [ { name, description, ... } ]
        CLI->>Cache: Write cache entry
    end
    Cache-->>CLI: OAS list
    CLI-->>Agent: Table / JSON output

    Agent->>CLI: ucli oas payments invokeapi createPayment --data '{...}'
    CLI->>Server: GET /api/v1/oas/payments  (Bearer JWT)
    Server-->>CLI: OAS spec + decrypted authConfig (TLS)
    CLI->>CLI: Inject authConfig as ENV vars
    CLI->>API: spawn @tronsfey/openapi2cli (ENV: auth creds)
    API-->>CLI: HTTP response
    CLI-->>Agent: Formatted output (JSON / table / YAML)

    Agent->>CLI: ucli mcp my-server invoketool get_weather --data '{"city":"Beijing"}'
    CLI->>Server: GET /api/v1/mcp/my-server (Bearer JWT)
    Server-->>CLI: McpEntry + decrypted authConfig (TLS)
    CLI->>CLI: Inject auth as headers/env into mcp2cli config
    CLI->>MCP: @tronsfey/mcp2cli (programmatic, no subprocess)
    MCP-->>CLI: Tool result (JSON)
    CLI-->>Agent: Output
```

## Installation

```bash
npm install -g @tronsfey/ucli
# or
pnpm add -g @tronsfey/ucli
```

## Quick Start

```bash
# 1. Configure (get server URL and JWT from your admin)
ucli configure --server http://localhost:3000 --token <group-jwt>

# 2. List available services
ucli listoas

# 3. Inspect a service's operations
ucli oas payments listapi

# 4. Run an operation
ucli oas payments invokeapi getPetById --params '{"petId": 42}'
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

### `listoas`

List all OpenAPI services available to your group.

```bash
ucli listoas [--format table|json|yaml] [--refresh]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--format` | `table` | Output format: `table`, `json`, or `yaml` |
| `--refresh` | `false` | Bypass local cache and fetch fresh from server |

**Example output (table):**

```
SERVICE      AUTH      DESCRIPTION
----------   --------  ------------------------------------------
payments     bearer    Payments service API
inventory    api_key   Inventory management
crm          oauth2_cc CRM operations
```

---

### `oas <service> info`

Show detailed information about a specific service.

```bash
ucli oas <service> info [--format json|table|yaml]
```

| Argument/Flag | Description |
|---------------|-------------|
| `<service>` | Service name from `listoas` |
| `--format` | Output format (`json` default) |

---

### `oas <service> listapi`

List all available API operations for a service.

```bash
ucli oas <service> listapi [--format json|table|yaml]
```

| Argument/Flag | Description |
|---------------|-------------|
| `<service>` | Service name from `listoas` |
| `--format` | Output format (`json` default) |

---

### `oas <service> apiinfo <api>`

Show detailed input/output parameters for a specific API operation.

```bash
ucli oas <service> apiinfo <api>
```

| Argument | Description |
|----------|-------------|
| `<service>` | Service name from `listoas` |
| `<api>` | Operation ID from `oas <service> listapi` |

---

### `oas <service> invokeapi <api>`

Execute a single API operation defined in an OpenAPI spec.

```bash
ucli oas <service> invokeapi <api> [options]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--data` | No | Request body (JSON string or @filename) |
| `--params` | No | JSON string of parameters (path, query merged) |
| `--format` | No | Output format: `json` (default), `table`, `yaml` |
| `--query` | No | JMESPath expression to filter the response |
| `--machine` | No | Structured JSON envelope output (agent-friendly) |
| `--dry-run` | No | Preview the HTTP request without executing (implies `--machine`) |

**Examples:**

```bash
# GET with path parameter
ucli oas petstore invokeapi getPetById --params '{"petId": 42}'

# POST with body
ucli oas payments invokeapi createPayment \
  --data '{"amount": 100, "currency": "USD", "recipient": "acct_123"}'

# GET with query parameter + JMESPath filter
ucli oas inventory invokeapi listProducts \
  --params '{"category": "electronics", "limit": 10}' \
  --query 'items[?price < `50`].name'

# Agent-friendly structured output
ucli oas payments invokeapi listTransactions --machine

# Preview request without executing
ucli oas payments invokeapi createPayment --dry-run \
  --data '{"amount": 5000, "currency": "USD"}'
```

---

### `listmcp`

List all MCP servers available to your group.

```bash
ucli listmcp [--format table|json|yaml]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--format` | `table` | Output format: `table`, `json`, or `yaml` |

---

### `mcp <server> listtool`

List tools available on a specific MCP server.

```bash
ucli mcp <server> listtool [--format table|json|yaml]
```

| Argument/Flag | Description |
|---------------|-------------|
| `<server>` | MCP server name from `listmcp` |
| `--format` | Output format (`table` default) |

---

### `mcp <server> toolinfo <tool>`

Show detailed parameter schema for a tool on a MCP server.

```bash
ucli mcp <server> toolinfo <tool> [--json]
```

| Argument/Flag | Description |
|---------------|-------------|
| `<server>` | MCP server name from `listmcp` |
| `<tool>` | Tool name from `mcp <server> listtool` |
| `--json` | Output full schema as JSON (for agent consumption) |

**Examples:**

```bash
# Human-readable tool description
ucli mcp weather toolinfo get_forecast

# JSON schema (for agent introspection)
ucli mcp weather toolinfo get_forecast --json
```

---

### `mcp <server> invoketool <tool>`

Execute a tool on an MCP server.

```bash
ucli mcp <server> invoketool <tool> [--data <json>] [--json]
```

| Flag | Description |
|------|-------------|
| `--data` | Tool arguments as a JSON object |
| `--json` | Machine-readable JSON output |

**Examples:**

```bash
# Call a weather tool with JSON input
ucli mcp weather invoketool get_forecast --data '{"location": "New York", "units": "metric"}'

# Call a search tool
ucli mcp search-server invoketool web_search --data '{"query": "ucli MCP", "limit": 5}'

# Get structured JSON output
ucli mcp weather invoketool get_forecast --json --data '{"location": "New York"}'
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
- Force a refresh: `ucli refresh` or use `--refresh` flag on `listoas`

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
ucli listoas --format json

# Step 2: Inspect a service to see available operations
ucli oas <service-name> listapi --format json

# Step 3: Get detailed info about a specific API
ucli oas <service-name> apiinfo <api>

# Step 4: Preview a request (dry-run — no execution)
ucli oas <service-name> invokeapi <api> --dry-run \
  --data '{ ... }'

# Step 5: Execute an operation with structured output
ucli oas <service-name> invokeapi <api> \
  --data '{ ... }' --machine

# Step 6: Filter results with JMESPath
ucli oas inventory invokeapi listProducts \
  --query 'items[?inStock == `true`] | [0:5]'

# Step 7: Chain operations (use output from one as input to another)
PRODUCT_ID=$(ucli oas inventory invokeapi listProducts \
  --query 'items[0].id' | tr -d '"')
ucli oas orders invokeapi createOrder \
  --data "{\"productId\": \"$PRODUCT_ID\", \"quantity\": 1}"

# Step 8: MCP — inspect a tool, then call it with JSON input
ucli mcp weather toolinfo get_forecast --json
ucli mcp weather invoketool get_forecast --data '{"location": "New York", "units": "metric"}'
```

**Tips for agents:**
- Always run `ucli listoas` first to discover what's available
- Use `--machine` for structured envelope output from API operations
- Use `--dry-run` to preview requests before executing destructive operations
- Use `ucli mcp <server> toolinfo <tool> --json` to discover tool parameters
- Use `--data` for both MCP tool calls and OAS API calls (JSON input)
- Use `--format json` for programmatic parsing
- Use `--query` with JMESPath to extract specific fields
- Check pagination fields (`nextPage`, `totalCount`) for list operations
- If a service seems stale, run `ucli refresh --service <name>`

## Error Reference

| Error | Likely Cause | Resolution |
|-------|-------------|------------|
| `Unauthorized (401)` | JWT expired or revoked | Get a new token from the admin |
| `Service not found` | Service name misspelled or not in group | Run `ucli listoas` to see available services |
| `Operation not found` | Invalid `operationId` | Run `ucli oas <service> listapi` to see valid operations |
| `MCP server not found` | Server name misspelled or not in group | Run `ucli listmcp` to see available servers |
| `Tool not found` | Invalid tool name | Run `ucli mcp <server> listtool` to see available tools |
| `Connection refused` | Server not running or wrong URL | Check server URL with `ucli configure` |
| `Cache error` | Temp dir permissions issue | Run `ucli refresh` to reset cache |
