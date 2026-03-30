import { stringify as yamlStringify } from 'yaml';
import jmespath from 'jmespath';
import { OutputFormatError } from '../errors';

export function formatOutput(data: unknown, format: string, query?: string): void {
  let result: unknown = data;

  if (query) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = jmespath.search(data as any, query);
    } catch (e) {
      throw new OutputFormatError(
        `JMESPath error: ${e instanceof Error ? e.message : String(e)}`,
        e,
      );
    }
  }

  if (format === 'yaml') {
    console.log(yamlStringify(result));
  } else if (format === 'table') {
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
      console.table(result);
    } else if (typeof result === 'object' && result !== null) {
      console.table(result);
    } else {
      console.log(String(result));
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
