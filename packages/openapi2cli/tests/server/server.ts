/**
 * Minimal Express server that implements test-server-api.json.
 *
 * Covers: GET / POST / PUT / PATCH / DELETE, Bearer auth, enum query params,
 * SSE streaming, and Link-header pagination — everything the e2e test exercises.
 *
 * Usage (from test):
 *   import { startServer, TEST_TOKEN } from '../server/server';
 *   const srv = await startServer(port);
 *   srv.resetStore();   // call in beforeEach to guarantee a clean slate
 *   await srv.close();
 */
import express, { Request, Response, NextFunction } from 'express';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Item {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface ServerInstance {
  port: number;
  close(): Promise<void>;
  /** Reset the in-memory item store to the original seed data. */
  resetStore(): void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const TEST_TOKEN = 'test-secret-token';

const SEED: Item[] = [
  { id: '1', name: 'Alpha', status: 'active',   createdAt: '2024-01-01' },
  { id: '2', name: 'Beta',  status: 'inactive', createdAt: '2024-01-02' },
  { id: '3', name: 'Gamma', status: 'active',   createdAt: '2024-01-03' },
];

const PAGES_DATA = [
  [{ id: 1, title: 'Page1-Item1' }, { id: 2, title: 'Page1-Item2' }],
  [{ id: 3, title: 'Page2-Item1' }],
];

// ─── Factory ──────────────────────────────────────────────────────────────────
export async function startServer(port: number): Promise<ServerInstance> {
  let store: Item[] = SEED.map(i => ({ ...i }));

  const app = express();
  app.use(express.json());

  // Auth guard
  function requireBearer(req: Request, res: Response, next: NextFunction): void {
    if (req.headers['authorization'] !== `Bearer ${TEST_TOKEN}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  // ── /items ──────────────────────────────────────────────────────────────────
  app.get('/items', (req: Request, res: Response) => {
    let result = store.map(i => ({ ...i }));
    if (req.query['status']) {
      result = result.filter(i => i.status === req.query['status']);
    }
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    if (limit !== undefined && result.length > limit) {
      res.setHeader('Link', `<http://localhost:${port}/items?page=2&limit=${limit}>; rel="next"`);
      result = result.slice(0, limit);
    }
    res.json(result);
  });

  app.post('/items', requireBearer, (req: Request, res: Response) => {
    const body = req.body as { name: string; status?: string };
    const item: Item = {
      id: String(store.length + 1),
      name: body.name,
      status: body.status ?? 'active',
      createdAt: new Date().toISOString(),
    };
    store.push(item);
    res.status(201).json(item);
  });

  // ── /items/:id ──────────────────────────────────────────────────────────────
  app.get('/items/:id', (req: Request, res: Response) => {
    const item = store.find(i => i.id === req.params['id']);
    if (!item) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(item);
  });

  app.put('/items/:id', requireBearer, (req: Request, res: Response) => {
    const idx = store.findIndex(i => i.id === req.params['id']);
    if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
    const body = req.body as { name: string; status?: string };
    store[idx] = {
      id: req.params['id'],
      name: body.name,
      status: body.status ?? store[idx].status,
      createdAt: store[idx].createdAt,
    };
    res.json(store[idx]);
  });

  app.patch('/items/:id', requireBearer, (req: Request, res: Response) => {
    const idx = store.findIndex(i => i.id === req.params['id']);
    if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
    const body = req.body as { name?: string; status?: string };
    if (body.name !== undefined)   store[idx].name   = body.name;
    if (body.status !== undefined) store[idx].status = body.status;
    res.json(store[idx]);
  });

  app.delete('/items/:id', requireBearer, (req: Request, res: Response) => {
    const idx = store.findIndex(i => i.id === req.params['id']);
    if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
    store.splice(idx, 1);
    res.status(204).send();
  });

  // ── /stream (SSE) ───────────────────────────────────────────────────────────
  app.get('/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const events = [
      { seq: 1, message: 'hello' },
      { seq: 2, message: 'world' },
      { seq: 3, message: 'fin' },
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= events.length) {
        res.write('data: [DONE]\n\n');
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify(events[i])}\n\n`);
      i += 1;
    }, 30);
    req.on('close', () => clearInterval(timer));
  });

  // ── /pages (pagination) ─────────────────────────────────────────────────────
  app.get('/pages', (req: Request, res: Response) => {
    const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
    if (page === 1) {
      res.setHeader('Link', `<http://localhost:${port}/pages?page=2>; rel="next"`);
      res.json(PAGES_DATA[0]);
    } else {
      res.json(PAGES_DATA[1]);
    }
  });

  // ── Start listening ─────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, () => {
      resolve({
        port,
        resetStore() { store = SEED.map(i => ({ ...i })); },
        close: () => new Promise<void>((res, rej) => srv.close(err => (err ? rej(err) : res()))),
      });
    });
    srv.on('error', reject);
  });
}
