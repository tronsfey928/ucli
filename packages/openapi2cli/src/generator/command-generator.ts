import * as path from 'path';
import { CommandStructure, GeneratedFile } from '../types/index';
import { renderTemplate } from './template-engine';

export async function generateProject(structure: CommandStructure): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  // 1. package.json for the generated CLI
  files.push({
    relativePath: 'package.json',
    content: await renderTemplate('package.json.hbs', { structure }),
  });

  // 2. tsconfig.json
  files.push({
    relativePath: 'tsconfig.json',
    content: await renderTemplate('tsconfig.json.hbs', { structure }),
  });

  // 3. Main entry: src/index.ts
  files.push({
    relativePath: path.join('src', 'index.ts'),
    content: await renderTemplate('index.ts.hbs', { structure }),
  });

  // 4. One command file per group: src/commands/<group-name>.ts
  for (const group of structure.groups) {
    files.push({
      relativePath: path.join('src', 'commands', `${group.name}.ts`),
      content: await renderTemplate('command.ts.hbs', { structure, group }),
    });
  }

  // 4b. Flat commands (untagged operations): src/flat-commands.ts
  if (structure.flatCommands.length > 0) {
    files.push({
      relativePath: path.join('src', 'flat-commands.ts'),
      content: await renderTemplate('flat-commands.ts.hbs', { structure, flatCommands: structure.flatCommands }),
    });
  }

  // 5. Shared API client: src/lib/api-client.ts
  files.push({
    relativePath: path.join('src', 'lib', 'api-client.ts'),
    content: await renderTemplate('api-client.ts.hbs', { structure }),
  });

  // 6. README (English default + Chinese)
  files.push({
    relativePath: 'README.md',
    content: await renderTemplate('README.md.hbs', { structure }),
  });
  files.push({
    relativePath: 'README.zh.md',
    content: await renderTemplate('README.zh.md.hbs', { structure }),
  });

  // 7. SKILL.md — Claude Code skill descriptor
  files.push({
    relativePath: 'SKILL.md',
    content: await renderTemplate('SKILL.md.hbs', { structure }),
  });

  // 8. bin shebang wrapper
  files.push({
    relativePath: path.join('bin', structure.name),
    content: `#!/usr/bin/env node\nrequire('../dist/index.js');\n`,
  });

  return files;
}
