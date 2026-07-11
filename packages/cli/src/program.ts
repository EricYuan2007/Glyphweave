import { Command } from 'commander'
import { GLYPHWEAVE_VERSION } from '@glyphweave/core'
import { registerBuildCommand } from './commands/build.js'
import { registerCleanCommand } from './commands/clean.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerInspectCommand } from './commands/inspect.js'

export function createProgram() {
  const program = new Command()
    .name('glyphweave')
    .description('Typst-to-web blog artifact pipeline')
    .version(GLYPHWEAVE_VERSION)
  registerBuildCommand(program)
  registerCleanCommand(program)
  registerInspectCommand(program)
  registerDoctorCommand(program)
  return program
}
