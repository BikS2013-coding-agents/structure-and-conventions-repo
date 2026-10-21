import type { EngineInterface, Register } from 'claude-code'

import * as lib from './lib'

// The structure-and-conventions mod: at the start of every session it checks that the
// project's CLAUDE.md carries the current <structure-and-conventions> documentation-map
// block, and adds or updates it. The master block ships with the plugin
// (block/structure-and-conventions.md); only the lines between the tags are ever
// rewritten, everything else in CLAUDE.md belongs to the project.
//
// It replaces the SessionStart shell hook ~/.claude/scripts/sync-claude-md.sh, with the
// same resolution rules, and writes through a symlinked CLAUDE.md instead of replacing
// the link.

type $ = EngineInterface

type Target = { path: string } | { skip: string }

/**
 * Which CLAUDE.md the session may touch. An existing CLAUDE.md at the project root wins
 * (nested projects keep their own); otherwise only a git repository's top level gets a
 * new one. Never the home folder: the user-level file lives in ~/.claude, and a
 * ~/CLAUDE.md would load on top of it.
 */
async function target($: $): Promise<Target> {
  const home = await $.env.get('HOME')
  if (!home) throw new Error('structure-and-conventions: HOME is not set; cannot tell the home folder apart.')
  const root = await $.session.root()
  if (root === home) return { skip: 'the session runs in the home folder' }

  if (await $.fs.exists(`${root}/CLAUDE.md`)) return guardUserLevel($, home, `${root}/CLAUDE.md`)

  const { stdout, exitCode } = await $.process.run(['git', '-C', root, 'rev-parse', '--show-toplevel'])
  if (exitCode !== 0) return { skip: `${root} has no CLAUDE.md and is not in a git repository` }
  const top = stdout.trim()
  if (top === home) return { skip: 'the git top level is the home folder' }
  return guardUserLevel($, home, `${top}/CLAUDE.md`)
}

/** Where a path really lands, or undefined when it leads nowhere. */
async function realPath($: $, path: string): Promise<string | undefined> {
  if (!(await $.fs.exists(path))) return undefined
  return (await $.fs.stat(path, { resolve: true })).realPath
}

/**
 * Never the user-level CLAUDE.md: a session started in ~/.claude, or in the repository
 * ~/.claude/CLAUDE.md links into, finds that file as its project CLAUDE.md, and the block
 * written there would load in every project on top of each project's own copy. Compared
 * by where both paths land, ignoring letter case (macOS file systems are
 * case-insensitive, and the user-level file may be linked as claude.md).
 */
async function guardUserLevel($: $, home: string, path: string): Promise<Target> {
  const landsAt = await realPath($, path)
  const userLevel = await realPath($, `${home}/.claude/CLAUDE.md`)
  if (landsAt !== undefined && userLevel !== undefined && landsAt.toLowerCase() === userLevel.toLowerCase()) {
    return { skip: `${path} is the user-level CLAUDE.md` }
  }
  return { path }
}

/** The master block shipped with the plugin. A missing or tagless master is an error. */
async function masterBlock($: $): Promise<string> {
  const path = `${$.plugin.root}/${lib.MASTER}`
  if (!(await $.fs.exists(path))) throw new Error(`structure-and-conventions: master block not found at ${path}.`)
  const block = lib.extractBlock(await $.fs.read(path))
  if (!block) throw new Error(`structure-and-conventions: ${path} has no ${lib.OPEN} … ${lib.CLOSE} block.`)
  return block
}

/** Where a write must land: the file a symlinked CLAUDE.md leads to, so the link survives. */
async function writePath($: $, path: string): Promise<string> {
  if (!(await $.fs.exists(path))) return path
  const stat = await $.fs.stat(path, { resolve: true })
  return stat.isLink && stat.realPath ? stat.realPath : path
}

/** Checks the project's CLAUDE.md and, unless `dryRun`, brings its block up to date. */
async function sync($: $, dryRun: boolean): Promise<string> {
  const t = await target($)
  if ('skip' in t) return `skipped: ${t.skip}`
  const block = await masterBlock($)
  const current = (await $.fs.exists(t.path)) ? await $.fs.read(t.path) : undefined
  const p = lib.plan(current, block)
  const changes = p.action !== 'unchanged' || p.legacyRemoved
  if (dryRun) {
    return changes
      ? `${t.path} needs a sync (${p.action === 'unchanged' ? 'legacy import' : `block ${p.action === 'created' ? 'missing, file absent' : p.action === 'inserted' ? 'missing' : 'outdated'}`}); run /conventions sync`
      : `the block in ${t.path} is up to date`
  }
  if (changes) await $.fs.write(await writePath($, t.path), p.text)
  return lib.describe(p, t.path)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'conventions',
      description: 'Structure & Conventions block: status (check only), sync (add or update it in CLAUDE.md)',
      argumentHint: 'status | sync',
    })
    try {
      const line = await sync($, false)
      if (!line.startsWith('skipped') && !line.includes('is up to date')) $.ui.toast(`conventions: ${line}`)
    } catch (err) {
      $.ui.toast(`${err instanceof Error ? err.message : String(err)}`)
    }
    return next(e)
  })

  on('command.run', { command: 'conventions' }, async ($, e) => {
    const [verb = 'status'] = e.args.trim().split(/\s+/).filter(Boolean)
    if (verb !== 'status' && verb !== 'sync') return { text: `Unknown: /conventions ${e.args.trim()}. Use status or sync.` }
    try {
      return { text: await sync($, verb === 'status') }
    } catch (err) {
      return { text: err instanceof Error ? err.message : String(err) }
    }
  })
}
