<p align="center">
  <img src="../../assets/logo.svg" alt="OAS Gateway" width="480" />
</p>

# @tronsfey/oas-cli

CLI client for the OAS Gateway server. Provides AI agents with authenticated access to OpenAPI-described APIs — without exposing credentials.

## Quick Start

```bash
# Install globally
npm install -g @tronsfey/oas-cli

# Configure (get the server URL and JWT from your admin)
oas-cli configure --server http://localhost:3000 --token <group-jwt>

# List available services
oas-cli services list

# Run an operation (AI agent usage)
oas-cli run --service payments --operation getPet --params '{"petId":42}'
```

## Commands

### `configure`

Store the server URL and JWT token locally.

```bash
oas-cli configure --server <url> --token <jwt>
```

| Flag | Description |
|------|-------------|
| `--server` | OAS Gateway server URL |
| `--token` | Group JWT issued by the server admin |

Config is stored in the OS-appropriate config directory (e.g. `~/.config/oas-cli`).

---

### `services list`

List all OpenAPI services available to your group.

```bash
oas-cli services list [--format table|json|yaml] [--refresh]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--format` | `table` | Output format |
| `--refresh` | `false` | Bypass local cache and fetch from server |

Results are cached locally for the TTL specified by the server (per OAS entry).

---

### `run`

Execute a single API operation defined in an OpenAPI spec.

```bash
oas-cli run --service <name> --operation <operationId> [--params <json>]
```

| Flag | Description |
|------|-------------|
| `--service` | Service name (from `services list`) |
| `--operation` | `operationId` from the OpenAPI spec |
| `--params` | JSON string of parameters (path, query, body) |

Auth credentials are automatically injected from the server — the agent never sees tokens or API keys.

---

### `refresh`

Force-refresh the local OAS cache from the server.

```bash
oas-cli refresh [--service <name>]
```

---

### `help`

Show available commands and AI agent usage instructions.

```bash
oas-cli help
```

## Configuration

Config is managed via the `configure` command. Stored values:

| Key | Description |
|-----|-------------|
| `serverUrl` | OAS Gateway server URL |
| `token` | Group JWT for authentication |

Config location follows the XDG spec on Linux/macOS and `%APPDATA%` on Windows.

## Caching

- OAS entries are cached locally as JSON files
- Cache TTL is set per-entry by the server admin (`cacheTtl` field in seconds)
- Use `--refresh` or `oas-cli refresh` to bust the cache
- Cache directory: OS temp dir under `oas-cli/`

## Auth Handling

Auth credentials (API keys, bearer tokens, OAuth2 client secrets) are stored on the server, encrypted at rest. When you run an operation:

1. CLI fetches the OAS entry (including decrypted auth config) over TLS
2. Auth is injected as environment variables into the `@tronsfey/openapi2cli` subprocess
3. The subprocess uses the credentials to call the real API
4. Credentials are **never written to disk** or exposed to the AI agent process

## For AI Agents

When used as a skill by an AI agent, the recommended workflow is:

```bash
# 1. Discover available services
oas-cli services list --format json

# 2. Inspect a service's operations
oas-cli run --service <name> --operation listOperations

# 3. Execute an operation
oas-cli run --service payments --operation createPayment \
  --params '{"amount": 100, "currency": "USD", "recipient": "acct_123"}'
```

See `skill.md` in this package for the full AI agent skill definition.
