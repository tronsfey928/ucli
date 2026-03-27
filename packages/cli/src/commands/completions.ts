/**
 * `ucli completions` — generate shell completion scripts for bash/zsh/fish.
 *
 * Usage:
 *   eval "$(ucli completions bash)"
 *   eval "$(ucli completions zsh)"
 *   ucli completions fish | source
 */
import type { Command } from 'commander'
import { ExitCode } from '../lib/exit-codes.js'

export function registerCompletions(program: Command): void {
  program
    .command('completions <shell>')
    .description('Generate shell completion script (bash | zsh | fish)')
    .action((shell: string) => {
      const normalized = shell.toLowerCase().trim()

      switch (normalized) {
        case 'bash':
          console.log(bashCompletions())
          break
        case 'zsh':
          console.log(zshCompletions())
          break
        case 'fish':
          console.log(fishCompletions())
          break
        default:
          console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`)
          process.exit(ExitCode.USAGE_ERROR)
      }
    })
}

function bashCompletions(): string {
  return `# ucli bash completions — eval "$(ucli completions bash)"
_ucli_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="configure services run refresh help mcp doctor completions"

  case "\${COMP_WORDS[1]}" in
    services)
      COMPREPLY=( $(compgen -W "list info" -- "$cur") )
      return 0
      ;;
    mcp)
      COMPREPLY=( $(compgen -W "list tools run" -- "$cur") )
      return 0
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
      return 0
      ;;
    run|help)
      # dynamic completions would require server calls; skip for now
      return 0
      ;;
  esac

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
  fi

  return 0
}
complete -F _ucli_completions ucli`
}

function zshCompletions(): string {
  return `# ucli zsh completions — eval "$(ucli completions zsh)"
#compdef ucli

_ucli() {
  local -a commands
  commands=(
    'configure:Configure server URL and authentication token'
    'services:Manage and inspect available OAS services'
    'run:Execute an operation on a service'
    'refresh:Force-refresh the local OAS cache'
    'help:Show usage guide'
    'mcp:Interact with MCP servers'
    'doctor:Check configuration and connectivity'
    'completions:Generate shell completion script'
  )

  _arguments -C \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'ucli commands' commands
      ;;
    args)
      case $words[1] in
        services)
          _values 'subcommand' 'list[List all OAS services]' 'info[Show service details]'
          ;;
        mcp)
          _values 'subcommand' 'list[List MCP servers]' 'tools[List tools]' 'run[Call a tool]'
          ;;
        completions)
          _values 'shell' bash zsh fish
          ;;
      esac
      ;;
  esac
}

_ucli "$@"`
}

function fishCompletions(): string {
  return `# ucli fish completions — ucli completions fish | source
complete -c ucli -e

# Top-level commands
complete -c ucli -n __fish_use_subcommand -a configure -d 'Configure server URL and token'
complete -c ucli -n __fish_use_subcommand -a services -d 'Manage OAS services'
complete -c ucli -n __fish_use_subcommand -a run -d 'Execute a service operation'
complete -c ucli -n __fish_use_subcommand -a refresh -d 'Refresh local cache'
complete -c ucli -n __fish_use_subcommand -a help -d 'Show usage guide'
complete -c ucli -n __fish_use_subcommand -a mcp -d 'Interact with MCP servers'
complete -c ucli -n __fish_use_subcommand -a doctor -d 'Check config and connectivity'
complete -c ucli -n __fish_use_subcommand -a completions -d 'Generate shell completions'

# services subcommands
complete -c ucli -n '__fish_seen_subcommand_from services' -a list -d 'List services'
complete -c ucli -n '__fish_seen_subcommand_from services' -a info -d 'Show service details'

# mcp subcommands
complete -c ucli -n '__fish_seen_subcommand_from mcp' -a list -d 'List MCP servers'
complete -c ucli -n '__fish_seen_subcommand_from mcp' -a tools -d 'List tools'
complete -c ucli -n '__fish_seen_subcommand_from mcp' -a run -d 'Call a tool'

# completions subcommands
complete -c ucli -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish' -d 'Shell type'`
}
