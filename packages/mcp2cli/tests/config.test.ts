import { buildServerConfig, resolveCacheTtl, suggestToolNames } from '../src/config';

describe('buildServerConfig', () => {
  test('builds http config from --mcp option', () => {
    const config = buildServerConfig({ mcp: 'https://example.com/mcp' });
    expect(config).toEqual({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: {},
    });
  });

  test('builds http config with headers', () => {
    const config = buildServerConfig({
      mcp: 'https://example.com/mcp',
      header: ['Authorization: Bearer TOKEN', 'X-Custom: value'],
    });
    expect(config).toEqual({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer TOKEN', 'X-Custom': 'value' },
    });
  });

  test('warns on malformed header and skips it', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = buildServerConfig({
      mcp: 'https://example.com/mcp',
      header: ['BadHeader'],
    });
    expect(config.type).toBe('http');
    if (config.type === 'http') {
      expect(config.headers).toEqual({});
    }
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed header'));
    warnSpy.mockRestore();
  });

  test('builds stdio config from --mcp-stdio option', () => {
    const config = buildServerConfig({ mcpStdio: 'node server.js' });
    expect(config).toEqual({
      type: 'stdio',
      command: 'node server.js',
      env: {},
    });
  });

  test('builds stdio config with env vars', () => {
    const config = buildServerConfig({
      mcpStdio: 'node server.js',
      env: ['API_KEY=secret', 'PORT=3000'],
    });
    expect(config).toEqual({
      type: 'stdio',
      command: 'node server.js',
      env: { API_KEY: 'secret', PORT: '3000' },
    });
  });

  test('warns on malformed env var and skips it', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = buildServerConfig({
      mcpStdio: 'node server.js',
      env: ['NOEQUALS'],
    });
    expect(config.type).toBe('stdio');
    if (config.type === 'stdio') {
      expect(config.env).toEqual({});
    }
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed env var'));
    warnSpy.mockRestore();
  });
});

describe('resolveCacheTtl', () => {
  test('returns parsed integer for valid number strings', () => {
    expect(resolveCacheTtl('3600')).toBe(3600);
    expect(resolveCacheTtl('60')).toBe(60);
    expect(resolveCacheTtl('7200.5')).toBe(7200);
  });

  test('returns default 3600 for null/undefined input', () => {
    expect(resolveCacheTtl(null)).toBe(3600);
    expect(resolveCacheTtl(undefined)).toBe(3600);
  });

  test('returns default and warns for invalid input', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveCacheTtl('abc')).toBe(3600);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid cache TTL'));
    warnSpy.mockRestore();
  });

  test('returns default and warns for negative input', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveCacheTtl('-10')).toBe(3600);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('allows zero', () => {
    expect(resolveCacheTtl('0')).toBe(0);
  });
});

describe('suggestToolNames', () => {
  const tools = ['search', 'list-files', 'read-file', 'write-file', 'delete', 'echo'];

  test('returns exact match first', () => {
    expect(suggestToolNames('search', tools)).toEqual(['search']);
  });

  test('suggests close matches for typos', () => {
    const suggestions = suggestToolNames('serch', tools);
    expect(suggestions).toContain('search');
  });

  test('suggests close matches for read-fil typo', () => {
    const suggestions = suggestToolNames('read-fil', tools);
    expect(suggestions).toContain('read-file');
  });

  test('returns empty for completely unrelated input', () => {
    const suggestions = suggestToolNames('xyzabcdefghijk', tools);
    expect(suggestions).toEqual([]);
  });

  test('respects maxResults limit', () => {
    const suggestions = suggestToolNames('file', tools, 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  test('is case-insensitive', () => {
    const suggestions = suggestToolNames('SEARCH', tools);
    expect(suggestions).toContain('search');
  });

  test('returns empty array for empty available list', () => {
    expect(suggestToolNames('search', [])).toEqual([]);
  });
});
