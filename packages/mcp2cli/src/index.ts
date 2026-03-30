#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createMcpClient } from './client/index';
import {
  getTools,
  printToolList,
  printToolListJson,
  describeTool,
  describeToolJson,
  emitJsonError,
  runTool,
} from './runner/index';
import { getBake, configToArgs } from './bake';
import {
  GlobalOptions,
  EXIT_CONNECTION,
  EXIT_GENERAL,
  EXIT_TOOL_NOT_FOUND,
  EXIT_INVALID_ARGS,
} from './types/index';
import { buildServerConfig, resolveCacheTtl, suggestToolNames } from './config';
import { buildBakeCommand } from './commands/bake';
import { buildCompletionCommand } from './commands/completion';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };

// --------------------------------------------------------------------------
// @name shortcut resolution: rewrite argv before parsing
// --------------------------------------------------------------------------
async function resolveAtShortcut(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || !args[0].startsWith('@')) return;

  const bakeName = args[0].slice(1);
  const entry = await getBake(bakeName);
  if (!entry) {
    console.error(chalk.red(`No bake found for "@${bakeName}". Use 'mcp2cli bake list' to see saved configs.`));
    process.exit(EXIT_GENERAL);
  }
  // Replace @name with the equivalent --mcp / --mcp-stdio flags
  process.argv.splice(2, 1, ...configToArgs(entry.config));
}

// --------------------------------------------------------------------------
// Main program
// --------------------------------------------------------------------------
async function main(): Promise<void> {
  await resolveAtShortcut();

  const program = new Command('mcp2cli');
  program
    .description('Command-line proxy for any MCP server')
    .version(pkg.version)
    .enablePositionalOptions()
    .option('--mcp <url>', 'MCP HTTP/SSE server URL')
    .option('--mcp-stdio <command>', 'MCP stdio server command')
    .option('--env <KEY=VALUE...>', 'Environment variables for stdio server')
    .option('--header <Header: Value...>', 'Custom HTTP headers for HTTP server')
    .option('-l, --list', 'List available tools and exit')
    .option('--json', 'Machine-readable JSON output (for agent integration)')
    .option('--describe <tool>', 'Show detailed schema for a specific tool as JSON')
    .option('--input-json <json>', 'Pass tool arguments as a JSON object')
    .option('--pretty', 'Pretty-print output (default)')
    .option('--raw', 'Output raw JSON')
    .option('--jq <expression>', 'Filter output with JMESPath expression')
    .option('--no-cache', 'Bypass tool list cache')
    .option('--cache-ttl <seconds>', 'Cache TTL in seconds', '3600')
    .option('--debug', 'Show debug information during connection and execution')
    .allowUnknownOption(true)
    .addCommand(buildBakeCommand())
    .addCommand(buildCompletionCommand());

  program.action(async (_opts: GlobalOptions, cmd: Command) => {
    const opts = cmd.opts<GlobalOptions>();
    const jsonMode = !!opts.json;

    if (!opts.mcp && !opts.mcpStdio) {
      program.help();
      return;
    }

    const config = buildServerConfig({
      mcp: opts.mcp,
      mcpStdio: opts.mcpStdio,
      env: opts.env,
      header: opts.header,
    });

    const noCache = opts.cache === false;
    const cacheTtl = resolveCacheTtl(opts.cacheTtl);
    const debug = !!opts.debug;

    // In JSON mode suppress the spinner so stdout stays clean for machine parsing
    const spinner = jsonMode ? null : ora('Connecting to MCP server…').start();
    let client;
    try {
      client = await createMcpClient(config, debug);
      spinner?.succeed('Connected');
    } catch (err) {
      if (debug) {
        console.error(chalk.gray(`[debug] Connection error details: ${(err as Error).stack ?? (err as Error).message}`));
      }
      if (jsonMode) {
        emitJsonError('CONNECTION_FAILED', (err as Error).message, EXIT_CONNECTION);
        process.exit(EXIT_CONNECTION);
      }
      spinner?.fail(`Connection failed: ${(err as Error).message}`);
      process.exit(EXIT_CONNECTION);
    }

    let closed = false;
    const safeClose = async () => {
      if (closed) return;
      closed = true;
      try {
        await client?.close();
      } catch {
        // Ignore errors during cleanup
      }
    };

    const cleanup = async () => {
      await safeClose();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
      const tools = await getTools(client, config, { noCache, cacheTtl, debug });

      // --describe <tool>: show detailed schema for a single tool
      if (opts.describe) {
        const tool = tools.find((t) => t.name === opts.describe);
        if (!tool) {
          const names = tools.map((t) => t.name);
          const suggestions = suggestToolNames(opts.describe, names);
          const msg = `Unknown tool "${opts.describe}".`;
          if (jsonMode) {
            emitJsonError('TOOL_NOT_FOUND', msg, EXIT_TOOL_NOT_FOUND, suggestions.length ? suggestions : undefined);
            process.exit(EXIT_TOOL_NOT_FOUND);
          }
          let humanMsg = msg;
          if (suggestions.length > 0) {
            humanMsg += ` Did you mean: ${suggestions.join(', ')}?`;
          }
          humanMsg += ' Use --list to see available tools.';
          console.error(chalk.red(humanMsg));
          process.exit(EXIT_TOOL_NOT_FOUND);
        }
        if (jsonMode) {
          describeToolJson(tool);
        } else {
          describeTool(tool);
        }
        return;
      }

      // --list: display available tools
      if (opts.list) {
        if (jsonMode) {
          printToolListJson(tools);
        } else {
          printToolList(tools);
        }
        return;
      }

      // The first unknown arg is the tool name
      const remaining = cmd.args;
      const toolName = remaining[0];

      if (!toolName) {
        const msg = 'Tool name required. Use --list to see available tools.';
        if (jsonMode) {
          emitJsonError('TOOL_NAME_REQUIRED', msg, EXIT_INVALID_ARGS);
          process.exit(EXIT_INVALID_ARGS);
        }
        console.error(chalk.red(`Error: ${msg}`));
        process.exit(EXIT_INVALID_ARGS);
      }

      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        const names = tools.map((t) => t.name);
        const suggestions = suggestToolNames(toolName, names);
        let msg = `Unknown tool "${toolName}".`;
        if (jsonMode) {
          emitJsonError('TOOL_NOT_FOUND', msg, EXIT_TOOL_NOT_FOUND, suggestions.length ? suggestions : undefined);
          process.exit(EXIT_TOOL_NOT_FOUND);
        }
        if (suggestions.length > 0) {
          msg += ` Did you mean: ${suggestions.join(', ')}?`;
        }
        msg += ' Use --list to see available tools.';
        console.error(chalk.red(msg));
        process.exit(EXIT_TOOL_NOT_FOUND);
      }

      await runTool(client, tool, remaining.slice(1), {
        raw: opts.raw,
        json: jsonMode,
        jq: opts.jq,
        inputJson: opts.inputJson,
      });
    } finally {
      await safeClose();
    }
  });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`Fatal error: ${message}`));
  process.exit(EXIT_GENERAL);
});
