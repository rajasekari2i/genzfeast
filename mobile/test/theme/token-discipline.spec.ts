// O1 / SC-004 — no raw design literal in a screen or component.
//
// Covers more than hex: the census that sized this feature originally
// counted only colours and missed 4 inline fontWeight, 7 fontSize and 1
// borderRadius literal, three of which had no token to migrate to.
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..', 'src');
const SCANNED = ['screens', 'components', 'navigation'];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const FILES = SCANNED.flatMap((d) => walk(path.join(SRC, d)));

/** Strips comments so documentation about a hex cannot trip the gate. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function offenders(pattern: RegExp): string[] {
  return FILES.flatMap((f) => {
    const matches = code(f).match(pattern) ?? [];
    return matches.map((m) => `${path.relative(SRC, f)}: ${m}`);
  });
}

describe('token discipline', () => {
  it('contains no raw hex colour', () => {
    expect(offenders(/['"]#[0-9A-Fa-f]{3,8}['"]/g)).toEqual([]);
  });

  it('contains no raw rgb()/rgba() colour', () => {
    expect(offenders(/['"]rgba?\([^)]*\)['"]/g)).toEqual([]);
  });

  it('contains no raw fontSize literal', () => {
    expect(offenders(/fontSize\s*:\s*\d/g)).toEqual([]);
  });

  it('contains no raw fontWeight literal', () => {
    expect(offenders(/fontWeight\s*:/g)).toEqual([]);
  });

  it('contains no raw borderRadius literal', () => {
    expect(offenders(/borderRadius\s*:\s*\d/g)).toEqual([]);
  });

  it('scans a meaningful number of files', () => {
    // Guards against the gate passing because the walk silently found nothing.
    expect(FILES.length).toBeGreaterThan(40);
  });
});
