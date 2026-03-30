import Handlebars from 'handlebars';
import _ from 'lodash';
import * as fse from 'fs-extra';
import * as path from 'path';

// Register all helpers once at module load
registerHelpers();

// After build: __dirname = dist/generator/, templates are at dist/templates/
// During dev with ts-node: __dirname = src/generator/, templates are at src/templates/
// In both cases, templates are one level up from __dirname
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

export async function renderTemplate(
  templateName: string,
  context: Record<string, unknown>
): Promise<string> {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  const source = await fse.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(source, { noEscape: true });
  return template(context);
}

function registerHelpers(): void {
  Handlebars.registerHelper('uppercase', (s: string) => s.toUpperCase());

  Handlebars.registerHelper('camelCase', (s: string) => _.camelCase(s));

  Handlebars.registerHelper('pascalCase', (s: string) => _.upperFirst(_.camelCase(s)));

  // Block helper: {{#eq a "value"}}...{{else}}...{{/eq}}
  // Must use function keyword (not arrow) so Handlebars can bind 'this' correctly
  Handlebars.registerHelper('eq', function (
    this: unknown,
    a: unknown,
    b: unknown,
    options: Handlebars.HelperOptions
  ) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  // optionFlag(name, required, type) -> "--name <name>" | "--name [name]" | "--name"
  Handlebars.registerHelper('optionFlag', (name: string, required: boolean, type: string) => {
    if (type === 'boolean') return `--${name}`;
    const brackets = required ? `<${name}>` : `[${name}]`;
    return `--${name} ${brackets}`;
  });

  Handlebars.registerHelper('join', (arr: string[], sep: string) =>
    Array.isArray(arr) ? arr.join(sep) : ''
  );

  // Check if an array has items
  Handlebars.registerHelper('hasItems', (arr: unknown[]) =>
    Array.isArray(arr) && arr.length > 0
  );

  // jsString(s) -> JSON.stringify(s)  e.g. jsString("it's") -> '"it\'s"'
  // Use this whenever a value is embedded inside a TypeScript string literal in generated code,
  // to safely handle single quotes, double quotes, backslashes, and Unicode characters.
  Handlebars.registerHelper('jsString', (s: unknown) => JSON.stringify(String(s ?? '')));

  // subcommandHelpText(subcommand) -> JSON string with tree-formatted body/response fields,
  // or empty string if there is nothing to display.
  Handlebars.registerHelper('subcommandHelpText', (subcommand: Record<string, unknown>) => {
    interface BodyField { name: string; type: string; required: boolean; description: string; enum?: string[]; }
    interface RespField { name: string; type: string; description: string; }
    interface RespEntry { statusCode: string; description: string; fields: RespField[]; }

    const lines: string[] = [];
    const pad = (s: string, n: number) => s.padEnd(n);

    // --- request body ---
    const rb = subcommand['requestBody'] as { required: boolean; fields: BodyField[] } | undefined;
    if (rb?.fields?.length) {
      lines.push('');
      lines.push(`Body (--data JSON, ${rb.required ? 'required' : 'optional'}):`);
      rb.fields.forEach((f, i) => {
        const prefix = i === rb.fields.length - 1 ? '  └─' : '  ├─';
        const req = f.required ? 'required' : 'optional';
        const enumHint = f.enum?.length ? `  choices: ${f.enum.join(' | ')}` : '';
        lines.push(`${prefix} ${pad(f.name, 18)}${pad(f.type, 12)}${pad(req, 10)}${f.description}${enumHint}`);
      });
    }

    // --- 2xx responses ---
    const responses = (subcommand['responses'] ?? {}) as Record<string, RespEntry>;
    for (const [code, resp] of Object.entries(responses)) {
      if (!code.startsWith('2') || !resp.fields?.length) continue;
      lines.push('');
      lines.push(`Response ${code} (${resp.description ?? ''}):`);
      resp.fields.forEach((f, i) => {
        const prefix = i === resp.fields.length - 1 ? '  └─' : '  ├─';
        lines.push(`${prefix} ${pad(f.name, 18)}${pad(f.type, 12)}${f.description}`);
      });
    }

    return lines.length ? JSON.stringify(lines.join('\n')) : '';
  });

  // pad(str, n) -> str padded to n chars with spaces (for aligned help output)
  Handlebars.registerHelper('pad', (s: unknown, n: number) => String(s ?? '').padEnd(n));

  // sampleResponseJson(subcommand) -> pretty-printed sample JSON from the first 2xx response
  // schema, or empty string when no schema fields are available.
  Handlebars.registerHelper('sampleResponseJson', (subcommand: Record<string, unknown>) => {
    interface RespEntry { fields: Array<{ name: string; type: string }>; isArray: boolean; }

    function sampleValue(name: string, type: string): unknown {
      if (type === 'integer' || type === 'number') return 1;
      if (type === 'boolean') return true;
      if (type === 'array') return [];
      if (type === 'object') return {};
      const lower = name.toLowerCase();
      if (lower === 'id' || lower.endsWith('_id') || lower.endsWith('id')) return 1;
      if (lower.includes('email')) return 'user@example.com';
      if (lower.includes('name') || lower === 'title') return 'example';
      if (lower.includes('url') || lower.includes('href') || lower.includes('link')) return 'https://example.com';
      if (lower.includes('date') || lower.includes('time') || lower.endsWith('_at')) return '2024-01-01T00:00:00Z';
      if (lower.includes('status') || lower.includes('state')) return 'active';
      if (lower.includes('count') || lower.includes('total') || lower.includes('num')) return 1;
      if (lower.includes('description') || lower.includes('desc') || lower.includes('summary')) return 'A brief description.';
      return 'example';
    }

    const responses = (subcommand['responses'] ?? {}) as Record<string, RespEntry>;
    for (const [code, resp] of Object.entries(responses)) {
      if (!code.startsWith('2') || !resp.fields?.length) continue;
      const obj: Record<string, unknown> = {};
      for (const f of resp.fields) obj[f.name] = sampleValue(f.name, f.type);
      return resp.isArray ? JSON.stringify([obj], null, 2) : JSON.stringify(obj, null, 2);
    }
    return '';
  });
}
