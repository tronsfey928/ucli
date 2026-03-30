/**
 * Unit tests for src/logger.ts — structured logging abstraction.
 */
import { logger, setLogLevel, getLogLevel, LogLevel } from '../src/logger';

let stderrOutput: string[] = [];
let stdoutOutput: string[] = [];

beforeEach(() => {
  stderrOutput = [];
  stdoutOutput = [];
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    stderrOutput.push(args.map(String).join(' '));
  });
  jest.spyOn(console, 'log').mockImplementation((...args) => {
    stdoutOutput.push(args.map(String).join(' '));
  });
  setLogLevel('debug'); // allow all levels in tests
});

afterEach(() => {
  jest.restoreAllMocks();
  setLogLevel('info'); // reset default
});

describe('logger.debug', () => {
  it('writes to stderr when level is debug', () => {
    logger.debug('hello debug');
    expect(stderrOutput.length).toBe(1);
    expect(stderrOutput[0]).toContain('hello debug');
  });

  it('is suppressed when level is info', () => {
    setLogLevel('info');
    logger.debug('suppressed');
    expect(stderrOutput.length).toBe(0);
  });
});

describe('logger.info', () => {
  it('writes to stdout', () => {
    logger.info('hello info');
    expect(stdoutOutput.length).toBe(1);
    expect(stdoutOutput[0]).toContain('hello info');
  });

  it('is suppressed when level is warn', () => {
    setLogLevel('warn');
    logger.info('suppressed');
    expect(stdoutOutput.length).toBe(0);
  });
});

describe('logger.warn', () => {
  it('writes to stderr', () => {
    logger.warn('warning message');
    expect(stderrOutput.length).toBe(1);
    expect(stderrOutput[0]).toContain('warning message');
  });

  it('is suppressed when level is error', () => {
    setLogLevel('error');
    logger.warn('suppressed');
    expect(stderrOutput.length).toBe(0);
  });
});

describe('logger.error', () => {
  it('writes to stderr', () => {
    logger.error('error message');
    expect(stderrOutput.length).toBe(1);
    expect(stderrOutput[0]).toContain('error message');
  });

  it('is suppressed when level is silent', () => {
    setLogLevel('silent');
    logger.error('suppressed');
    expect(stderrOutput.length).toBe(0);
  });
});

describe('setLogLevel / getLogLevel', () => {
  it('round-trips log level', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    for (const level of levels) {
      setLogLevel(level);
      expect(getLogLevel()).toBe(level);
    }
  });
});
