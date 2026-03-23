# ucli Skill

## Overview

Use `ucli` whenever you need to call any external business API or MCP server tool. This tool:
- Proxies registered OpenAPI services on your behalf
- Handles authentication automatically (credentials are never exposed to you)
- Returns structured JSON output suitable for further processing

**When to use:** Any time you need to interact with external services (business APIs, data sources, microservices). Always check available services first with `ucli services list`.

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
# 1. Discover services
ucli services list

# 2. Check what operations are available on "payments"
ucli services info payments

# 3. List recent transactions
ucli run payments listTransactions --query "transactions[*].{id:id,amount:amount,status:status}"

# 4. Get a specific transaction
ucli run payments getTransaction --transactionId txn_abc123

# 5. Create a new charge
ucli run payments createCharge --data '{
  "amount": 9900,
  "currency": "USD",
  "customerId": "cus_xyz789",
  "description": "Monthly subscription"
}'
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

**On persistent errors:**
```bash
# Refresh the local OAS cache (may resolve stale spec issues)
ucli refresh

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

# Step 3: Run a tool (args as key=value pairs)
ucli mcp run <server-name> <tool-name> [key=value ...]
```

### Commands

| Command | Description |
|---------|-------------|
| `ucli mcp list` | List all MCP servers available to your group |
| `ucli mcp tools <server>` | List tools available on the server |
| `ucli mcp run <server> <tool> [args...]` | Execute a tool on the server |

### Examples

```bash
# List available MCP servers
ucli mcp list

# See what tools are available on "weather" server
ucli mcp tools weather

# Call the get_forecast tool with arguments
ucli mcp run weather get_forecast location="New York" units=metric

# Call a search tool
ucli mcp run search-server web_search query="ucli documentation" limit=5
```

---

## Tips for AI Agents

1. **Always discover first.** Don't guess service or operation names — run `ucli services list` then `ucli services info <name>`.

2. **Use JSON output.** Default `--format json` gives you machine-parseable data. Only switch to `table` when presenting to humans.

3. **Use `--query` to extract.** Instead of parsing the entire response, use JMESPath to extract exactly what you need.

4. **Chain operations.** Use the output of one operation as input to the next:
   ```bash
   # Get customer ID, then create a charge
   CUSTOMER_ID=$(ucli run crm findCustomer --email user@example.com --query "id" | tr -d '"')
   ucli run payments createCharge --data "{\"customerId\": \"$CUSTOMER_ID\", \"amount\": 1000}"
   ```

5. **Check pagination.** Large result sets may be paginated. Look for `nextPage`, `cursor`, or `Link` headers in the response.

6. **Validate before mutating.** For destructive operations (DELETE, large updates), confirm the resource exists and is correct before proceeding.
