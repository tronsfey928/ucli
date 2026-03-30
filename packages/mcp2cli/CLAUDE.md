# mcp2cli / ucli — Anthropic Skill

> Universal CLI proxy for any MCP (Model Context Protocol) server.
> Call MCP tools directly from the terminal.

## Installation

Install locally in your working directory:

```bash
npm install @tronsfey/mcp2cli
```

After installation, use `npx ucli` (or `npx mcp2cli`) to run commands:

```bash
npx ucli --help
```

## Quick Reference

### Connect to an MCP server

```bash
# HTTP/SSE server
npx ucli --mcp <url> --list

# Stdio server (spawns local process)
npx ucli --mcp-stdio "<command>" --list
```

### List available tools

```bash
npx ucli --mcp <url> --list
```

### Get detailed help for a tool (shows parameter names, types, descriptions)

```bash
npx ucli --mcp <url> --describe <tool-name>
```

### Call a tool

```bash
npx ucli --mcp <url> <tool-name> --<param> <value>
```

### Pass arguments as JSON (recommended for agents)

```bash
npx ucli --mcp <url> <tool-name> --input-json '{"key": "value"}'
```

### Machine-readable JSON output

```bash
npx ucli --mcp <url> --list --json
npx ucli --mcp <url> <tool-name> --json --input-json '{"key": "value"}'
```

### Debug connection issues

```bash
npx ucli --mcp <url> --list --debug
```

## Key Options

| Option | Description |
|---|---|
| `--mcp <url>` | MCP HTTP/SSE server URL |
| `--mcp-stdio <command>` | MCP stdio server command |
| `--list` | List available tools |
| `--describe <tool>` | Show detailed tool schema with parameter descriptions |
| `--json` | Machine-readable JSON output |
| `--input-json <json>` | Pass tool arguments as a JSON object |
| `--debug` | Show debug information during connection and execution |
| `--raw` | Output raw JSON |
| `--jq <expression>` | Filter output with JMESPath expression |
| `--no-cache` | Bypass tool list cache |

## Saved Shortcuts (Bakes)

Save server configs and reuse them with `@name`:

```bash
# Save a server
npx ucli bake create myserver --mcp https://server.example.com/mcp

# Use it
npx ucli @myserver --list
npx ucli @myserver <tool-name> --<param> <value>
```

## Agent Integration Tips

- Use `--json` mode for structured output with `{ok: true, result: ...}` envelope
- Use `--describe <tool>` to introspect tool parameters before calling
- Use `--input-json` to pass arguments as JSON instead of CLI flags
- Use `--debug` to diagnose connection failures
- Exit codes: 0=OK, 1=General, 2=Connection, 3=ToolNotFound, 4=InvalidArgs, 5=ToolExecution
