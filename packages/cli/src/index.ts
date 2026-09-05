#!/usr/bin/env node
import { createProgram } from './program.js'

createProgram()
  .parseAsync()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    if (process.argv.includes('--verbose') && error instanceof Error)
      console.error(error.stack, error.cause)
    process.exitCode = 1
  })
