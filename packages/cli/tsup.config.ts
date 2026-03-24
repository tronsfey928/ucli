import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  dts: false,
  noExternal: ['@tronsfey/mcp2cli'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
