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
import { setDebugMode } from './lib/errors.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string; description: string }

const program = new Command()

program
  .name('ucli')
  .description(pkg.description)
  .version(pkg.version, '-v, --version')
  .option('--debug', 'Enable verbose debug logging')
  .addHelpCommand(false) // we provide our own help command
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Walk up to root to find the --debug flag
    let cmd = actionCommand
    while (cmd) {
      if ((cmd.opts() as Record<string, unknown>).debug) {
        setDebugMode(true)
        break
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
registerHelp(program)

program.parse(process.argv)
