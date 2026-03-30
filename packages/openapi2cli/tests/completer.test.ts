/**
 * Unit tests for src/completer.ts
 */
import {
  generateBashCompletion,
  generateZshCompletion,
  generateFishCompletion,
} from '../src/completer';

describe('generateBashCompletion', () => {
  it('returns a non-empty string', () => {
    expect(generateBashCompletion().length).toBeGreaterThan(0);
  });

  it('defines the _openapi2cli function', () => {
    expect(generateBashCompletion()).toContain('_openapi2cli()');
  });

  it('registers completion with "complete -F _openapi2cli openapi2cli"', () => {
    expect(generateBashCompletion()).toContain('complete -F _openapi2cli openapi2cli');
  });

  it('includes all top-level commands', () => {
    const script = generateBashCompletion();
    expect(script).toContain('generate');
    expect(script).toContain('run');
    expect(script).toContain('completion');
  });

  it('includes run flags', () => {
    const script = generateBashCompletion();
    expect(script).toContain('--bearer');
    expect(script).toContain('--api-key');
    expect(script).toContain('--oas');
    expect(script).toContain('--endpoint');
  });

  it('calls __completions for dynamic operation lookup', () => {
    expect(generateBashCompletion()).toContain('__completions');
  });
});

describe('generateZshCompletion', () => {
  it('returns a non-empty string', () => {
    expect(generateZshCompletion().length).toBeGreaterThan(0);
  });

  it('starts with #compdef openapi2cli', () => {
    expect(generateZshCompletion()).toContain('#compdef openapi2cli');
  });

  it('defines _openapi2cli function', () => {
    expect(generateZshCompletion()).toContain('_openapi2cli()');
  });

  it('includes all subcommands', () => {
    const script = generateZshCompletion();
    expect(script).toContain('generate');
    expect(script).toContain('run');
    expect(script).toContain('completion');
  });

  it('includes run auth flags', () => {
    const script = generateZshCompletion();
    expect(script).toContain('--bearer');
    expect(script).toContain('--api-key');
    expect(script).toContain('--basic');
  });

  it('calls __completions for dynamic completion', () => {
    expect(generateZshCompletion()).toContain('__completions');
  });
});

describe('generateFishCompletion', () => {
  it('returns a non-empty string', () => {
    expect(generateFishCompletion().length).toBeGreaterThan(0);
  });

  it('uses "complete -c openapi2cli"', () => {
    expect(generateFishCompletion()).toContain('complete -c openapi2cli');
  });

  it('defines generate subcommand', () => {
    expect(generateFishCompletion()).toContain("'generate'");
  });

  it('defines run subcommand', () => {
    expect(generateFishCompletion()).toContain("'run'");
  });

  it('includes format choices', () => {
    const script = generateFishCompletion();
    expect(script).toContain('json yaml table');
  });
});
