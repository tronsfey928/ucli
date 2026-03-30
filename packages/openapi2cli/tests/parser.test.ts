import { parseOAS } from '../src/parser/oas-parser';
import * as path from 'path';

describe('parseOAS', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'petstore.json');
  const swagger2Path = path.join(__dirname, 'fixtures', 'swagger2.json');
  const invalidPath = path.join(__dirname, 'fixtures', 'invalid.json');

  it('parses a valid OAS 3.0 JSON file', async () => {
    const api = await parseOAS(fixturePath);
    expect(api.openapi).toMatch(/^3\./);
    expect(api.info.title).toBe('Petstore');
  });

  it('resolves $ref references', async () => {
    const api = await parseOAS(fixturePath);
    // After dereference, $refs are resolved — schema should be inline objects
    const getOp = api.paths['/pets']?.get as { parameters?: { schema?: object }[] };
    expect(getOp?.parameters?.[0]?.schema).toBeDefined();
  });

  it('throws for a missing file', async () => {
    await expect(parseOAS('/nonexistent/spec.yaml')).rejects.toThrow('not found');
  });

  it('throws for Swagger 2.0 specs', async () => {
    await expect(parseOAS(swagger2Path)).rejects.toThrow('Unsupported spec version');
  });

  it('rejects an invalid OAS file missing required fields', async () => {
    await expect(parseOAS(invalidPath)).rejects.toThrow();
  });
});
