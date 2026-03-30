# mcp2cli

> Command-line proxy for any MCP (Model Context Protocol) server — call tools directly from the terminal.

A Node.js/TypeScript CLI tool that connects to MCP servers and exposes their tools as command-line commands. Supports both HTTP/SSE and stdio transports, with tool list caching and named server shortcuts ("bakes").

Inspired by [knowsuchagency/mcp2cli](https://github.com/knowsuchagency/mcp2cli).

---

## Installation

```bash
npm install -g @tronsfey/mcp2cli
# or run directly
npx @tronsfey/mcp2cli --help
```

The package also provides a `ucli` alias:

```bash
npx ucli --help
```

---

## Quick Start

### Connect to an HTTP/SSE MCP server

```bash
# List all available tools
mcp2cli --mcp https://server.example.com/mcp --list

# Call a tool
mcp2cli --mcp https://server.example.com/mcp search --query "hello world"
```

### Connect to a local stdio MCP server

```bash
# Spawn a local server and list its tools
mcp2cli --mcp-stdio "npx -y @modelcontextprotocol/server-filesystem /" --list

# Call a tool on the local server
mcp2cli --mcp-stdio "npx -y @modelcontextprotocol/server-filesystem /" \
  list-directory --path /tmp
```

---

## Usage

```
mcp2cli [options] [tool-name] [tool-options]

Options:
  --mcp <url>              MCP HTTP/SSE server URL
  --mcp-stdio <command>    MCP stdio server command (spawns local process)
  --env <KEY=VALUE...>     Extra environment variables for stdio server
  --header <Header:Value>  Custom HTTP headers (can repeat)
  -l, --list               List available tools and exit
  --describe <tool>        Show detailed tool schema (parameters, types, descriptions)
  --json                   Machine-readable JSON output (for agent integration)
  --input-json <json>      Pass tool arguments as a JSON object
  --pretty                 Pretty-print output (default)
  --raw                    Output raw JSON
  --jq <expression>        Filter output with JMESPath expression
  --no-cache               Bypass tool list cache
  --cache-ttl <seconds>    Cache TTL in seconds (default: 3600)
  --debug                  Show debug information during connection and execution
  -V, --version            Output version
  -h, --help               Show help

Commands:
  bake                     Manage saved server configurations
  completion [shell]       Output shell completion script (bash|zsh|fish)
```

---

## Bake — Save Server Shortcuts

Save a server configuration once and reference it with `@name`:

```bash
# Save an HTTP server
mcp2cli bake create myserver --mcp https://server.example.com/mcp
mcp2cli bake create myserver --mcp https://server.example.com/mcp \
  --header "Authorization: Bearer TOKEN"

# Save a local stdio server
mcp2cli bake create localfs --mcp-stdio "npx -y @modelcontextprotocol/server-filesystem /"

# List saved bakes
mcp2cli bake list

# Delete a bake
mcp2cli bake delete myserver

# Use a saved bake
mcp2cli @myserver --list
mcp2cli @localfs list-directory --path /tmp
```

Bakes are stored in `~/.mcp2cli/bakes.json`.

---

## Tool Help

View detailed parameter information for any tool, including types, required/optional status, and descriptions:

```bash
# Human-readable tool description
mcp2cli --mcp <url> --describe <tool-name>

# JSON tool schema (for agent consumption)
mcp2cli --mcp <url> --describe <tool-name> --json
```

The `--list` command also displays full parameter details for all tools.

---

## Debugging

Use `--debug` to see detailed connection and execution information. Useful when MCP servers are unavailable or returning unexpected errors:

```bash
mcp2cli --mcp <url> --list --debug
```

Debug output includes:
- Transport selection (Streamable HTTP → SSE fallback)
- Connection success/failure details with stack traces
- Cache hit/miss information
- Tool list fetching details

---

## Output Formatting

```bash
# Default: pretty-print text content from tool result
mcp2cli --mcp <url> <tool> [args]

# Raw JSON output
mcp2cli --mcp <url> <tool> [args] --raw

# Filter with JMESPath
mcp2cli --mcp <url> <tool> [args] --jq 'results[*].name'
```

---

## Caching

Tool lists are cached per server (default TTL: 1 hour) to speed up repeated invocations.

```bash
# Bypass cache
mcp2cli --mcp <url> --list --no-cache

# Custom TTL (5 minutes)
mcp2cli --mcp <url> --list --cache-ttl 300
```

Cache files are stored in `~/.mcp2cli/cache/`.

---

## Authentication

### HTTP server with Bearer token

```bash
mcp2cli --mcp https://server.example.com/mcp \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --list
```

### stdio server with environment variables

```bash
mcp2cli --mcp-stdio "node server.js" \
  --env "API_KEY=secret" \
  --env "DB_URL=postgres://localhost/mydb" \
  <tool-name> [args]
```

---

## Shell Completion

```bash
# Bash
mcp2cli completion bash >> ~/.bashrc
source ~/.bashrc

# Zsh
mcp2cli completion zsh >> ~/.zshrc
source ~/.zshrc

# Fish
mcp2cli completion fish > ~/.config/fish/completions/mcp2cli.fish
```

---

## Architecture

```
CLI invocation
    │
    ▼
Resolve @name shortcut (bake lookup)
    │
    ▼
Parse global options (Commander.js)
    │
    ├─► --list ──► Connect → listTools() → print → exit
    │
    └─► tool-name
            │
            ▼
        createMcpClient()         [src/client/]
        (HTTP Streamable → SSE fallback | stdio)
            │
            ▼
        getTools()                [src/runner/ + src/cache.ts]
        (cache lookup → listTools() → cache write)
            │
            ▼
        schemaToParams()          [JSON Schema → ToolParam[]]
            │
            ▼
        Parse tool-specific args  [dynamic Commander subcommand]
            │
            ▼
        client.callTool()
            │
            ▼
        Format & print result     [--raw / --jq / pretty]
```

---

## Anthropic Skill (CLAUDE.md)

The repository includes a `CLAUDE.md` file — an Anthropic skill that enables AI agents (e.g., Claude) to use mcp2cli effectively. The skill provides:

- Installation instructions (local `npm install` + `npx ucli`)
- Quick reference for all key operations
- Agent integration tips (JSON mode, exit codes, parameter introspection)

To use with an agent, install locally in your working directory:

```bash
npm install @tronsfey/mcp2cli
npx ucli --help
```

---

## Development

```bash
git clone https://github.com/tronsfey928/mcp2cli.git
cd mcp2cli
npm install
npm run build
npm test

# Run directly without building
npm run dev -- --help
```

---

## License

MIT
