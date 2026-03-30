/**
 * `generate` command implementation.
 *
 * Orchestrates: parse OAS → analyse schema → generate project files → write to disk.
 * All UI concerns (spinners, coloured output) live here in the command layer,
 * keeping the core libraries (parser, analyser, generator) free of side effects.
 */

import chalk from 'chalk';
import ora from 'ora';
import * as fse from 'fs-extra';
import * as path from 'path';
import { parseOASWithCache } from '../cache';
import { analyzeSchema } from '../analyzer/schema-analyzer';
import { generateProject } from '../generator/command-generator';
import { CLIConfig, GeneratedFile } from '../types/index';
import { InputValidationError } from '../errors';

export interface GenerateOpts extends CLIConfig {
  overwrite: boolean;
  cache: boolean;
  cacheTtl: number;
}

export async function runGenerate(opts: GenerateOpts): Promise<void> {
  const outputDir = path.resolve(process.cwd(), opts.output);

  if (await fse.pathExists(outputDir)) {
    if (!opts.overwrite) {
      throw new InputValidationError(
        `Output directory already exists: ${outputDir}. Use --overwrite to replace it.`,
      );
    }
    await fse.remove(outputDir);
  }

  const parseSpinner = ora('Parsing OpenAPI spec...').start();
  let api;
  try {
    api = await parseOASWithCache(opts.oas, {
      noCache: opts.cache === false,
      ttlMs: opts.cacheTtl * 1000,
    });
    parseSpinner.succeed(chalk.green(`Parsed: ${api.info.title} v${api.info.version}`));
  } catch (err) {
    parseSpinner.fail('Failed to parse OpenAPI spec');
    throw err;
  }

  const analyzeSpinner = ora('Analyzing schema...').start();
  const structure = analyzeSchema(api, opts.name);
  const groupCount = structure.groups.length;
  const flatCount = structure.flatCommands.length;
  const summary = [
    groupCount > 0 ? `${groupCount} command group(s)` : '',
    flatCount > 0 ? `${flatCount} flat command(s)` : '',
  ].filter(Boolean).join(', ');
  analyzeSpinner.succeed(chalk.green(`Found ${summary}`));

  if (structure.warnings.length > 0) {
    console.log('');
    console.log(chalk.yellow('  ⚠  规范性警告 (建议修复 OpenAPI 定义):'));
    for (const w of structure.warnings) {
      console.log(chalk.yellow(`     ${w}`));
    }
    console.log('');
  }

  const genSpinner = ora('Generating project files...').start();
  let files: GeneratedFile[];
  try {
    files = await generateProject(structure);
    genSpinner.succeed(chalk.green(`Generated ${files.length} file(s)`));
  } catch (err) {
    genSpinner.fail('Failed to generate project files');
    throw err;
  }

  const writeSpinner = ora(`Writing to ${outputDir}...`).start();
  for (const file of files) {
    const dest = path.join(outputDir, file.relativePath);
    await fse.outputFile(dest, file.content, 'utf-8');
  }

  const binPath = path.join(outputDir, 'bin', opts.name);
  if (await fse.pathExists(binPath)) {
    await fse.chmod(binPath, 0o755);
  }

  writeSpinner.succeed(chalk.green('Done!'));

  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.cyan(`  cd ${opts.output}`));
  console.log(chalk.cyan('  npm install'));
  console.log(chalk.cyan('  npm run build'));
  console.log(chalk.cyan(`  ./${path.join('bin', opts.name)} --help`));
}
