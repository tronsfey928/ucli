import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import * as path from 'path';
import * as fs from 'fs';

export async function parseOAS(input: string): Promise<OpenAPIV3.Document> {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//.test(trimmed);

  let source: string;
  if (isUrl) {
    source = trimmed;
  } else {
    source = path.resolve(process.cwd(), trimmed);
    if (!fs.existsSync(source)) {
      throw new Error(`OAS file not found: ${source}`);
    }
  }

  // dereference() resolves all $ref nodes and validates the spec against OAS JSON Schema
  const api = await SwaggerParser.dereference(source) as OpenAPIV3.Document;

  // Guard: only support OAS 3.x (not Swagger 2.0)
  if (!api.openapi || !api.openapi.startsWith('3.')) {
    const version = api.openapi ?? (api as unknown as Record<string, unknown>)['swagger'];
    throw new Error(
      `Unsupported spec version: "${version}". Only OpenAPI 3.x is supported.`
    );
  }

  return api;
}
