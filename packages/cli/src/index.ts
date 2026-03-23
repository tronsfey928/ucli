import { Command } from 'commander'
import { createRequire } from 'node:module'
import { registerConfigure } from './commands/configure.js'
import { registerServices } from './commands/services.js'
import { registerRun } from './commands/run.js'
import { registerRefresh } from './commands/refresh.js'
import { registerHelp } from './commands/help-cmd.js'
import { registerMcp } from './commands/mcp.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string; description: string }

const program = new Command()

program
  .name('ucli')
  .description(pkg.description)
  .version(pkg.version, '-v, --version')
  .addHelpCommand(false) // we provide our own help command

registerConfigure(program)
registerServices(program)
registerRun(program)
registerRefresh(program)
registerMcp(program)
registerHelp(program)

program.parse(process.argv)
