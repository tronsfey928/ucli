import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  dts: false,
  // Bundle @tronsfey/mcp2cli (devDep) into the output so consumers don't need it.
  // Its transitive CJS deps (e.g. cross-spawn) use require("child_process");
  // We inject a createRequire-based polyfill so the CJS require works inside
  // the ESM bundle.
  noExternal: ['@tronsfey/mcp2cli'],
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire as __createRequire } from "module";',
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
})
