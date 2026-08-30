/**
 * Project lint.
 *
 * Rather than pull in a large plugin chain, this enforces the specific rules
 * this project depends on — the ones a general-purpose linter would not know
 * about. Every rule exists because breaking it would ship a real defect.
 *
 * Exit code 1 on any violation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const problems = [];
const report = (file, line, rule, message) => problems.push({ file, line, rule, message });

async function walk(dir, filter) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, filter)));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

const RULES = [
  {
    id: 'no-secrets',
    // Never commit credentials. Matches assignment of a plausible key value.
    test: /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-/+]{16,}['"]/i,
    message: 'possible hard-coded secret',
    applies: () => true,
  },
  {
    id: 'no-http-asset',
    test: /["'(]http:\/\/(?!localhost|127\.)/,
    message: 'plain-http URL — mixed content on an HTTPS site',
    applies: (f) => !f.startsWith('tools' + path.sep) && !f.includes('audit'),
  },

  {
    id: 'no-set-html-dynamic',
    test: /set:html=\{(?!JSON\.stringify)/,
    message: 'set:html with a non-serialised value — escape or use a text node',
    applies: (f) => f.endsWith('.astro'),
  },
  {
    id: 'no-target-blank-unsafe',
    test: /target=["']_blank["'](?![^>]*rel=)/,
    message: 'target="_blank" without rel',
    applies: (f) => f.endsWith('.astro'),
  },
  {
    id: 'no-raw-hex-in-components',
    // Colours belong in tokens.css so contrast stays auditable in one place.
    test: /(?:color|background(?:-color)?|border(?:-\w+)?-color)\s*:\s*#(?!fff\b|ffffff\b)[0-9a-f]{3,8}\b/i,
    message: 'hard-coded colour — use a design token from tokens.css',
    applies: (f) => f.endsWith('.astro'),
  },
  {
    id: 'no-console-in-site',
    test: /\bconsole\.(log|debug)\(/,
    message: 'console statement in shipped code',
    applies: (f) => f.startsWith('src' + path.sep),
  },
  {
    id: 'no-user-scalable-no',
    test: /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/,
    message: 'viewport blocks zoom (WCAG 1.4.4)',
    applies: (f) => f.endsWith('.astro'),
  },
  {
    id: 'no-positive-tabindex',
    test: /tabindex=["'][1-9]/,
    message: 'positive tabindex breaks focus order',
    applies: (f) => f.endsWith('.astro'),
  },
  {
    id: 'no-javascript-href',
    test: /href=["']javascript:/,
    message: 'javascript: href — use a <button> for an action',
    applies: (f) => f.endsWith('.astro'),
  },
];

/**
 * Strip comments and JSX/Astro comment expressions before scanning, so a rule
 * never fires on prose that merely describes the thing it forbids.
 */
function stripComments(source) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, prefix) => prefix + ' '.repeat(m.length - prefix.length));
}

/** Rules that need more than a regex over one line. */
async function structuralChecks() {
  /**
   * `innerHTML` assignment must either clear the node or interpolate only
   * escaped values. Checked across the whole statement, since the escaping call
   * usually sits on a later line than the assignment.
   */
  const scripted = [
    ...(await walk('src', (f) => f.endsWith('.astro') || f.endsWith('.ts'))),
  ];
  for (const file of scripted) {
    const source = stripComments(await fs.readFile(file, 'utf8'));
    for (const match of source.matchAll(/\.innerHTML\s*=/g)) {
      const start = match.index ?? 0;
      // The statement runs to the next semicolon at depth zero; a generous
      // window is enough to see whether escaping is applied.
      const statement = source.slice(start, start + 1200);
      const end = statement.indexOf(';');
      const body = end === -1 ? statement : statement.slice(0, end);
      const clearsOnly = /=\s*''\s*$|=\s*""\s*$/.test(body.trim());
      if (clearsOnly || body.includes('escapeHtml')) continue;
      const line = source.slice(0, start).split('\n').length;
      report(file, line, 'no-inner-html', 'innerHTML assignment without escaping — XSS risk');
    }
  }

  // Every .astro page component must render through the Base layout, so no
  // route can ship without the metadata contract.
  const pages = await walk('src/pages', (f) => f.endsWith('.astro'));
  for (const file of pages) {
    const source = stripComments(await fs.readFile(file, 'utf8'));
    const rendersBase = /<Base\b/.test(source);
    const delegates = /<(ProductDetail|CategoryPage|RecipeIndex)\b/.test(source);
    if (!rendersBase && !delegates) {
      report(file, 1, 'page-uses-base-layout', 'page neither renders <Base> nor delegates to a component that does');
    }
  }

  // Astro images must declare sizing so they cannot cause layout shift.
  const withImages = await walk('src', (f) => f.endsWith('.astro'));
  for (const file of withImages) {
    const source = stripComments(await fs.readFile(file, 'utf8'));
    const tags = source.match(/<Image\b[\s\S]*?\/>/g) ?? [];
    for (const tag of tags) {
      const sized = /\bwidths=|\bwidth=|\bdensities=/.test(tag);
      if (!sized) {
        const line = source.slice(0, source.indexOf(tag)).split('\n').length;
        report(file, line, 'image-sizing', '<Image> without widths/width/densities');
      }
      if (/\bwidths=/.test(tag) && !/\bsizes=/.test(tag)) {
        const line = source.slice(0, source.indexOf(tag)).split('\n').length;
        report(file, line, 'image-sizes', '<Image widths> without a matching sizes attribute');
      }
      if (!/\balt=/.test(tag)) {
        const line = source.slice(0, source.indexOf(tag)).split('\n').length;
        report(file, line, 'image-alt', '<Image> without alt');
      }
    }
  }
}

async function main() {
  const files = [
    ...(await walk('src', (f) => /\.(astro|ts|css|mjs)$/.test(f))),
    ...(await walk('tools', (f) => /\.mjs$/.test(f))),
    ...(await walk('tests', (f) => /\.ts$/.test(f))),
  ].filter((f) => !f.includes(`tools${path.sep}scratch`));

  for (const file of files) {
    const source = stripComments(await fs.readFile(file, 'utf8'));
    const lines = source.split('\n');
    for (const rule of RULES) {
      if (!rule.applies(file)) continue;
      lines.forEach((line, i) => {
        // Skip the rule's own definition and lines explicitly opted out.
        if (line.includes('lint-ok') || line.includes(`id: '${rule.id}'`)) return;
        if (!line.trim()) return;
        if (rule.test.test(line)) report(file, i + 1, rule.id, rule.message);
      });
    }
  }

  await structuralChecks();

  if (problems.length) {
    console.error(`lint: ${problems.length} problem(s)\n`);
    for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.rule}  ${p.message}`);
    process.exit(1);
  }
  console.log(`lint: ${files.length} files checked, no problems`);
}

main();
