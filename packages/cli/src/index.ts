import { Command } from 'commander'
import { createRequire } from 'node:module'
import { registerConfigure } from './commands/configure.js'
import { registerServices } from './commands/services.js'
import { registerRun } from './commands/run.js'
import { registerRefresh } from './commands/refresh.js'
import { registerHelp } from './commands/help-cmd.js'
import { registerMcp } from './commands/mcp.js'
import { registerDoctor } from './commands/doctor.js'
import { registerCompletions } from './commands/completions.js'
import { registerIntrospect } from './commands/introspect.js'
import { setDebugMode } from './lib/errors.js'
import { setOutputMode, type OutputMode } from './lib/output.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string; description: string }

const program = new Command()

program
  .name('ucli')
  .description(pkg.description)
  .version(pkg.version, '-v, --version')
  .option('--debug', 'Enable verbose debug logging')
  .option('--output <mode>', 'Output mode: text | json (json wraps every result in a structured envelope for agent consumption)', 'text')
  .addHelpCommand(false) // we provide our own help command
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Walk up to root to find the --debug and --output flags
    let cmd = actionCommand
    while (cmd) {
      const opts = cmd.opts() as Record<string, unknown>
      if (opts.debug) {
        setDebugMode(true)
      }
      if (opts.output && typeof opts.output === 'string') {
        const mode = opts.output.toLowerCase() as OutputMode
        if (mode === 'json' || mode === 'text') {
          setOutputMode(mode)
        }
      }
      cmd = cmd.parent as Command
    }
  })

registerConfigure(program)
registerServices(program)
registerRun(program)
registerRefresh(program)
registerMcp(program)
registerDoctor(program)
registerCompletions(program)
registerIntrospect(program)
registerHelp(program)

program.parse(process.argv)
