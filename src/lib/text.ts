/**
 * Text shaping for metadata.
 *
 * These helpers only trim and join copy that is already published — they never
 * generate new sentences about the subject.
 */

/** Meta descriptions render usefully at roughly this length. */
const MAX_DESCRIPTION = 155;
const MIN_DESCRIPTION = 70;

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Trim to a sentence boundary under the target length, falling back to a word
 * boundary with an ellipsis. Never cuts mid-word.
 */
export function trimDescription(input: string, max = MAX_DESCRIPTION): string {
  const text = collapse(input);
  if (text.length <= max) return text;

  const window = text.slice(0, max + 1);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentenceEnd >= MIN_DESCRIPTION) return text.slice(0, sentenceEnd + 1);

  const wordEnd = window.lastIndexOf(' ');
  return `${text.slice(0, wordEnd > 0 ? wordEnd : max).replace(/[\s,;:—-]+$/, '')}…`;
}

/**
 * Build a description from a subject line plus supporting published facts,
 * adding facts only until the description is long enough to be useful. Every
 * part must already be published copy or a published attribute.
 */
export function composeDescription(parts: (string | null | undefined)[], max = MAX_DESCRIPTION): string {
  const clean = parts.map((p) => (p ? collapse(p) : '')).filter(Boolean);
  let out = '';
  for (const part of clean) {
    const next = out ? `${out} ${part.replace(/^\s*[.]\s*/, '')}` : part;
    if (out.length >= MIN_DESCRIPTION && next.length > max) break;
    out = next;
    if (out.length > max) break;
  }
  return trimDescription(out || clean[0] || '', max);
}

/** Ensure a sentence ends with terminal punctuation. */
export const sentence = (s: string) => {
  const t = collapse(s);
  return t && !/[.!?…]$/.test(t) ? `${t}.` : t;
};
