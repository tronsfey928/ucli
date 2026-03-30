/**
 * Unit tests for src/runner/output.ts → formatOutput()
 */
import { formatOutput } from '../src/runner/output';

// Capture console output
let consoleOutput: string[] = [];
let consoleTableCalls: unknown[][] = [];
let exitCode: number | null = null;

beforeEach(() => {
  consoleOutput = [];
  consoleTableCalls = [];
  exitCode = null;
  jest.spyOn(console, 'log').mockImplementation((...args) => {
    consoleOutput.push(args.join(' '));
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'table').mockImplementation((...args) => {
    consoleTableCalls.push(args);
  });
  jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    exitCode = Number(code ?? 0);
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── JSON format ───────────────────────────────────────────────────────────────

describe('formatOutput — json', () => {
  it('pretty-prints an object', () => {
    formatOutput({ id: 1, name: 'Alpha' }, 'json');
    expect(consoleOutput[0]).toBe(JSON.stringify({ id: 1, name: 'Alpha' }, null, 2));
  });

  it('pretty-prints an array', () => {
    formatOutput([1, 2, 3], 'json');
    expect(JSON.parse(consoleOutput[0])).toEqual([1, 2, 3]);
  });

  it('handles null', () => {
    formatOutput(null, 'json');
    expect(consoleOutput[0]).toBe('null');
  });

  it('handles a scalar string', () => {
    formatOutput('hello', 'json');
    expect(consoleOutput[0]).toBe('"hello"');
  });
});

// ── YAML format ───────────────────────────────────────────────────────────────

describe('formatOutput — yaml', () => {
  it('outputs valid YAML for an object', () => {
    formatOutput({ id: 1, name: 'Alpha' }, 'yaml');
    expect(consoleOutput[0]).toMatch(/id: 1/);
    expect(consoleOutput[0]).toMatch(/name: Alpha/);
  });

  it('outputs valid YAML for an array', () => {
    formatOutput([{ a: 1 }, { a: 2 }], 'yaml');
    expect(consoleOutput[0]).toMatch(/- a: 1/);
    expect(consoleOutput[0]).toMatch(/- a: 2/);
  });
});

// ── Table format ──────────────────────────────────────────────────────────────

describe('formatOutput — table', () => {
  it('calls console.table for an array of objects', () => {
    formatOutput([{ id: 1 }, { id: 2 }], 'table');
    expect(consoleTableCalls).toHaveLength(1);
    expect(consoleTableCalls[0][0]).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('calls console.table for a plain object', () => {
    formatOutput({ a: 1, b: 2 }, 'table');
    expect(consoleTableCalls).toHaveLength(1);
  });

  it('prints string result as plain text (not table)', () => {
    formatOutput('just a string', 'table');
    expect(consoleTableCalls).toHaveLength(0);
    expect(consoleOutput[0]).toBe('just a string');
  });
});

// ── JMESPath --query ──────────────────────────────────────────────────────────

describe('formatOutput — query', () => {
  it('extracts a scalar field from an object', () => {
    formatOutput({ id: 1, name: 'Alpha' }, 'json', 'name');
    expect(JSON.parse(consoleOutput[0])).toBe('Alpha');
  });

  it('extracts a field list from an array', () => {
    formatOutput([{ name: 'A' }, { name: 'B' }], 'json', '[].name');
    expect(JSON.parse(consoleOutput[0])).toEqual(['A', 'B']);
  });

  it('returns null for a missing field', () => {
    formatOutput({ id: 1 }, 'json', 'missing');
    expect(JSON.parse(consoleOutput[0])).toBeNull();
  });

  it('throws OutputFormatError on invalid JMESPath expression', () => {
    expect(() => formatOutput({ id: 1 }, 'json', '[[invalid')).toThrow(/JMESPath error/);
  });

  it('applies query before formatting as YAML', () => {
    formatOutput([{ name: 'X' }, { name: 'Y' }], 'yaml', '[].name');
    expect(consoleOutput[0]).toMatch(/- X/);
    expect(consoleOutput[0]).toMatch(/- Y/);
  });
});
