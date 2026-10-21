# structure-and-conventions-repo

The Claude Code plugin marketplace `structure-and-conventions`. It holds one plugin of the
same name.

## structure-and-conventions

A Claude Code mod that keeps one documentation map in every project's `CLAUDE.md`. The map
says where a project's plans, designs, refined requests, prompts, tool docs, test scripts and
issue register live, how they are named and numbered, and how historical documents are
archived on `*-history` branches.

The map is the `<structure-and-conventions>` … `</structure-and-conventions>` block in
[`plugins/structure-and-conventions/block/structure-and-conventions.md`](plugins/structure-and-conventions/block/structure-and-conventions.md),
the master copy. **Edit the master, never a project's copy**: a project's block is replaced
at its next session start.

At the start of every session the mod:

1. **Finds the project's `CLAUDE.md`.** It uses `CLAUDE.md` at the project root if there is one.
   Otherwise it uses the git top level, where it creates the file. It skips the home folder,
   because the user-level file lives in `~/.claude`. It also skips a folder that has no
   `CLAUDE.md` and isn't in a git repository.
2. **Compares that file's block with the master.** The tags count only when each is alone on
   its own line.
3. **Brings the file up to date:**
   - no file: creates it with the block alone;
   - no block: adds the block at the top, followed by a blank line and the existing content;
   - outdated block: replaces only the lines between the tags, keeping everything around them;
   - current block: changes nothing.
4. **Removes the legacy `@~/.claude/pre-implementation-pipeline.md` import** wherever it finds
   it.

A symlinked `CLAUDE.md`, for example one that links to `AGENTS.md`, is written through, so the
link is kept. When the mod changes a file, it shows a toast. It never commits anything.

### Commands

| Command | Does |
|---|---|
| `/conventions status` | Checks the project's `CLAUDE.md` against the master without writing (the default) |
| `/conventions sync` | Runs the session-start sync now, for example after editing the master |

## Install

```bash
claude plugin marketplace add BikS2013-coding-agents/structure-and-conventions-repo
claude plugin install structure-and-conventions@structure-and-conventions
```

The repository is private, so the account running these needs access to the
`BikS2013-coding-agents` organization.

## Developing

On the development machine the plugin is **not installed** from this marketplace. Two links
point into this checkout instead:

| Link | → |
|---|---|
| `~/.claude/skills/structure-and-conventions` | `plugins/structure-and-conventions` (Claude Code loads the mod from here and reloads it on every save) |
| `~/.claude/structure-and-conventions.md` (through `.claude-repo`) | `plugins/structure-and-conventions/block/structure-and-conventions.md` (the master, for anything that reads it by its old path) |

Installing the plugin as well would load it twice.

```bash
claude plugin validate plugins/structure-and-conventions
claude plugin test plugins/structure-and-conventions
```

Bump `version` in both `plugins/structure-and-conventions/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json` on every change, or installed copies will not update.
