---
name: ucli
description: Proxy OpenAPI and MCP services for AI agents — discover, inspect, and invoke APIs with automatic credential injection.
version: 0.5.0
metadata:
  openclaw:
    emoji: "🔗"
    homepage: https://github.com/tronsfey928/ucli
    requires:
      bins:
        - ucli
    install:
      - kind: node
        package: "@tronsfey/ucli"
        bins: [ucli]
---

# ucli Skill

## Overview

Use `ucli` whenever you need to call any external business API or MCP server tool. This tool:
- Proxies registered OpenAPI services on your behalf
- Handles authentication automatically (credentials are never exposed to you)
- Returns structured JSON output suitable for further processing
- Supports `--output json` for fully structured envelopes (success/error)

**When to use:** Any time you need to interact with external services (business APIs, data sources, microservices). Always start with `ucli introspect` to discover all capabilities in a single call.

---

## Agent Methodology — OODA Loop

ucli is designed around the **Observe → Orient → Decide → Act** (OODA) loop for AI agent workflows:

1. **Observe** — Discover all available capabilities with `ucli introspect`
2. **Orient** — Understand specific operations with `ucli oas <service> listapi` or `ucli mcp <server> listtool`
3. **Decide** — Choose the right operation and parameters based on the task
4. **Act** — Execute with `ucli oas <service> invokeapi <api>` or `ucli mcp <server> invoketool <tool>`

### Recommended First Call

```bash
ucli introspect --output json
```

This returns a complete manifest in a single call:
```json
{
  "success": true,
  "data": {
    "version": "1",
    "services": [
      { "name": "payments", "description": "...", "authType": "bearer", ... }
    ],
    "mcpServers": [
      { "name": "weather", "description": "...", "transport": "http", ... }
    ],
    "commands": [
      { "name": "oas invokeapi", "description": "...", "usage": "...", "examples": [...] }
    ]
  }
}
```

---

## Global Flags

| Flag | Description |
|------|-------------|
| `--output json` | Wrap ALL output in structured `{ success, data/error }` envelopes |
| `--debug` | Enable verbose debug logging |
| `-v, --version` | Show version number |

### Structured Output Mode (`--output json`)

When `--output json` is passed, every command emits exactly one JSON object to stdout:

**Success:**
```json
{ "success": true, "data": <result> }
```

**Error:**
```json
{ "success": false, "error": { "code": 6, "message": "Service not found: foo", "hint": "Run: ucli listoas" } }
```

Error codes: `0`=success, `1`=general, `2`=usage, `3`=config, `4`=auth, `5`=connectivity, `6`=not-found, `7`=server-error.

**Always use `--output json` when calling ucli from code or as an AI agent.** This ensures you can reliably parse both success and error results.

---

## Step 1 — Discover Available Services

```bash
ucli listoas
```

Returns a table of service names, auth type, and descriptions. Run this first to see what's available.

**Example output:**
```
SERVICE     AUTH      DESCRIPTION
----------  --------  ------------------------------------------
payments    bearer    Payment processing service
inventory   api_key   Product inventory management
crm         oauth2_cc Customer relationship management
```

For machine-readable output:
```bash
ucli listoas --output json
```

---

## Step 2 — Inspect a Service's Operations

```bash
ucli oas <service-name> listapi
```

Shows all available operations, their parameters, and expected inputs.

**Example:**
```bash
ucli oas payments listapi
```

For detailed information about a specific API operation:
```bash
ucli oas payments apiinfo createCharge
```

---

## Step 3 — Execute an Operation

```bash
ucli oas <service> invokeapi <api> [options]
```

### Options

| Flag | Description | Example |
|------|-------------|---------|
| `--format json\|table\|yaml` | Output format (default: json) | `--format table` |
| `--query <jmespath>` | Filter response with JMESPath | `--query "items[*].id"` |
| `--data <json\|@file>` | Request body for POST/PUT/PATCH | `--data '{"amount":100}'` |
| `--machine` | Structured JSON envelope output (agent-friendly) | `--machine` |
| `--dry-run` | Preview the HTTP request without executing (implies `--machine`) | `--dry-run` |

### Agent-Friendly Mode (`--machine`)

Use `--machine` for structured JSON envelope output that agents can parse deterministically:

```bash
# Structured success output
ucli oas payments invokeapi listTransactions --machine
# → { "success": true, "data": {...}, "meta": { "durationMs": 42 } }

# Structured error output
ucli oas payments invokeapi getTransaction --params '{"transactionId": "invalid"}' --machine
# → { "success": false, "error": { "type": "HttpClientError", "message": "...", "statusCode": 404 } }
```

### Dry-Run Mode (`--dry-run`)

Preview the HTTP request that *would* be sent, without actually executing it:

```bash
ucli oas payments invokeapi createCharge --dry-run --data '{"amount": 5000, "currency": "USD"}'
# → { "method": "POST", "url": "https://api.example.com/charges", "headers": {...}, "body": {...} }
```

This is useful for verifying parameters before making destructive or costly API calls.

### Examples

**List resources (GET):**
```bash
ucli oas payments invokeapi listTransactions --format json
```

**Filter response:**
```bash
ucli oas inventory invokeapi listProducts --query "items[?stock > \`0\`].name"
```

**Create a resource (POST):**
```bash
ucli oas payments invokeapi createCharge --data '{"amount": 5000, "currency": "USD", "customerId": "cus_123"}'
```

**Update a resource (PUT/PATCH):**
```bash
ucli oas crm invokeapi updateContact --data '{"email": "new@example.com"}' --params '{"contactId": "abc123"}'
```

**Get a specific resource:**
```bash
ucli oas inventory invokeapi getProduct --params '{"productId": "SKU-001"}'
```

---

## Step 4 — Process the Output

By default, `ucli oas <service> invokeapi` returns JSON. You can:
- Parse it directly as structured data
- Use `--query` to extract specific fields (JMESPath syntax)
- Use `--format table` for human-readable display

**JMESPath examples:**
```bash
# Extract all IDs
--query "results[*].id"

# Filter by field value
--query "items[?status == 'active']"

# Get nested field
--query "data.user.email"

# Count results
--query "length(items)"
```

---

## Complete Workflow Example

```bash
# 1. Discover all capabilities (single call)
ucli introspect --output json

# 2. List available services
ucli listoas

# 3. Inspect a service's API operations
ucli oas payments listapi

# 4. Get detailed info about a specific API
ucli oas payments apiinfo createCharge

# 5. Preview a request (dry-run, no execution)
ucli oas payments invokeapi createCharge --dry-run --data '{"amount": 9900, "currency": "USD"}'

# 6. Execute with structured output (--machine)
ucli oas payments invokeapi listTransactions --machine --query "transactions[*].{id:id,amount:amount,status:status}"

# 7. Get a specific transaction
ucli oas payments invokeapi getTransaction --params '{"transactionId": "txn_abc123"}'

# 8. Create a new charge
ucli oas payments invokeapi createCharge --data '{
  "amount": 9900,
  "currency": "USD",
  "customerId": "cus_xyz789",
  "description": "Monthly subscription"
}'

# 9. MCP: inspect a tool's parameters, then call it
ucli mcp weather toolinfo get_forecast --json
ucli mcp weather invoketool get_forecast --data '{"location": "New York", "units": "metric"}'
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Authentication failed` | Token expired or invalid | Run `ucli configure --server <url> --token <jwt>` |
| `Unknown service: <name>` | Service not registered | Run `ucli listoas` to see valid names |
| `400 Bad Request` | Invalid parameters | Check operation signature with `ucli oas <service> apiinfo <api>` |
| `404 Not Found` | Resource doesn't exist | Verify the resource ID |
| `429 Too Many Requests` | Rate limit exceeded | Wait and retry |
| `5xx Server Error` | Upstream service error | Retry once; if persistent, report to the service owner |

### Error Recovery Strategy for Agents

1. **Parse the exit code** — non-zero means failure (codes 1–7 have specific meanings)
2. **When using `--output json`** — check `success` field; on failure read `error.hint`
3. **Retry logic** — on `code: 5` (connectivity) or `code: 7` (server error), retry once after a brief wait
4. **Re-discover** — on `code: 6` (not found), re-run `ucli introspect` to refresh your capability model

**On persistent errors:**
```bash
# Refresh the local OAS cache (may resolve stale spec issues)
ucli refresh

# Run diagnostics
ucli doctor --output json

# Then retry the operation
ucli oas <service> invokeapi <api>
```

---

## MCP Server Tools

In addition to OpenAPI services, ucli can interact with MCP (Model Context Protocol) servers. Auth credentials (`http_headers` or `env`) are injected programmatically — they are never passed as CLI arguments (which would be visible in `ps`).

### Workflow

```bash
# Step 1: Discover available MCP servers
ucli listmcp

# Step 2: Inspect a server's available tools
ucli mcp <server-name> listtool

# Step 3: Describe a specific tool's schema (parameters, types)
ucli mcp <server-name> toolinfo <tool-name>

# Step 4: Run a tool (pass arguments as JSON with --data)
ucli mcp <server-name> invoketool <tool-name> --data <json>
```

### Commands

| Command | Description |
|---------|-------------|
| `ucli listmcp` | List all MCP servers available to your group |
| `ucli mcp <server> listtool` | List tools available on the server |
| `ucli mcp <server> toolinfo <tool>` | Show detailed parameter schema for a tool |
| `ucli mcp <server> invoketool <tool> --data <json>` | Execute a tool on the server |

### Tool Introspection (`mcp toolinfo`)

Before calling a tool, use `mcp toolinfo` to discover its parameters:

```bash
# Human-readable description
ucli mcp weather toolinfo get_forecast

# JSON schema (for agent consumption)
ucli mcp weather toolinfo get_forecast --json
```

### JSON Input Mode (`--data`)

Pass tool arguments as a JSON object with `--data`:

```bash
ucli mcp weather invoketool get_forecast --data '{"location": "New York", "units": "metric"}'
```

### JSON Output Mode (`--json`)

Use `--json` on `mcp invoketool` to get structured JSON envelope output:

```bash
ucli mcp weather invoketool get_forecast --json --data '{"location": "New York"}'
```

### Examples

```bash
# List available MCP servers
ucli listmcp

# See what tools are available on "weather" server
ucli mcp weather listtool

# Describe the get_forecast tool's parameters
ucli mcp weather toolinfo get_forecast

# Call the get_forecast tool with JSON input
ucli mcp weather invoketool get_forecast --data '{"location": "New York", "units": "metric"}'

# Call a search tool with structured JSON output
ucli mcp search-server invoketool web_search --json --data '{"query": "ucli documentation", "limit": 5}'
```

---

## Tips for AI Agents

1. **Start with `ucli introspect`.** This gives you a complete picture of all services, MCP servers, and available commands in a single call. Don't make multiple discovery calls when one will do.

2. **Always use `--output json`.** This wraps every result in `{ success: true, data }` or `{ success: false, error }`. Never parse human-readable text output.

3. **Use `--machine` for operation execution.** When running API operations, use `--machine` to get structured envelope output with metadata (timing, method, path). This is more reliable than parsing raw API responses.

4. **Preview before mutating with `--dry-run`.** Before making POST/PUT/DELETE calls, use `--dry-run` to verify the request URL, headers, and body without actually executing. This prevents accidental mutations.

5. **Use `--query` to extract.** Instead of parsing the entire response, use JMESPath to extract exactly what you need.

6. **Use `mcp toolinfo` before `mcp invoketool`.** Use `ucli mcp <server> toolinfo <tool> --json` to discover a tool's full parameter schema before calling it. This avoids parameter errors.

7. **Use `--data` for tool/API calls.** When calling MCP tools or OAS APIs programmatically, prefer `--data '{"key": "value"}'` to pass arguments as JSON. JSON input is more reliable for complex or nested arguments.

8. **Chain operations.** Use the output of one operation as input to the next:
   ```bash
   # Get customer ID, then create a charge
   CUSTOMER_ID=$(ucli oas crm invokeapi findCustomer --params '{"email":"user@example.com"}' --query "id" | tr -d '"')
   ucli oas payments invokeapi createCharge --data "{\"customerId\": \"$CUSTOMER_ID\", \"amount\": 1000}"
   ```

9. **Check pagination.** Large result sets may be paginated. Look for `nextPage`, `cursor`, or `Link` headers in the response.

10. **Use exit codes for control flow.** Exit code `0` = success, non-zero = failure. Use `--output json` for richer error context.

11. **Re-introspect on capability changes.** If you encounter a `not found` error for a service that should exist, run `ucli refresh` then `ucli introspect` to refresh your model of available capabilities.
