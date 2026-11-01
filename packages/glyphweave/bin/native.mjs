#!/usr/bin/env node
import { bundledNativeEngine } from '../dist/build/native-engine.js'

// Replace this launcher so the native compiler keeps the same PID and signals.
const binary = await bundledNativeEngine()
process.execve(binary, [binary, ...process.argv.slice(2)], process.env)
