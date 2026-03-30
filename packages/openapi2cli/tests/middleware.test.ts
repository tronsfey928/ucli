/**
 * Unit tests for the HTTP client middleware pattern.
 *
 * Uses axios-mock-adapter to intercept HTTP requests so no real network is needed.
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createRuntimeClient, RuntimeAuth, RuntimeClientOptions } from '../src/runner/http-client';
import { Middleware, RequestOptions } from '../src/types/index';

// Save the real axios.create before any spy can intercept it.
const realAxiosCreate = axios.create.bind(axios);

let mock: MockAdapter;

beforeEach(() => {
  // Intercept axios.create so we can attach MockAdapter to every instance.
  jest.spyOn(axios, 'create').mockImplementation((cfg) => {
    const inst = realAxiosCreate(cfg);
    mock = new MockAdapter(inst);
    return inst;
  });
});

afterEach(() => {
  mock?.restore();
  jest.restoreAllMocks();
});

const BASE_URL = 'http://middleware-test.local';
const defaultAuth: RuntimeAuth = {};

describe('HTTP client middleware', () => {
  it('runs middleware in order around the core request', async () => {
    const order: string[] = [];

    const mw1: Middleware = async (opts, next) => {
      order.push('mw1-before');
      const result = await next(opts);
      order.push('mw1-after');
      return result;
    };

    const mw2: Middleware = async (opts, next) => {
      order.push('mw2-before');
      const result = await next(opts);
      order.push('mw2-after');
      return result;
    };

    const client = createRuntimeClient(BASE_URL, defaultAuth, {
      middleware: [mw1, mw2],
    });

    mock.onGet('/test').reply(200, { ok: true });

    const result = await client.request({
      method: 'get',
      path: '/test',
      pathParams: {},
      queryParams: {},
    });

    expect(result).toEqual({ ok: true });
    expect(order).toEqual(['mw1-before', 'mw2-before', 'mw2-after', 'mw1-after']);
  });

  it('allows middleware to transform the response', async () => {
    const transformMiddleware: Middleware = async (opts, next) => {
      const result = await next(opts);
      return { wrapped: result };
    };

    const client = createRuntimeClient(BASE_URL, defaultAuth, {
      middleware: [transformMiddleware],
    });

    mock.onGet('/data').reply(200, { raw: 'value' });

    const result = await client.request({
      method: 'get',
      path: '/data',
      pathParams: {},
      queryParams: {},
    });

    expect(result).toEqual({ wrapped: { raw: 'value' } });
  });

  it('allows middleware to short-circuit without calling next', async () => {
    const shortCircuit: Middleware = async (_opts, _next) => {
      return { cached: true };
    };

    const client = createRuntimeClient(BASE_URL, defaultAuth, {
      middleware: [shortCircuit],
    });

    // No mock needed — the request should never be sent

    const result = await client.request({
      method: 'get',
      path: '/should-not-hit',
      pathParams: {},
      queryParams: {},
    });

    expect(result).toEqual({ cached: true });
  });

  it('works without middleware (default path)', async () => {
    const client = createRuntimeClient(BASE_URL, defaultAuth);

    mock.onGet('/plain').reply(200, { plain: true });

    const result = await client.request({
      method: 'get',
      path: '/plain',
      pathParams: {},
      queryParams: {},
    });

    expect(result).toEqual({ plain: true });
  });
});
