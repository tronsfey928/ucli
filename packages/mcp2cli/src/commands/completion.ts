import { Command } from 'commander';
import chalk from 'chalk';

const BASH_COMPLETION = `
# mcp2cli bash completion
_mcp2cli_completion() {
  local cur prev words
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  case "\${prev}" in
    mcp2cli)
      COMPREPLY=($(compgen -W "--mcp --mcp-stdio --list --raw --json --describe --input-json --jq --no-cache --cache-ttl --pretty --env --header bake completion" -- "\${cur}"))
      ;;
    bake)
      COMPREPLY=($(compgen -W "create list delete" -- "\${cur}"))
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "\${cur}"))
      ;;
  esac
}
complete -F _mcp2cli_completion mcp2cli
`.trim();

const ZSH_COMPLETION = `
#compdef mcp2cli

_mcp2cli() {
  local -a commands
  commands=(
    'bake:Manage saved MCP server configurations'
    'completion:Output shell completion script'
  )
  _arguments \\
    '--mcp[MCP HTTP/SSE server URL]:url:' \\
    '--mcp-stdio[MCP stdio server command]:command:' \\
    '--list[List available tools]' \\
    '--raw[Output raw JSON]' \\
    '--json[Machine-readable JSON output for agent integration]' \\
    '--describe[Show detailed schema for a specific tool]:tool:' \\
    '--input-json[Pass tool arguments as a JSON object]:json:' \\
    '--jq[JMESPath expression]:expression:' \\
    '--no-cache[Bypass cache]' \\
    '--cache-ttl[Cache TTL in seconds]:seconds:' \\
    '--pretty[Pretty-print output]' \\
    '--env[Environment variables]:KEY=VALUE:' \\
    '--header[HTTP headers]:Header\\:Value:' \\
    '1:command:->command'
  case \$state in
    command) _describe 'command' commands ;;
  esac
}
_mcp2cli
`.trim();

const FISH_COMPLETION = `
# mcp2cli fish completion
complete -c mcp2cli -l mcp -d 'MCP HTTP/SSE server URL' -r
complete -c mcp2cli -l mcp-stdio -d 'MCP stdio server command' -r
complete -c mcp2cli -l list -d 'List available tools'
complete -c mcp2cli -l raw -d 'Output raw JSON'
complete -c mcp2cli -l json -d 'Machine-readable JSON output for agent integration'
complete -c mcp2cli -l describe -d 'Show detailed schema for a specific tool' -r
complete -c mcp2cli -l input-json -d 'Pass tool arguments as a JSON object' -r
complete -c mcp2cli -l jq -d 'JMESPath expression' -r
complete -c mcp2cli -l no-cache -d 'Bypass cache'
complete -c mcp2cli -l cache-ttl -d 'Cache TTL in seconds' -r
complete -c mcp2cli -l pretty -d 'Pretty-print output'
complete -c mcp2cli -l env -d 'Environment variables' -r
complete -c mcp2cli -l header -d 'HTTP headers' -r
complete -c mcp2cli -f -a bake -d 'Manage saved configs'
complete -c mcp2cli -f -a completion -d 'Output shell completion script'
`.trim();

export function buildCompletionCommand(): Command {
  return new Command('completion')
    .description('Output shell completion script')
    .argument('[shell]', 'Shell type: bash | zsh | fish', 'bash')
    .action((shell: string) => {
      if (shell === 'bash') {
        console.log(BASH_COMPLETION);
      } else if (shell === 'zsh') {
        console.log(ZSH_COMPLETION);
      } else if (shell === 'fish') {
        console.log(FISH_COMPLETION);
      } else {
        console.error(chalk.red(`Unknown shell: ${shell}. Use bash, zsh, or fish.`));
        process.exit(1);
      }
    });
}
