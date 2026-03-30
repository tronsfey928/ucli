#!/usr/bin/env ts-node
/**
 * Generates the examples/github-cli/ directory from tests/fixtures/github-api.json.
 * Run: npx ts-node scripts/generate-example.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import { parseOAS } from '../src/parser/oas-parser';
import { analyzeSchema } from '../src/analyzer/schema-analyzer';
import { generateProject } from '../src/generator/command-generator';

async function main(): Promise<void> {
  const fixtureFile = path.resolve(__dirname, '../tests/fixtures/github-api.json');
  const outputDir = path.resolve(__dirname, '../examples/github-cli');

  console.log('Parsing OAS spec:', fixtureFile);
  const api = await parseOAS(fixtureFile);

  console.log('Analyzing schema...');
  const structure = analyzeSchema(api, 'github-cli');

  console.log('Generating project files...');
  const files = await generateProject(structure);

  // Write files
  for (const file of files) {
    const dest = path.join(outputDir, file.relativePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.content, 'utf-8');
  }

  // Make bin executable
  const binPath = path.join(outputDir, 'bin', 'github-cli');
  if (fs.existsSync(binPath)) {
    fs.chmodSync(binPath, 0o755);
  }

  console.log(`Done! Generated ${files.length} files in ${outputDir}`);
  files.forEach((f) => console.log(' ', f.relativePath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
