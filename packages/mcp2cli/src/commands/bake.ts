import { Command } from 'commander';
import chalk from 'chalk';
import { createBake, listBakes, deleteBake } from '../bake';
import { McpServerConfig } from '../types/index';
import { buildServerConfig } from '../config';

export function buildBakeCommand(): Command {
  const bakeCmd = new Command('bake').description('Manage saved MCP server configurations');

  bakeCmd
    .command('create <name>')
    .description('Save an MCP server config as a named shortcut')
    .option('--mcp <url>', 'MCP HTTP/SSE server URL')
    .option('--mcp-stdio <command>', 'MCP stdio server command')
    .option('--env <KEY=VALUE...>', 'Environment variables for stdio server')
    .option('--header <Header:Value...>', 'HTTP headers for HTTP server')
    .action(async (name: string, opts: { mcp?: string; mcpStdio?: string; env?: string[]; header?: string[] }) => {
      if (!opts.mcp && !opts.mcpStdio) {
        console.error(chalk.red('Error: must provide --mcp <url> or --mcp-stdio <command>'));
        process.exit(1);
      }
      const config: McpServerConfig = buildServerConfig(opts);
      await createBake(name, config);
      console.log(chalk.green(`Saved bake "${name}" successfully.`));
    });

  bakeCmd
    .command('list')
    .description('List all saved bakes')
    .action(async () => {
      const bakes = await listBakes();
      if (bakes.length === 0) {
        console.log(chalk.yellow('No saved bakes.'));
        return;
      }
      console.log(chalk.bold('\nSaved bakes:\n'));
      for (const b of bakes) {
        const loc =
          b.config.type === 'http'
            ? chalk.cyan(b.config.url)
            : chalk.cyan(b.config.command);
        console.log(`  ${chalk.bold(b.name)}  (${b.config.type})  ${loc}`);
        console.log(`    Created: ${b.createdAt}`);
      }
      console.log();
    });

  bakeCmd
    .command('delete <name>')
    .description('Delete a saved bake')
    .action(async (name: string) => {
      const deleted = await deleteBake(name);
      if (deleted) {
        console.log(chalk.green(`Deleted bake "${name}".`));
      } else {
        console.error(chalk.red(`Bake "${name}" not found.`));
        process.exit(1);
      }
    });

  return bakeCmd;
}
