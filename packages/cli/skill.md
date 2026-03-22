# OAS CLI Skill

## Overview

Use `oas-cli` whenever you need to call any external business API. This tool:
- Proxies registered OpenAPI services on your behalf
- Handles authentication automatically (credentials are never exposed to you)
- Returns structured JSON output suitable for further processing

**When to use:** Any time you need to interact with external services (business APIs, data sources, microservices). Always check available services first with `oas-cli services list`.

---

## Step 1 — Discover Available Services

```bash
oas-cli services list
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
oas-cli services info <service-name>
```

Shows all available operations, their parameters, and expected inputs.

**Example:**
```bash
oas-cli services info payments
```

---

## Step 3 — Execute an Operation

```bash
oas-cli run <service> <operation> [options]
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
oas-cli run payments listTransactions --format json
```

**Filter response:**
```bash
oas-cli run inventory listProducts --query "items[?stock > \`0\`].name"
```

**Create a resource (POST):**
```bash
oas-cli run payments createCharge --data '{"amount": 5000, "currency": "USD", "customerId": "cus_123"}'
```

**Update a resource (PUT/PATCH):**
```bash
oas-cli run crm updateContact --data '{"email": "new@example.com"}' --contactId abc123
```

**Get a specific resource:**
```bash
oas-cli run inventory getProduct --productId SKU-001
```

---

## Step 4 — Process the Output

By default, `oas-cli run` returns JSON. You can:
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
oas-cli services list

# 2. Check what operations are available on "payments"
oas-cli services info payments

# 3. List recent transactions
oas-cli run payments listTransactions --query "transactions[*].{id:id,amount:amount,status:status}"

# 4. Get a specific transaction
oas-cli run payments getTransaction --transactionId txn_abc123

# 5. Create a new charge
oas-cli run payments createCharge --data '{
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
| `Authentication failed` | Token expired or invalid | Run `oas-cli configure --server <url> --token <jwt>` |
| `Unknown service: <name>` | Service not registered | Run `oas-cli services list` to see valid names |
| `400 Bad Request` | Invalid parameters | Check operation signature with `oas-cli services info <service>` |
| `404 Not Found` | Resource doesn't exist | Verify the resource ID |
| `429 Too Many Requests` | Rate limit exceeded | Wait and retry |
| `5xx Server Error` | Upstream service error | Retry once; if persistent, report to the service owner |

**On persistent errors:**
```bash
# Refresh the local OAS cache (may resolve stale spec issues)
oas-cli refresh

# Then retry the operation
oas-cli run <service> <operation>
```

---

## Tips for AI Agents

1. **Always discover first.** Don't guess service or operation names — run `oas-cli services list` then `oas-cli services info <name>`.

2. **Use JSON output.** Default `--format json` gives you machine-parseable data. Only switch to `table` when presenting to humans.

3. **Use `--query` to extract.** Instead of parsing the entire response, use JMESPath to extract exactly what you need.

4. **Chain operations.** Use the output of one operation as input to the next:
   ```bash
   # Get customer ID, then create a charge
   CUSTOMER_ID=$(oas-cli run crm findCustomer --email user@example.com --query "id" | tr -d '"')
   oas-cli run payments createCharge --data "{\"customerId\": \"$CUSTOMER_ID\", \"amount\": 1000}"
   ```

5. **Check pagination.** Large result sets may be paginated. Look for `nextPage`, `cursor`, or `Link` headers in the response.

6. **Validate before mutating.** For destructive operations (DELETE, large updates), confirm the resource exists and is correct before proceeding.
