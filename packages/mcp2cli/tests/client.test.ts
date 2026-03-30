import { parseCommand, isTransportUnsupported } from '../src/client/index';

describe('parseCommand', () => {
  test('parses command with quoted args', () => {
    expect(parseCommand('node "server script.js" --flag')).toEqual({
      command: 'node',
      args: ['server script.js', '--flag'],
    });
  });

  test('throws on unclosed quotes', () => {
    expect(() => parseCommand('node "server.js')).toThrow('Unclosed quote in command');
  });

  test('throws on empty command string', () => {
    expect(() => parseCommand('')).toThrow('Empty command string');
  });

  test('throws on whitespace-only command string', () => {
    expect(() => parseCommand('   ')).toThrow('Empty command string');
  });
});

describe('isTransportUnsupported', () => {
  test('returns true for 404 error message', () => {
    expect(isTransportUnsupported(new Error('Request failed with status 404'))).toBe(true);
  });

  test('returns true for 405 error message', () => {
    expect(isTransportUnsupported(new Error('405 Method Not Allowed'))).toBe(true);
  });

  test('returns true for HTML response body (Express 404)', () => {
    expect(
      isTransportUnsupported(
        new Error('Streamable HTTP error: Error POSTing to endpoint: <!DOCTYPE html><html><body><pre>Cannot POST /sse</pre></body></html>'),
      ),
    ).toBe(true);
  });

  test('returns false for generic network error (does not force SSE retry)', () => {
    expect(isTransportUnsupported(new Error('ECONNREFUSED'))).toBe(false);
  });

  test('returns false for 401 Unauthorized', () => {
    expect(isTransportUnsupported(new Error('401 Unauthorized'))).toBe(false);
  });

  test('returns false for 403 Forbidden', () => {
    expect(isTransportUnsupported(new Error('403 Forbidden'))).toBe(false);
  });

  test('returns false for "unauthorized" keyword', () => {
    expect(isTransportUnsupported(new Error('Request unauthorized'))).toBe(false);
  });

  test('returns false for "forbidden" keyword', () => {
    expect(isTransportUnsupported(new Error('Access forbidden'))).toBe(false);
  });

  test('handles non-Error string values', () => {
    expect(isTransportUnsupported('404 error')).toBe(true);
    expect(isTransportUnsupported('401 auth failed')).toBe(false);
  });

  test('returns false for non-transport streamable errors', () => {
    expect(isTransportUnsupported(new Error('Streamable HTTP error: Unexpected content type: text/html'))).toBe(false);
  });

  test('uses numeric error code when present', () => {
    expect(isTransportUnsupported({ code: 405, message: 'Method Not Allowed' })).toBe(true);
    expect(isTransportUnsupported({ code: 401, message: 'Unauthorized' })).toBe(false);
  });
});
