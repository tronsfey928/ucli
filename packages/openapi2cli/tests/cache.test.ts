/**
 * Unit tests for src/cache.ts — parseOASWithCache()
 *
 * We mock parseOAS and fs-extra so no real I/O or network happens.
 */
import * as path from 'path';
import * as os from 'os';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock the OAS parser so we can count calls and control return values
jest.mock('../src/parser/oas-parser', () => ({
  parseOAS: jest.fn(),
}));

// Mock fs-extra to avoid real disk writes
jest.mock('fs-extra', () => ({
  stat: jest.fn(),
  readJSON: jest.fn(),
  writeJSON: jest.fn(),
  ensureDir: jest.fn(),
}));

import { parseOASWithCache } from '../src/cache';
import { parseOAS } from '../src/parser/oas-parser';
import * as fse from 'fs-extra';

const mockParseOAS = parseOAS as jest.MockedFunction<typeof parseOAS>;
const mockStat     = fse.stat     as jest.MockedFunction<typeof fse.stat>;
const mockReadJSON  = fse.readJSON  as jest.MockedFunction<typeof fse.readJSON>;
const mockWriteJSON = fse.writeJSON as jest.MockedFunction<typeof fse.writeJSON>;
const mockEnsureDir = fse.ensureDir as jest.MockedFunction<typeof fse.ensureDir>;

const FAKE_DOC = { openapi: '3.0.0', info: { title: 'Test', version: '1' }, paths: {} } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureDir.mockResolvedValue(undefined as never);
  mockWriteJSON.mockResolvedValue(undefined as never);
  mockParseOAS.mockResolvedValue(FAKE_DOC);
});

// ── Local file → always call parseOAS directly ─────────────────────────────────

describe('parseOASWithCache — local file paths', () => {
  it('calls parseOAS directly without checking cache', async () => {
    const doc = await parseOASWithCache('./local-spec.yaml');
    expect(mockParseOAS).toHaveBeenCalledWith('./local-spec.yaml');
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockReadJSON).not.toHaveBeenCalled();
    expect(doc).toBe(FAKE_DOC);
  });

  it('calls parseOAS when path is an absolute file path', async () => {
    await parseOASWithCache('/absolute/path/to/spec.json');
    expect(mockParseOAS).toHaveBeenCalledWith('/absolute/path/to/spec.json');
    expect(mockStat).not.toHaveBeenCalled();
  });
});

// ── Remote URL + cache hit ─────────────────────────────────────────────────────

describe('parseOASWithCache — cache hit (within TTL)', () => {
  it('returns cached doc and does NOT call parseOAS', async () => {
    // stat returns a fresh mtime (now)
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 1000 } as never); // 1 second old
    mockReadJSON.mockResolvedValue(FAKE_DOC);

    const doc = await parseOASWithCache('https://api.example.com/openapi.json', { ttlMs: 3_600_000 });

    expect(mockStat).toHaveBeenCalled();
    expect(mockReadJSON).toHaveBeenCalled();
    expect(mockParseOAS).not.toHaveBeenCalled();
    expect(doc).toEqual(FAKE_DOC);
  });

  it('re-fetches when cached doc is missing info field', async () => {
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 1000 } as never);
    mockReadJSON.mockResolvedValue({ openapi: '3.0.0', paths: {} }); // missing info

    await parseOASWithCache('https://api.example.com/openapi.json', { ttlMs: 3_600_000 });

    expect(mockParseOAS).toHaveBeenCalled();
  });

  it('re-fetches when cached doc is missing paths field', async () => {
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 1000 } as never);
    mockReadJSON.mockResolvedValue({ openapi: '3.0.0', info: { title: 'X', version: '1' } }); // missing paths

    await parseOASWithCache('https://api.example.com/openapi.json', { ttlMs: 3_600_000 });

    expect(mockParseOAS).toHaveBeenCalled();
  });
});

// ── Remote URL + cache miss (expired) ─────────────────────────────────────────

describe('parseOASWithCache — cache miss (expired TTL)', () => {
  it('re-fetches and updates the cache file', async () => {
    // stat shows a file older than TTL
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 7_200_000 } as never); // 2 hours old

    const doc = await parseOASWithCache('https://api.example.com/openapi.json', { ttlMs: 3_600_000 });

    expect(mockParseOAS).toHaveBeenCalledWith('https://api.example.com/openapi.json');
    expect(mockWriteJSON).toHaveBeenCalled();
    expect(doc).toBe(FAKE_DOC);
  });
});

// ── Remote URL + no cache file (cold start) ────────────────────────────────────

describe('parseOASWithCache — cache file missing', () => {
  it('fetches and writes a new cache file', async () => {
    // stat throws ENOENT (file doesn't exist)
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    (mockStat as unknown as jest.Mock).mockRejectedValue(enoent);

    const doc = await parseOASWithCache('https://api.example.com/openapi.json');

    expect(mockParseOAS).toHaveBeenCalledWith('https://api.example.com/openapi.json');
    expect(mockWriteJSON).toHaveBeenCalled();
    expect(doc).toBe(FAKE_DOC);
  });
});

// ── noCache: true — always bypass cache ───────────────────────────────────────

describe('parseOASWithCache — noCache option', () => {
  it('skips cache read and re-fetches even for remote URLs', async () => {
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 1000 } as never);
    mockReadJSON.mockResolvedValue(FAKE_DOC);

    await parseOASWithCache('https://api.example.com/openapi.json', { noCache: true });

    expect(mockStat).not.toHaveBeenCalled();
    expect(mockReadJSON).not.toHaveBeenCalled();
    expect(mockParseOAS).toHaveBeenCalledWith('https://api.example.com/openapi.json');
    // Cache write still happens (refresh the entry)
    expect(mockWriteJSON).toHaveBeenCalled();
  });
});

// ── Cache write failure is non-fatal ──────────────────────────────────────────

describe('parseOASWithCache — cache write failure', () => {
  it('returns the parsed doc even if the cache write fails', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    (mockStat as unknown as jest.Mock).mockRejectedValue(enoent);
    (mockWriteJSON as unknown as jest.Mock).mockRejectedValue(new Error('disk full'));

    const doc = await parseOASWithCache('https://api.example.com/openapi.json');

    expect(doc).toBe(FAKE_DOC); // still returns successfully
  });
});
