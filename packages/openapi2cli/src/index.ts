#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { parseOASWithCache } from './cache';
import { analyzeSchema } from './analyzer/schema-analyzer';
import { proxyRun, ProxyOpts } from './runner/proxy-runner';
import { runGenerate, GenerateOpts } from './commands/generate';
import { generateBashCompletion, generateZshCompletion, generateFishCompletion } from './completer';
import { OpenAPI2CLIError } from './errors';
import { version } from '../package.json';

const program = new Command();

program
  .name('openapi2cli')
  .description('Generate a typed CLI from an OpenAPI 3.x specification, or proxy one directly')
  .version(version)
  .enablePositionalOptions(true);

// ─── generate ────────────────────────────────────────────────────────────────

program
  .command('generate')
  .description('Generate a Commander.js CLI project from an OpenAPI spec')
  .requiredOption('--oas <path-or-url>', 'Path or URL to the OpenAPI spec file')
  .requiredOption('--name <cli-name>', 'Name for the generated CLI tool')
  .requiredOption('--output <dir>', 'Output directory for the generated project')
  .option('--overwrite', 'Overwrite output directory if it exists', false)
  .option('--no-cache', 'Bypass spec cache (always re-fetch remote specs)')
  .option('--cache-ttl <seconds>', 'Remote spec cache TTL in seconds', (v) => parseInt(v, 10), 3600)
  .action(async (opts: GenerateOpts) => {
    await runGenerate(opts);
  });

// ─── run (proxy mode) ────────────────────────────────────────────────────────

program
  .command('run', { isDefault: false })
  .description('Directly call an OpenAPI endpoint without generating code')
  .requiredOption('--oas <path-or-url>', 'Path or URL to the OpenAPI spec file')
  .option('--bearer <token>', 'Bearer token  →  Authorization: Bearer <token>')
  .option('--api-key <key>', 'API key value')
  .option('--api-key-header <header>', 'Header name for API key (default: X-Api-Key)', 'X-Api-Key')
  .option('--basic <credentials>', 'HTTP Basic credentials (user:password)')
  .option('--header <header>', 'Extra HTTP header "Name: Value" (repeatable)', collect, [])
  .option('--endpoint <url>', 'Override base URL from the spec')
  .option('--timeout <ms>', 'Request timeout in milliseconds', (v) => parseInt(v, 10), 30000)
  .option('--retries <n>', 'Max retry attempts for 5xx/network errors', (v) => parseInt(v, 10), 3)
  .option('--no-cache', 'Bypass spec cache (always re-fetch remote specs)')
  .option('--cache-ttl <seconds>', 'Remote spec cache TTL in seconds', (v) => parseInt(v, 10), 3600)
  .option('--machine', 'Agent-friendly mode: all output as structured JSON envelopes to stdout', false)
  .option('--dry-run', 'Preview the HTTP request without executing it (implies --machine)', false)
  .option('--debug', 'Show detailed diagnostic output (spec loading, HTTP request/response)', false)
  .allowUnknownOption(true)
  .passThroughOptions(true)
  .action(async function (this: Command, opts: ProxyOpts & { cache: boolean }) {
    // Commander uses `cache: false` when user passes --no-cache
    const proxyOpts: ProxyOpts = { ...opts, noCache: opts.cache === false };
    const remaining: string[] = this.args;
    await proxyRun(proxyOpts, remaining);
  });

// ─── completion ──────────────────────────────────────────────────────────────

program
  .command('completion [shell]')
  .description('Output shell completion script (bash, zsh, fish)')
  .action((shell: string | undefined) => {
    const s = (shell ?? 'bash').toLowerCase();
    if (s === 'bash') {
      process.stdout.write(generateBashCompletion());
    } else if (s === 'zsh') {
      process.stdout.write(generateZshCompletion());
    } else if (s === 'fish') {
      process.stdout.write(generateFishCompletion());
    } else {
      console.error(chalk.red('Unknown shell:'), shell);
      console.error('Supported shells: bash, zsh, fish');
      process.exit(1);
    }
  });

// ─── __completions (hidden — used by completion scripts) ─────────────────────

program
  .command('__completions', { hidden: true })
  .option('--oas <path>', 'Path or URL to the OpenAPI spec')
  .option('--group <group>', 'Return operation names for this group')
  .option('--flat', 'Return flat (untagged) operation names')
  .action(async (opts: { oas?: string; group?: string; flat?: boolean }) => {
    if (!opts.oas) return;
    try {
      // Use cache with a generous TTL so completions are fast
      const api = await parseOASWithCache(opts.oas, { ttlMs: 3_600_000 });
      const structure = analyzeSchema(api, '_proxy_');
      if (opts.group) {
        const g = structure.groups.find(gr => gr.name === opts.group);
        if (g) process.stdout.write(g.subcommands.map(s => s.name).join('\n') + '\n');
      } else if (opts.flat) {
        process.stdout.write(structure.flatCommands.map(s => s.name).join('\n') + '\n');
      } else {
        process.stdout.write(structure.groups.map(g => g.name).join('\n') + '\n');
        if (structure.flatCommands.length > 0) {
          process.stdout.write(structure.flatCommands.map(s => s.name).join('\n') + '\n');
        }
      }
    } catch {
      // Silently fail — completion should never break the user's shell
    }
  });

// ─── top-level error boundary ────────────────────────────────────────────────
//
// All typed errors (OpenAPI2CLIError subclasses) thrown by library code are
// caught here and rendered as user-friendly messages.  This is the *only* place
// in the tool that calls process.exit().

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof OpenAPI2CLIError) {
    console.error(chalk.red(err.name + ':'), err.message);
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('Fatal:'), msg);
  }
  process.exit(1);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}
