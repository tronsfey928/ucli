import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export const ROOT = path.resolve(__dirname, '../../..');
export const CLI = path.join(ROOT, 'dist', 'index.js');
export const STDIO_SERVER = path.join(ROOT, 'tests', 'integration', 'helpers', 'stdio-server.js');

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Run the compiled CLI binary and return stdout/stderr/exitCode. */
export async function runCli(args: string): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execAsync(`node "${CLI}" ${args}`, { cwd: ROOT });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.code ?? 1,
    };
  }
}
