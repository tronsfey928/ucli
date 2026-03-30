/**
 * Unit tests for src/runner/http-client.ts
 *
 * Uses axios-mock-adapter to intercept HTTP requests so no real network is needed.
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createRuntimeClient } from '../src/runner/http-client';

// Save the real axios.create before any spy can intercept it.
const realAxiosCreate = axios.create.bind(axios);

let mock: MockAdapter;

afterEach(() => {
  mock?.restore();
  jest.restoreAllMocks();
});

// ── Auth header construction ───────────────────────────────────────────────────

describe('createRuntimeClient — auth headers', () => {
  let capturedHeaders: Record<string, string> = {};

  beforeEach(() => {
    capturedHeaders = {};
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/').reply((cfg) => {
        capturedHeaders = (cfg.headers ?? {}) as Record<string, string>;
        return [200, { ok: true }];
      });
      return instance;
    });
  });

  async function getHeaders(auth: Parameters<typeof createRuntimeClient>[1]) {
    const client = createRuntimeClient('http://test.example.com', auth);
    await client.request({ method: 'get', path: '/', pathParams: {}, queryParams: {} });
    return capturedHeaders;
  }

  it('bearer → Authorization: Bearer <token>', async () => {
    const h = await getHeaders({ bearer: 'mytoken' });
    expect(h['Authorization']).toBe('Bearer mytoken');
  });

  it('apiKey → X-Api-Key: <key> (default header)', async () => {
    const h = await getHeaders({ apiKey: 'key123' });
    expect(h['X-Api-Key']).toBe('key123');
    expect(h['Authorization']).toBeUndefined();
  });

  it('apiKey + apiKeyHeader → custom header name', async () => {
    const h = await getHeaders({ apiKey: 'key123', apiKeyHeader: 'X-Custom-Key' });
    expect(h['X-Custom-Key']).toBe('key123');
    expect(h['X-Api-Key']).toBeUndefined();
  });

  it('basic → Authorization: Basic base64(user:pass)', async () => {
    const h = await getHeaders({ basic: 'user:pass' });
    expect(h['Authorization']).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);
  });

  it('extraHeaders → forwarded as-is', async () => {
    const h = await getHeaders({ extraHeaders: { 'X-Foo': 'bar', 'X-Tenant': 'acme' } });
    expect(h['X-Foo']).toBe('bar');
    expect(h['X-Tenant']).toBe('acme');
  });

  it('no auth → no Authorization header', async () => {
    const h = await getHeaders({});
    expect(h['Authorization']).toBeUndefined();
  });
});

// ── URL / path param substitution ─────────────────────────────────────────────

describe('createRuntimeClient — URL building', () => {
  let capturedUrl = '';

  beforeEach(() => {
    capturedUrl = '';
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onAny().reply((cfg) => {
        capturedUrl = cfg.url ?? '';
        return [200, {}];
      });
      return instance;
    });
  });

  it('substitutes a path parameter', async () => {
    const client = createRuntimeClient('http://example.com', {});
    await client.request({ method: 'get', path: '/items/{id}', pathParams: { id: '42' }, queryParams: {} });
    expect(capturedUrl).toBe('/items/42');
  });

  it('URL-encodes path parameter values', async () => {
    const client = createRuntimeClient('http://example.com', {});
    await client.request({ method: 'get', path: '/users/{user}', pathParams: { user: 'john doe' }, queryParams: {} });
    expect(capturedUrl).toBe('/users/john%20doe');
  });

  it('throws on missing required path parameter', async () => {
    jest.restoreAllMocks(); // don't need the mock for this
    const client = createRuntimeClient('http://example.com', {});
    await expect(
      client.request({ method: 'get', path: '/items/{id}', pathParams: {}, queryParams: {} })
    ).rejects.toThrow('Missing required path parameter: id');
  });
});

// ── Query params ──────────────────────────────────────────────────────────────

describe('createRuntimeClient — query params', () => {
  let capturedParams: Record<string, unknown> = {};

  beforeEach(() => {
    capturedParams = {};
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/items').reply((cfg) => {
        capturedParams = (cfg.params ?? {}) as Record<string, unknown>;
        return [200, []];
      });
      return instance;
    });
  });

  it('forwards query params', async () => {
    const client = createRuntimeClient('http://example.com', {});
    await client.request({ method: 'get', path: '/items', pathParams: {}, queryParams: { status: 'active', limit: '10' } });
    expect(capturedParams).toMatchObject({ status: 'active', limit: '10' });
  });

  it('omits params object when queryParams is empty', async () => {
    const client = createRuntimeClient('http://example.com', {});
    await client.request({ method: 'get', path: '/items', pathParams: {}, queryParams: {} });
    expect(capturedParams).toEqual({});
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('createRuntimeClient — allPages pagination', () => {
  beforeEach(() => {
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      // Page 1: returns 2 items + Link header pointing to page 2
      mock.onGet('/pages').replyOnce(200, [{ id: 1 }, { id: 2 }], {
        link: '<http://example.com/pages?page=2>; rel="next"',
      });
      // Page 2: 1 item, no Link header
      mock.onGet('http://example.com/pages?page=2').replyOnce(200, [{ id: 3 }]);
      return instance;
    });
  });

  it('collects all pages into a single array', async () => {
    const client = createRuntimeClient('http://example.com', {});
    const result = await client.request({
      method: 'get',
      path: '/pages',
      pathParams: {},
      queryParams: {},
      allPages: true,
    });
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
});

// ── Error responses ───────────────────────────────────────────────────────────

describe('createRuntimeClient — error handling', () => {
  beforeEach(() => {
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/missing').replyOnce(404, { error: 'Not found' });
      return instance;
    });
  });

  it('rejects with an axios error on 4xx responses', async () => {
    const client = createRuntimeClient('http://example.com', {});
    await expect(
      client.request({ method: 'get', path: '/missing', pathParams: {}, queryParams: {} })
    ).rejects.toThrow();
  });
});

// ── Retry logic ───────────────────────────────────────────────────────────────

describe('createRuntimeClient — retry logic', () => {
  it('retries on 503 and succeeds on second attempt', async () => {
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/retry').replyOnce(503, { error: 'Service Unavailable' });
      mock.onGet('/retry').replyOnce(200, { ok: true });
      return instance;
    });

    const client = createRuntimeClient('http://example.com', {}, { timeout: 5000, maxRetries: 3 });
    const result = await client.request({ method: 'get', path: '/retry', pathParams: {}, queryParams: {} });
    expect(result).toEqual({ ok: true });
  }, 10000);

  it('does NOT retry on 404 (non-retryable)', async () => {
    let callCount = 0;
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/notfound').reply(() => {
        callCount++;
        return [404, { error: 'Not Found' }];
      });
      return instance;
    });

    const client = createRuntimeClient('http://example.com', {}, { timeout: 5000, maxRetries: 3 });
    await expect(
      client.request({ method: 'get', path: '/notfound', pathParams: {}, queryParams: {} })
    ).rejects.toThrow();
    // Only one call — no retries for 404
    expect(callCount).toBe(1);
  });

  it('exhausts retries and rejects with last error on repeated 500', async () => {
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      // Always return 500
      mock.onGet('/flaky').reply(500, { error: 'Internal Server Error' });
      return instance;
    });

    const client = createRuntimeClient('http://example.com', {}, { timeout: 5000, maxRetries: 2 });
    await expect(
      client.request({ method: 'get', path: '/flaky', pathParams: {}, queryParams: {} })
    ).rejects.toMatchObject({ response: { status: 500 } });
  }, 15000);

  it('does not retry when maxRetries is 0', async () => {
    let callCount = 0;
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/once').reply(() => {
        callCount++;
        return [503, { error: 'Unavailable' }];
      });
      return instance;
    });

    const client = createRuntimeClient('http://example.com', {}, { timeout: 5000, maxRetries: 0 });
    await expect(
      client.request({ method: 'get', path: '/once', pathParams: {}, queryParams: {} })
    ).rejects.toThrow();
    expect(callCount).toBe(1);
  });
});

// ── Pagination loop protection ────────────────────────────────────────────────

describe('createRuntimeClient — pagination loop protection', () => {
  it('detects and throws on a self-referencing Link header', async () => {
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      // Always return a Link header pointing to itself
      mock.onGet('/loop').reply(200, [{ id: 1 }], {
        link: '<http://example.com/loop>; rel="next"',
      });
      mock.onGet('http://example.com/loop').reply(200, [{ id: 1 }], {
        link: '<http://example.com/loop>; rel="next"',
      });
      return instance;
    });

    const client = createRuntimeClient('http://example.com', {});
    await expect(
      client.request({
        method: 'get', path: '/loop', pathParams: {}, queryParams: {}, allPages: true,
      })
    ).rejects.toThrow('Pagination loop detected');
  });
});

// ── Extra request headers ─────────────────────────────────────────────────────

describe('createRuntimeClient — extra request headers', () => {
  let capturedHeaders: Record<string, string> = {};

  beforeEach(() => {
    capturedHeaders = {};
    jest.spyOn(axios, 'create').mockImplementation((config) => {
      const instance = realAxiosCreate(config);
      mock = new MockAdapter(instance);
      mock.onGet('/').reply((cfg) => {
        capturedHeaders = (cfg.headers ?? {}) as Record<string, string>;
        return [200, { ok: true }];
      });
      return instance;
    });
  });

  it('merges operation-level headers with auth headers', async () => {
    const client = createRuntimeClient('http://example.com', { bearer: 'tok123' });
    await client.request({
      method: 'get', path: '/', pathParams: {}, queryParams: {},
      headers: { 'X-Custom': 'custom-val' },
    });
    expect(capturedHeaders['Authorization']).toBe('Bearer tok123');
    expect(capturedHeaders['X-Custom']).toBe('custom-val');
  });

  it('operation headers override auth headers', async () => {
    const client = createRuntimeClient('http://example.com', { bearer: 'tok123' });
    await client.request({
      method: 'get', path: '/', pathParams: {}, queryParams: {},
      headers: { 'Authorization': 'Bearer overridden' },
    });
    expect(capturedHeaders['Authorization']).toBe('Bearer overridden');
  });
});
