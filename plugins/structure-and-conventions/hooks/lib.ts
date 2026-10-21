// Pure text logic of the structure-and-conventions mod: finding the block in a CLAUDE.md
// and working out the file's new text. No engine calls here, so it is unit-tested.

export const OPEN = '<structure-and-conventions>'
export const CLOSE = '</structure-and-conventions>'
export const MASTER = 'block/structure-and-conventions.md'

/** Import line an earlier version of the shell sync wired into project CLAUDE.md files. */
export const LEGACY_IMPORT = '@~/.claude/pre-implementation-pipeline.md'

/** Where the block sits: line indexes of its opening and closing tags. */
type Span = { start: number; end: number }

/**
 * The block's lines span, or undefined when there is none. The tags count only alone on
 * their own line, so a mention of the tag in prose never matches.
 */
function findBlock(lines: readonly string[]): Span | undefined {
  const start = lines.indexOf(OPEN)
  if (start < 0) return undefined
  const end = lines.indexOf(CLOSE, start + 1)
  return end < 0 ? undefined : { start, end }
}

/** The block's text, tags included and without a final newline, or undefined. */
export function extractBlock(text: string): string | undefined {
  const lines = text.split('\n')
  const span = findBlock(lines)
  return span && lines.slice(span.start, span.end + 1).join('\n')
}

export type Action = 'created' | 'inserted' | 'updated' | 'unchanged'
export type Plan = { action: Action; text: string; legacyRemoved: boolean }

/**
 * The project's CLAUDE.md after the sync.
 *
 * - no file: the block alone;
 * - no block: the block, a blank line, then the existing content;
 * - outdated block: only the lines between the tags are replaced, everything around
 *   them is kept byte for byte;
 * - current block: the text unchanged.
 *
 * In every case the legacy pipeline import line is dropped.
 */
export function plan(current: string | undefined, block: string): Plan {
  if (current === undefined) return { action: 'created', text: `${block}\n`, legacyRemoved: false }

  const kept = current.split('\n').filter(line => line.trim() !== LEGACY_IMPORT)
  const legacyRemoved = kept.length !== current.split('\n').length
  const span = findBlock(kept)

  if (!span) {
    return { action: 'inserted', text: `${block}\n\n${kept.join('\n')}`, legacyRemoved }
  }
  const existing = kept.slice(span.start, span.end + 1).join('\n')
  if (existing === block) {
    return { action: 'unchanged', text: kept.join('\n'), legacyRemoved }
  }
  const lines = [...kept.slice(0, span.start), ...block.split('\n'), ...kept.slice(span.end + 1)]
  return { action: 'updated', text: lines.join('\n'), legacyRemoved }
}

/** The one line the mod reports, in the words the shell sync used. */
export function describe(p: Plan, path: string): string {
  const legacy = p.legacyRemoved ? `; removed the legacy import ${LEGACY_IMPORT}` : ''
  switch (p.action) {
    case 'created': return `created ${path} with the Structure & Conventions block`
    case 'inserted': return `added the Structure & Conventions block to ${path}${legacy}`
    case 'updated': return `updated the Structure & Conventions block in ${path}${legacy}`
    case 'unchanged': return legacy ? `the block in ${path} is up to date${legacy}` : `the block in ${path} is up to date`
  }
}
