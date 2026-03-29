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
2. **Orient** — Understand specific operations with `ucli services info <name>` or `ucli mcp tools <server>`
3. **Decide** — Choose the right operation and parameters based on the task
4. **Act** — Execute with `ucli run` or `ucli mcp run`

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
      { "name": "run", "description": "...", "usage": "...", "examples": [...] }
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
{ "success": false, "error": { "code": 6, "message": "Service not found: foo", "hint": "Run: ucli services list" } }
```

Error codes: `0`=success, `1`=general, `2`=usage, `3`=config, `4`=auth, `5`=connectivity, `6`=not-found, `7`=server-error.

**Always use `--output json` when calling ucli from code or as an AI agent.** This ensures you can reliably parse both success and error results.

---

## Step 1 — Discover Available Services

```bash
ucli services list
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
ucli services list --output json
```

---

## Step 2 — Inspect a Service's Operations

```bash
ucli services info <service-name>
```

Shows all available operations, their parameters, and expected inputs.

**Example:**
```bash
ucli services info payments
```

---

## Step 3 — Execute an Operation

```bash
ucli run <service> <operation> [options]
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
ucli run payments listTransactions --machine
# → { "success": true, "data": {...}, "meta": { "durationMs": 42 } }

# Structured error output
ucli run payments getTransaction --transactionId invalid --machine
# → { "success": false, "error": { "type": "HttpClientError", "message": "...", "statusCode": 404 } }
```

### Dry-Run Mode (`--dry-run`)

Preview the HTTP request that *would* be sent, without actually executing it:

```bash
ucli run payments createCharge --dry-run --data '{"amount": 5000, "currency": "USD"}'
# → { "method": "POST", "url": "https://api.example.com/charges", "headers": {...}, "body": {...} }
```

This is useful for verifying parameters before making destructive or costly API calls.

### Examples

**List resources (GET):**
```bash
ucli run payments listTransactions --format json
```

**Filter response:**
```bash
ucli run inventory listProducts --query "items[?stock > \`0\`].name"
```

**Create a resource (POST):**
```bash
ucli run payments createCharge --data '{"amount": 5000, "currency": "USD", "customerId": "cus_123"}'
```

**Update a resource (PUT/PATCH):**
```bash
ucli run crm updateContact --data '{"email": "new@example.com"}' --contactId abc123
```

**Get a specific resource:**
```bash
ucli run inventory getProduct --productId SKU-001
```

---

## Step 4 — Process the Output

By default, `ucli run` returns JSON. You can:
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

# 2. Inspect a specific service's operations
ucli services info payments --output json

# 3. Preview a request (dry-run, no execution)
ucli run payments createCharge --dry-run --data '{"amount": 9900, "currency": "USD"}'

# 4. Execute with structured output (--machine)
ucli run payments listTransactions --machine --query "transactions[*].{id:id,amount:amount,status:status}"

# 5. Get a specific transaction
ucli run payments getTransaction --transactionId txn_abc123

# 6. Create a new charge
ucli run payments createCharge --data '{
  "amount": 9900,
  "currency": "USD",
  "customerId": "cus_xyz789",
  "description": "Monthly subscription"
}'

# 7. MCP: describe a tool's parameters, then call it
ucli mcp describe weather get_forecast --json
ucli mcp run weather get_forecast --input-json '{"location": "New York", "units": "metric"}'
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Authentication failed` | Token expired or invalid | Run `ucli configure --server <url> --token <jwt>` |
| `Unknown service: <name>` | Service not registered | Run `ucli services list` to see valid names |
| `400 Bad Request` | Invalid parameters | Check operation signature with `ucli services info <service>` |
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
ucli run <service> <operation>
```

---

## MCP Server Tools

In addition to OpenAPI services, ucli can interact with MCP (Model Context Protocol) servers. Auth credentials (`http_headers` or `env`) are injected programmatically — they are never passed as CLI arguments (which would be visible in `ps`).

### Workflow

```bash
# Step 1: Discover available MCP servers
ucli mcp list

# Step 2: Inspect a server's available tools
ucli mcp tools <server-name>

# Step 3: Describe a specific tool's schema (parameters, types)
ucli mcp describe <server-name> <tool-name>

# Step 4: Run a tool (args as key=value pairs)
ucli mcp run <server-name> <tool-name> [key=value ...]
```

### Commands

| Command | Description |
|---------|-------------|
| `ucli mcp list` | List all MCP servers available to your group |
| `ucli mcp tools <server>` | List tools available on the server |
| `ucli mcp describe <server> <tool>` | Show detailed parameter schema for a tool |
| `ucli mcp run <server> <tool> [args...]` | Execute a tool on the server |

### Tool Introspection (`mcp describe`)

Before calling a tool, use `mcp describe` to discover its parameters:

```bash
# Human-readable description
ucli mcp describe weather get_forecast

# JSON schema (for agent consumption)
ucli mcp describe weather get_forecast --json
```

### JSON Input Mode (`--input-json`)

For agent callers, use `--input-json` to pass tool arguments as a JSON object (bypasses CLI flag parsing):

```bash
ucli mcp run weather get_forecast --input-json '{"location": "New York", "units": "metric"}'
```

### JSON Output Mode (`--json`)

Use `--json` on `mcp run` to get structured JSON envelope output:

```bash
ucli mcp run weather get_forecast --json location="New York"
```

### Examples

```bash
# List available MCP servers
ucli mcp list

# See what tools are available on "weather" server
ucli mcp tools weather

# Describe the get_forecast tool's parameters
ucli mcp describe weather get_forecast

# Call the get_forecast tool with key=value arguments
ucli mcp run weather get_forecast location="New York" units=metric

# Call with JSON input (preferred for agents)
ucli mcp run weather get_forecast --input-json '{"location": "New York", "units": "metric"}'

# Call a search tool with structured JSON output
ucli mcp run search-server web_search --json query="ucli documentation" limit=5
```

---

## Tips for AI Agents

1. **Start with `ucli introspect`.** This gives you a complete picture of all services, MCP servers, and available commands in a single call. Don't make multiple discovery calls when one will do.

2. **Always use `--output json`.** This wraps every result in `{ success: true, data }` or `{ success: false, error }`. Never parse human-readable text output.

3. **Use `--machine` for operation execution.** When running API operations, use `--machine` to get structured envelope output with metadata (timing, method, path). This is more reliable than parsing raw API responses.

4. **Preview before mutating with `--dry-run`.** Before making POST/PUT/DELETE calls, use `--dry-run` to verify the request URL, headers, and body without actually executing. This prevents accidental mutations.

5. **Use `--query` to extract.** Instead of parsing the entire response, use JMESPath to extract exactly what you need.

6. **Use `mcp describe` before `mcp run`.** Use `ucli mcp describe <server> <tool> --json` to discover a tool's full parameter schema before calling it. This avoids parameter errors.

7. **Use `--input-json` for MCP tool calls.** When calling MCP tools programmatically, prefer `--input-json '{"key": "value"}'` over `key=value` pairs. JSON input is more reliable for complex or nested arguments.

8. **Chain operations.** Use the output of one operation as input to the next:
   ```bash
   # Get customer ID, then create a charge
   CUSTOMER_ID=$(ucli run crm findCustomer --email user@example.com --query "id" | tr -d '"')
   ucli run payments createCharge --data "{\"customerId\": \"$CUSTOMER_ID\", \"amount\": 1000}"
   ```

9. **Check pagination.** Large result sets may be paginated. Look for `nextPage`, `cursor`, or `Link` headers in the response.

10. **Use exit codes for control flow.** Exit code `0` = success, non-zero = failure. Use `--output json` for richer error context.

11. **Re-introspect on capability changes.** If you encounter a `not found` error for a service that should exist, run `ucli refresh` then `ucli introspect` to refresh your model of available capabilities.
