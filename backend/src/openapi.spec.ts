import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

type Operation = { operationId?: string };
type Spec = { paths: Record<string, Record<string, Operation>> };

describe('openapi.yaml', () => {
  // js-yaml throws on duplicate mapping keys, which the client generator also rejects
  // (a lenient parser silently keeps the last one and hides the mistake).
  const spec = load(readFileSync(join(__dirname, '../../openapi.yaml'), 'utf8')) as Spec;

  it('parses strictly, with no duplicate keys', () => {
    expect(Object.keys(spec.paths).length).toBeGreaterThan(20);
  });

  it('gives every operation a unique id (they become client function names)', () => {
    const ids = Object.values(spec.paths)
      .flatMap((methods) => Object.values(methods))
      .map((op) => op.operationId)
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
