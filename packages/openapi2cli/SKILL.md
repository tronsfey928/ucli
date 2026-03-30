---
name: openapi2cli
description: >-
  Use this skill to interact with any OpenAPI 3.x API from the command line
  without code generation. Invoke when the user wants to call API operations,
  inspect endpoints, or automate requests against an OpenAPI-described service.
  Supports structured JSON output for agent consumption via --machine flag.
allowed-tools: Bash(npx ucli *), Bash(npx openapi2cli *)
argument-hint: "[describe the API call you want to make]"
---

# openapi2cli — Proxy Mode Skill

Call any OpenAPI 3.x endpoint directly from the command line, with structured
JSON output for reliable agent consumption.

## Setup

Install locally in the current working directory:

```bash
npm install @tronsfey/openapi2cli
```

After installation, use `npx ucli` (short alias) or `npx openapi2cli` to run
commands. All examples below use `npx ucli` for brevity.

## Workflow

### Step 1: Discover available operations

```bash
npx ucli run --oas <spec-path-or-url> --machine
```

Returns a JSON envelope listing all groups, operations, methods, and paths.

### Step 2: Inspect a specific operation (help)

```bash
npx ucli run --oas <spec> --machine help <group> <operation>
# or equivalently:
npx ucli run --oas <spec> --machine describe <group> <operation>
```

Returns full parameter details (name, type, required, enum, default),
request body schema, response schema, authentication requirements, and an
example command line.

### Step 3: Preview the request (dry-run)

```bash
npx ucli run --oas <spec> --dry-run <group> <operation> --param value
```

Returns the planned HTTP request (method, URL, headers, query params, body)
without actually sending it. Useful for validation before execution.

### Step 4: Execute the operation

```bash
npx ucli run --oas <spec> --machine <group> <operation> --param value
```

Returns the API response wrapped in a structured JSON envelope with timing
metadata.

### Step 5: Debug connectivity issues

If the API service is unreachable or behaving unexpectedly, add `--debug`:

```bash
npx ucli run --oas <spec> --machine --debug <group> <operation> --param value
```

Debug mode prints detailed diagnostic output to stderr, including spec loading
progress, resolved base URL, request parameters, and error stack traces.

## Authentication

```bash
# Bearer token
npx ucli run --oas <spec> --bearer <token> ...

# API key
npx ucli run --oas <spec> --api-key <key> [--api-key-header <header>] ...

# HTTP Basic
npx ucli run --oas <spec> --basic <user:password> ...

# Custom headers
npx ucli run --oas <spec> --header "X-Custom: value" ...
```

## Request Body

```bash
# Individual fields
npx ucli run --oas <spec> <group> <operation> --field-a value --field-b value

# Raw JSON
npx ucli run --oas <spec> <group> <operation> --data '{"key": "value"}'

# JSON from file
npx ucli run --oas <spec> <group> <operation> --data @payload.json
```

## Output Options

```bash
# Table format (human-friendly)
npx ucli run --oas <spec> <group> <operation> --format table

# YAML format
npx ucli run --oas <spec> <group> <operation> --format yaml

# JMESPath filter
npx ucli run --oas <spec> --machine <group> <operation> --query 'items[?status==`active`]'

# Auto-paginate
npx ucli run --oas <spec> <group> <operation> --all-pages
```

## JSON Envelope Format

Every `--machine` response follows this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "operation": "get-item",
    "method": "GET",
    "path": "/items/{id}",
    "baseUrl": "https://api.example.com",
    "durationMs": 42
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "type": "HttpClientError",
    "message": "[HTTP 404 Not Found] ...",
    "statusCode": 404,
    "hint": "Endpoint not found — verify the operation name and path params"
  }
}
```

## Tips

- Always use `--machine` when processing output programmatically.
- Use `help` or `describe` before calling an operation to understand its
  parameters, especially required ones.
- Use `--dry-run` to validate the request shape before sending.
- Use `--debug` when encountering connectivity or parsing errors.
- Use `--no-cache` if the spec has been updated recently.
